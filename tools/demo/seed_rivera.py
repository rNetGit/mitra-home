"""Seed a throwaway Mitra Home install with the made-up Rivera family, for the website's demo and screenshots.

Run from the install's folder, after migrate, `members.py sync` and `life.py seed`:
    python /path/to/seed_rivera.py
Every name, number, shop and amount is invented. Dates are relative to today, so the demo always looks current.
Prints the wall's cookie token on the last line (the crawler uses it to save the Mitra Wall screens).
"""
import datetime as dt
import json
import random
import sqlite3
import sys
from pathlib import Path

ROOT = Path.cwd()
sys.path.insert(0, str(ROOT / "data"))

import wall  # noqa: E402  (the install's own module)

random.seed(7)
DB = ROOT / "data" / "family.db"
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
con.execute("PRAGMA foreign_keys=ON")
T = dt.date.today()
NOW = dt.datetime.now().replace(microsecond=0)


def d(n):
    return (T + dt.timedelta(days=n)).isoformat()


def ins(table, **kw):
    have = {r[1]: r for r in con.execute(f"PRAGMA table_info({table})")}
    for stamp in ("created_at", "added_at", "updated_at"):  # NOT NULL time stamps without a default
        if stamp in have and stamp not in kw and have[stamp][3] and have[stamp][4] is None:
            kw[stamp] = NOW.isoformat(timespec="seconds")
    cols = ", ".join(kw)
    cur = con.execute(f"INSERT INTO {table}({cols}) VALUES ({', '.join('?' * len(kw))})", tuple(kw.values()))
    return cur.lastrowid


# ---- config: house, look-ups, wall screen ----------------------------------------------------------------------------
cfg_path = ROOT / "config" / "family.json"
cfg = json.loads(cfg_path.read_text())
cfg["lookups"] = {"online": True}
cfg.setdefault("wall", {})["screen"] = {"clock": "digital", "photos": True, "photo_seconds": 12, "clock_seconds": 60,
                                       "per_turn": 4, "photos_from": "07:00", "photos_to": "21:00",
                                       "night_from": "22:00", "night_to": "06:00"}
cfg["wall"]["star_cents"] = 25
cfg["wall"]["goals"] = {"Mateo": {"title": "New bike", "stars": 100, "since": d(-20)}}
cfg["agent"] = {**cfg.get("agent", {}), "name": "Mitra", "tone": "warm"}
cfg_path.write_text(json.dumps(cfg, indent=2))

# ---- money -------------------------------------------------------------------------------------------------------------
chk = ins("accounts", name="Lakeside Bank Checking", type="checking", last4="4821", owner="Marcus")
sav = ins("accounts", name="Lakeside Bank Savings", type="savings", last4="7310", owner="Elena")
visa = ins("accounts", name="Northway Visa", type="credit", last4="1209", owner="Marcus")
summit = ins("accounts", name="Summit Rewards Card", type="credit", last4="3344", owner="Elena")
inv = ins("accounts", name="Harbor Brokerage", type="investment", last4="5502", owner="Marcus")

