# Rebuilding the demo and the screenshots

The demo (`demo/`) and the pictures in `assets/shots/` come from a throwaway install of the app, seeded with the
made-up Rivera family. Nothing real goes in. Run these after a release, from this folder's repository root.

You need: a checkout of `mitra-home-ai-agent`, a Python 3.12+ environment with its `requirements.txt` installed, and
for the screenshots `pip install playwright && python -m playwright install chromium`.

1. Make the install (wiped and made again each time; it must be fresh, because step 3 gives it PINs):

   ```
   TZ=Asia/Tokyo tools/demo/make_install.sh ../mitra-home-ai-agent /tmp/mh-demo/inst /path/to/venv/bin/python
   cd /tmp/mh-demo/inst && TZ=Asia/Tokyo MITRAHOME_NO_SCHEDULER=1 sh -c \
     "python data/apply_rules.py; python data/proposals.py sync; python data/audit.py run"
   ```

   `TZ` picks the clock the demo shows: choose a zone where it is daytime now, so Today and the Mitra Wall look like
   the middle of the day. Use the same zone in every step.

2. Start it: `TZ=Asia/Tokyo MITRAHOME_NO_SCHEDULER=1 python data/web_app.py --port 8611` (in the install folder).

3. Save the pages: `TZ=Asia/Tokyo python tools/demo/build_demo.py http://127.0.0.1:8611 /tmp/mh-demo/inst`
   (replaces `demo/`; this machine's folders are replaced by `/Users/rivera/...` and session tokens by `demo`).

4. Screenshots: serve this folder (`python -m http.server 8612`) and run
   `python tools/demo/shots.py http://127.0.0.1:8612/demo /tmp/mh-demo/shots Asia/Tokyo`, then copy the ones the pages
   use (`grep -oh 'shots/[a-z-]*\.jpg' *.html | sort -u`) into `assets/shots/`.

5. Before committing, search `demo/` for anything of this machine: your user name, `/tmp`, `/private`.

Files: `family.json` (the Riveras), `seed_rivera.py` (money, dates, cars, papers, lists, the Mitra Wall, weather
cache; dates relative to today), `wall_photos.py` (drawn landscapes for the wall's photo turns), `make_install.sh`,
`build_demo.py`, `shots.py`.
