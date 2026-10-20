"""Screenshots of the saved demo for the website (assets/shots/). Needs Playwright with Chromium:
    pip install playwright && python -m playwright install chromium
    python tools/demo/shots.py http://127.0.0.1:8612/demo [OUT_DIR [TIME_ZONE]]
The base address serves the demo folder (python -m http.server from the site folder). The demo bar and first-visit tips
are hidden in the pictures."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip("/")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "assets" / "shots"
HIDE = "#demo-bar,#demo-note,.helptip{display:none!important}"

PC = [("pc-today", "index.html"), ("pc-calendar", "calendar_view_month.html"), ("pc-money", "money.html"),
      ("pc-month", "money_part_month.html"), ("pc-ledger", "money_part_ledger.html"), ("pc-add", "add.html"),
      ("pc-family", "family.html"), ("pc-wallet", "wallet.html"), ("pc-audit", "settings_audit.html"),
      ("pc-wall-settings", "settings_group_phones.html#wall-screen"), ("pc-routines", "family_routines.html"),
      ("pc-house", "family_house.html")]
WALL = [("wall-week", "wall_week.html"), ("wall-month", "wall_month.html"), ("wall-today", "wall.html"),
        ("wall-rest", "wall_rest.html"), ("wall-chores", "wall_chores.html")]
PHONE = [("phone-today", "index.html"), ("phone-month", "money_part_month.html"), ("phone-money", "money.html"),
         ("phone-family", "family.html"), ("phone-add", "add.html"), ("phone-wallet", "wallet.html"),
         ("phone-calendar", "calendar_view_week.html"), ("phone-kid", "kid/index.html")]


TZ = sys.argv[3] if len(sys.argv) > 3 else None  # the time zone the demo app ran in, so the wall's clock agrees


def shoot(browser, jobs, **ctx):
    page = browser.new_context(timezone_id=TZ, **ctx).new_page()
    for name, path in jobs:
        page.goto(f"{BASE}/{path}", wait_until="networkidle")
        page.add_style_tag(content=HIDE)
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / f"{name}.jpg"), type="jpeg", quality=82)
        print(name)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        shoot(b, PC, viewport={"width": 1440, "height": 900}, color_scheme="light")
        shoot(b, WALL, viewport={"width": 1280, "height": 800}, color_scheme="light")
        shoot(b, PHONE, viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
              color_scheme="light")
        b.close()


if __name__ == "__main__":
    main()