SPEND = [  # description, category, account, low, high, per month, cardholder
    ("FRESHFIELD MARKET", "groceries", visa, 62, 148, 5, "MARCUS RIVERA"),
    ("GREENLEAF GROCERS", "groceries", summit, 35, 92, 3, "ELENA RIVERA"),
    ("CORNER CAFE", "dining", summit, 9, 28, 4, "ELENA RIVERA"),
    ("PIZZA PALACE", "dining", visa, 24, 46, 2, "MARCUS RIVERA"),
    ("QUICKFUEL #221", "fuel", visa, 38, 61, 3, "MARCUS RIVERA"),
    ("BRIGHTMART", "general merchandise", summit, 18, 120, 2, "SOFIA RIVERA"),
    ("PAGEBOOK STORE", "shopping", summit, 12, 40, 1, "ELENA RIVERA"),
    ("PAWS & CLAWS PET", "pets", visa, 22, 68, 1, "MARCUS RIVERA"),
    ("RIVERSIDE PHARMACY", "healthcare", summit, 8, 35, 1, "ELENA RIVERA"),
]
FIXED = [  # day, description, category, type, account, amount
    (1, "MAPLE HOME LENDING MORTGAGE", "housing", "spend", chk, -2150.00),
    (3, "CITY WATER & POWER", "utilities", "utility", chk, -142.18),
    (8, "BRIGHTWAVE INTERNET", "utilities", "utility", chk, -70.00),
    (9, "CRESTLINE AUTO LOAN", "auto loan", "loan_payment", chk, -389.00),
    (12, "STREAMBOX", "subscriptions", "spend", visa, -15.99),
    (14, "TUNEWAVE FAMILY", "subscriptions", "spend", summit, -16.99),
    (15, "LAKESIDE MUTUAL AUTO INS", "insurance", "insurance", chk, -224.00),
    (17, "NORTHSTAR MOBILE", "utilities", "utility", chk, -118.40),
    (20, "YMCA SWIM PROGRAM", "kids activities", "spend", summit, -64.00),
    (22, "SPRINGFIELD GYM", "fitness", "spend", visa, -39.00),
]
for back in range(6, -1, -1):
    first = (T.replace(day=1) - dt.timedelta(days=1) * 0)
    y, m = T.year, T.month - back
    while m < 1:
        y, m = y - 1, m + 12
    first = dt.date(y, m, 1)
    last_day = (dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1)).day
    limit = T if back == 0 else dt.date(y, m, last_day)

    def add(day, desc, cat, typ, acct, amt, holder=None):
        when = dt.date(y, m, min(day, last_day))
        if when > limit:
            return
        ins("transactions", account_id=acct, txn_date=when.isoformat(), description=desc, amount=round(amt, 2),
            category=cat, txn_type=typ, cardholder=holder)

    for day in (1, 15):
        add(day, "ACME ENGINEERING PAYROLL", "salary", "income", chk, 3480.00)
        add(day + 1, "SPRINGFIELD SCHOOLS PAYROLL", "salary", "income", chk, 2210.00)
    add(28, "INTEREST PAYMENT", "interest", "interest", sav, 11.0 + back * 0.4)
    add(5, "TRANSFER TO SAVINGS", "transfer", "transfer", chk, -500.00)
    add(5, "TRANSFER FROM CHECKING", "transfer", "transfer", sav, 500.00)
    add(25, "NORTHWAY VISA PAYMENT", "card payment", "card_payment", chk, -900.00 - back * 20)
    add(26, "SUMMIT CARD AUTOPAY", "card payment", "card_payment", chk, -640.00 - back * 15)
    for day, desc, cat, typ, acct, amt in FIXED:
        add(day, desc, cat, typ, acct, amt)
    for desc, cat, acct, lo, hi, n, holder in SPEND:
        for _ in range(n + (1 if cat == "groceries" and back in (1, 4) else 0)):
            add(random.randint(1, 28), desc, cat, "spend", acct, -random.uniform(lo, hi), holder)
    if back == 2:
        add(11, "SUMMER CAMP REGISTRATION", "kids activities", "spend", summit, -420.00, "ELENA RIVERA")
    if back == 1:
        add(19, "DR. OKAFOR PEDIATRICS", "healthcare", "spend", summit, -45.00, "ELENA RIVERA")
add_uncat = ins("transactions", account_id=visa, txn_date=d(-3), description="TST* HILLTOP BAKERY", amount=-18.40,
                category=None, txn_type="spend", cardholder="MARCUS RIVERA")

for acct, bal in ((chk, 6420.55), (sav, 18250.00), (visa, -1184.20), (summit, -702.48), (inv, 42310.00)):
    ins("account_balances", account_id=acct, as_of=d(-2), balance=bal, kind="statement")
    for back in range(1, 7):  # older statements, so Money shows net worth by month
        grow = {sav: -420, inv: -610, chk: -95}.get(acct, 0)
        ins("account_balances", account_id=acct, as_of=d(-2 - 30 * back), balance=round(bal + grow * back, 2),
            kind="statement")

for name, vendor, freq, amt, due, status in (
        ("Mortgage", "Maple Home Lending", "monthly", 2150.00, 12, "due"),
        ("Water and power", "City Water & Power", "monthly", 142.18, 4, "due"),
        ("Internet", "Brightwave", "monthly", 70.00, -2, "due"),
        ("Mobile phones", "Northstar Mobile", "monthly", 118.40, 9, "due"),
        ("Auto insurance", "Lakeside Mutual", "monthly", 224.00, 15, "due"),
        ("Property tax (2nd half)", "Sangamon County", "yearly", 1840.00, 26, "due"),
        ("Auto loan", "Crestline Auto Finance", "monthly", 389.00, -11, "paid")):
    ins("bills", name=name, vendor=vendor, frequency=freq, amount=amt, due_date=d(due), status=status,
        paid_date=d(due) if status == "paid" else None)

for name, amt, freq, nxt, pat, cat, dec in (
        ("StreamBox", 15.99, "monthly", 23, "%STREAMBOX%", "subscriptions", "keep"),
        ("TuneWave Family", 16.99, "monthly", 25, "%TUNEWAVE%", "subscriptions", "unreviewed"),
        ("Springfield Gym", 39.00, "monthly", 2, "%SPRINGFIELD GYM%", "fitness", "keep"),
        ("CloudVault storage", 29.99, "yearly", 41, "%CLOUDVAULT%", "subscriptions", "unreviewed")):
    ins("subscriptions", name=name, amount=amt, frequency=freq, next_renewal=d(nxt), active=1, match_pattern=pat,
        category=cat, decision=dec)

ins("loans", name="Family SUV loan", lender="Crestline Auto Finance", kind="auto", last4="8812", balance=14620.00,
    balance_date=d(-11), rate_pct=4.9, payment=389.00, payment_day=9, start_date="2024-06-09", payoff_date="2029-06-09",
    status="active")
ins("savings_goals", name="Emergency fund", target=25000.00, account_id=sav, status="active")
ins("savings_goals", name="Summer trip to the lake", target=3200.00, saved=1450.00, due_date=d(240), status="active")
ins("savings_goals", name="New roof", target=12000.00, saved=2600.00, due_date=d(540), status="active")
for cat, lim in (("groceries", 900), ("dining", 250), ("fuel", 200), ("general merchandise", 200), ("kids activities", 150),
                 ("allowance:Mateo", 30)):
    con.execute("INSERT OR REPLACE INTO budget(category, monthly_limit) VALUES (?,?)", (cat, lim))

ins("receipts", merchant="Freshfield Market", receipt_date=d(-4), total=87.35, card_last4="1209", status="open")

# ---- people and dates --------------------------------------------------------------------------------------------------
for person, provider, purpose, when in (
        ("Sofia", "Bright Smiles Dental", "Cleaning", d(2) + " 15:30"),
        ("Mateo", "Dr. Okafor Pediatrics", "Annual checkup", d(8) + " 09:00"),
        ("Elena", "Clearview Eye Care", "Eye exam", d(13) + " 17:15"),
        ("Pancho", "Oak Street Vet", "Vaccines", d(5) + " 11:00"),
        ("Marcus", "Lakeside Physio", "Knee follow-up", d(1) + " 08:15")):
    ins("appointments", person=person, provider=provider, purpose=purpose, appt_datetime=when)

ins("events", name="Family movie night", event_date=d(4), recurs_yearly=0, start_time="19:00", end_time="21:00")
ins("events", name="Wedding anniversary", event_date=d(18), recurs_yearly=1)
ins("events", name="Grandma Rosa visits", event_date=d(10), recurs_yearly=0, start_time="12:00", end_time="15:00")
ins("events", name="Neighborhood cleanup", event_date=d(-1), recurs_yearly=0, start_time="09:00", end_time="11:00")

for dom, member, title, due, recur, provider in (
        ("school", "Sofia", "Science fair project due", 3, None, "Lincoln Middle School"),
        ("school", "Mateo", "Field trip form and $12", 1, None, "Washington Elementary"),
        ("school", "Mateo", "Picture day", 6, None, "Washington Elementary"),
        ("activity", "Sofia", "Soccer team photos", 9, None, "Springfield Youth Soccer"),
        ("pet", "Pancho", "Flea and tick dose", 0, 1, None),
        ("chore", None, "Replace furnace filter", -2, 3, None),
        ("gift", "Elena", "Birthday gift for Elena", 13, None, None),
        ("legal", None, "Review wills and beneficiaries", 45, 36, None),
        ("travel", None, "Book Thanksgiving flights", 7, None, None)):
    ins("life_items", domain=dom, member=member, title=title, due_date=d(due), recur_months=recur, provider=provider)

for member, title, provider, days, st, en in (
        ("Sofia", "Soccer practice", "Springfield Youth Soccer", "TU,TH", "17:30", "19:00"),
        ("Mateo", "Swim lessons", "YMCA", "SA", "10:00", "10:45"),
        ("Mateo", "Piano", "Ms. Lee's Studio", "WE", "16:00", "16:30"),
        ("Sofia", "Art club", "Lincoln Middle School", "MO", "15:15", "16:15")):
    ins("activity_schedules", member=member, title=title, provider=provider, weekdays=days, start_time=st, end_time=en,
        term_start=d(-50), term_end=d(60), school_days=1, status="active")

for day, kind, name, member, status in (
        (d(11), "closure", "Teacher institute day (no school)", None, "active"),
        (d(16), "early", "Early dismissal 12:30", None, "active"),
        (d(37), "closure", "Thanksgiving break", None, "proposed")):
    ins("calendar_days", day=day, kind=kind, name=name, member=member, source="school", status=status)

ins("member_info", member="Mateo", category="medical", label="Allergy", value="Peanuts: carries an EpiPen", verified_on=d(-30),
    status="active")
ins("member_info", member="Sofia", category="emergency", label="School nurse", value="Lincoln Middle, ext. 214",
    verified_on=d(-60), status="active")

# ---- home, cars, papers ---------------------------------------------------------------------------------------------
car1 = ins("vehicles", year=2021, make="Honda", model="Pilot", vin_last4="4417", plate_last4="2K9", owner="Marcus",
           primary_driver="Marcus", registration_expires=d(24), inspection_expires=d(150), status="active", color="Blue",
           body_type="SUV", plate="RVR 2K9", plate_region="IL")
car2 = ins("vehicles", year=2017, make="Toyota", model="Corolla", vin_last4="9031", plate_last4="7TQ", owner="Elena",
    primary_driver="Elena", registration_expires=d(190), status="active", color="Silver", body_type="Sedan", plate="EL 47TQ",
    plate_region="IL")
for vid, odo in ((car1, 38200), (car2, 91400)):
    for kind, back in (("oil_change", 70), ("rotation", 70), ("brake_fluid", 300), ("battery", 500)):
        ins("vehicle_log", vehicle_id=vid, log_date=d(-back), kind=kind, odometer=odo - back * 30, vendor="Quick Lube & Tire")
con.execute("DELETE FROM id_documents WHERE person='Mateo' AND number_last4 IS NULL")
ins("policies", kind="auto", carrier="Lakeside Mutual", policy_last4="5521", term_start=d(-150), term_end=d(32),
    premium_total=1344.00, payment_plan="monthly", insured_names="Marcus, Elena", status="active")
ins("policies", kind="home", carrier="Prairie Shield", policy_last4="0884", term_start=d(-200), term_end=d(165),
    premium_total=1420.00, payment_plan="yearly", insured_names="Marcus, Elena", status="active")
for person, typ, last4, exp in (("Marcus", "passport", "3381", d(58)), ("Elena", "drivers_license", "7720", d(400)),
                                ("Sofia", "passport", "9902", d(900)), ("Elena", "passport", "5106", d(1300)),
                                ("Marcus", "drivers_license", "2284", d(610))):
    con.execute("UPDATE id_documents SET number_last4=?, expires=?, notes=NULL WHERE person=? AND doc_type=?",
                (last4, exp, person, typ))
ins("wallet_cards", kind="library", title="Springfield Public Library", member="Sofia", issuer="Springfield Library",
    number="29911004417", number_last4="4417", expires=d(300), status="active")
ins("wallet_cards", kind="membership", title="Warehouse club", member="Marcus", issuer="BulkBarn", number="800123456",
    number_last4="3456", expires=d(40), status="active")
ins("wallet_cards", kind="home", title="Home Wi-Fi and trash day", details="Wi-Fi: Rivera-Home · Trash: Thursday · "
    "Furnace filter 16x25x1", status="active")
ins("home_contacts", name="Ace Plumbing", trade="plumbing", phone="(217) 555-0142", rating=5, again=1, status="active",
    last_used=d(-90))
ins("home_contacts", name="Prairie Heating & Air", trade="heating_cooling", phone="(217) 555-0199", rating=4, again=1,
    status="active")
ins("home_assets", name="Refrigerator", category="appliance", brand_model="ColdCo FR-300", purchase_date="2023-04-02",
    warranty_end=d(120), price=1299.00, location="Kitchen", status="active")

# ---- lists, meals, notes ------------------------------------------------------------------------------------------------
groc = (con.execute("SELECT id FROM lists WHERE name='Groceries'").fetchone() or [None])[0] or \
    ins("lists", name="Groceries", kind="shopping", audience="family", status="active", created_by="Elena")
for text, by in (("Milk", "Elena"), ("Bananas", "Mateo"), ("Tortillas", "Marcus"), ("Cereal", "Sofia"), ("Eggs", "Elena")):
    ins("list_items", list_id=groc, text=text, status="open", added_by=by)
todo = ins("lists", name="Weekend jobs", kind="todo", audience="family", status="active", created_by="Marcus")
for text in ("Rake the front yard", "Clean the garage", "Swap summer clothes"):
    ins("list_items", list_id=todo, text=text, status="open", added_by="Marcus")
r1 = ins("recipes", name="Chicken enchiladas", servings=6, tags="dinner", status="active", added_by="Elena")
r2 = ins("recipes", name="Veggie stir-fry", servings=4, tags="dinner", status="active", added_by="Marcus")
for rid, lines in ((r1, ["2 lb chicken", "12 tortillas", "2 cups salsa verde", "1 cup cheese"]),
                   (r2, ["1 lb tofu", "2 peppers", "1 broccoli", "soy sauce (pantry)"])):
    for line in lines:
        try:
            ins("recipe_ingredients", recipe_id=rid, text=line.replace(" (pantry)", ""), pantry=int("(pantry)" in line))
        except sqlite3.OperationalError:
            pass
for n, (rid, title) in enumerate(((r1, None), (None, "Tacos"), (r2, None), (None, "Leftovers"), (None, "Pizza night"))):
    ins("meal_plan", day=d(n), slot="dinner", recipe_id=rid, title=title, added_by="Elena")
ins("saved_items", kind="place", title="Lincoln Park playground", place_address="Springfield", tags="kids", audience="family",
    owner="Elena", pinned=1, status="active")
ins("saved_items", kind="deal", title="Winter coats 30% off at BrightMart", expires_on=d(9), tags="kids,clothes",
    audience="family", owner="Elena", status="active")
ins("saved_items", kind="link", title="Science fair rules", url="https://example.org/science-fair", domain="example.org",
    tags="school", audience="family", owner="Marcus", status="active")

# ---- work ----------------------------------------------------------------------------------------------------------------
try:
    ct = ins("contracts", person="Marcus", client="Blue River Analytics", vendor="Acme Engineering", start_date="2026-01-05",
             hourly_rate=85.0, status="active", invoice_freq="monthly", timesheet_cycle="weekly", cycle_anchor="2026-01-05",
             hours_per_day=8, schedule="NNFFNXX")
    for k in range(1, 40):
        day = T - dt.timedelta(days=k)
        if day.weekday() < 5:
            ins("work_hours", contract_id=ct, work_date=day.isoformat(), hours=8, location="offsite" if day.weekday() in (2, 3) else "onsite",
                source="manual")
except sqlite3.IntegrityError as e:
    print("work skipped:", e)

# ---- the Mitra Wall: routines, stars, a paired wall ---------------------------------------------------------------------
routine_ids = []
for member, part, title, icon, stars in (
        ("Mateo", "morning", "Make your bed", "bed", 1), ("Mateo", "morning", "Brush teeth", "tooth", 1),
        ("Mateo", "afternoon", "Homework", "book", 2), ("Mateo", "afternoon", "Feed Pancho", "paw", 1),
        ("Mateo", "evening", "Pack school bag", "bag", 1), ("Sofia", "morning", "Brush teeth", "tooth", 1),
        ("Sofia", "afternoon", "Piano practice", "music", 2), ("Sofia", "evening", "Set the table", "plate", 1),
        ("Sofia", "evening", "Take out the bins", "bin", 2)):
    routine_ids.append((ins("routines", member=member, part=part, title=title, icon=icon, stars=stars, weekdays="",
                            sort=len(routine_ids), status="active"), stars))
for back in range(0, 9):
    day = d(-back)
    for rid, stars in routine_ids:
        if back == 0 and random.random() < 0.55 or back and random.random() < 0.8:
            ins("routine_done", routine_id=rid, day=day, stars=stars, done_by="Kitchen wall", done_at=day + "T08:00:00")
con.commit()

for title, stars, member in (("30 minutes of screen time", 10, None), ("Pick Friday's dinner", 15, None),
                             ("Stay up 30 minutes late", 20, None), ("Trip to the bookshop", 40, "Sofia")):
    rew = ins("rewards", title=title, stars=stars, member=member, status="active")
    if title.startswith("Pick"):
        ins("reward_claims", reward_id=rew, member="Mateo", stars=stars, status="asked",
            asked_at=NOW.isoformat(timespec="seconds"), asked_by="Kitchen wall")
con.commit()

code, _info = wall.pair_start(con, "Kitchen wall", by="Elena")
token, _w = wall.pair_redeem(con, code)
con.commit()

# ---- weather cache (invented, so the demo never goes online) ------------------------------------------------------------
looks = ["sun", "partly", "cloud", "rain", "partly", "sun", "sun", "cloud"]
hours = []
start = NOW.replace(minute=0, second=0) - dt.timedelta(hours=2)
for h in range(48):
    t = start + dt.timedelta(hours=h)
    temp = round(52 + 9 * __import__("math").sin((t.hour - 9) / 24 * 6.283))
    look = "moon" if t.hour < 7 or t.hour >= 19 else ("partly" if t.hour < 15 else "cloud")
    hours.append({"t": t.isoformat(timespec="minutes"), "temp": temp, "pop": 10 if t.hour < 15 else 60, "look": look})
days = [{"date": d(n), "hi": 64 - n % 3 * 3, "lo": 45 - n % 2 * 4, "look": looks[n % len(looks)], "pop": 20 + 10 * (n % 3)}
        for n in range(7)]
(ROOT / "logs").mkdir(exist_ok=True)
(ROOT / "logs" / "weather.json").write_text(json.dumps({
    "key": "US:62704:F", "unit": "F", "pos": {"lat": 39.77, "lon": -89.68}, "nws": None, "source": "nws",
    "fetched_at": NOW.isoformat(timespec="seconds"), "failed_at": None, "hours": hours, "days": days}))
print("seeded")
print(token)
