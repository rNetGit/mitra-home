#!/bin/sh
# Make (or remake) a throwaway Mitra Home install seeded with the made-up Rivera family.
#   tools/demo/make_install.sh APP_REPO INSTALL_DIR PYTHON
# APP_REPO = a checkout of mitra-home-ai-agent; INSTALL_DIR is wiped first; PYTHON has requirements.txt installed.
set -e
APP=$1; INST=$2; PY=$3
HERE=$(cd "$(dirname "$0")" && pwd)
rm -rf "$INST"
rsync -a --exclude .git --exclude __pycache__ --exclude '*.db' --exclude installer --exclude mobile --exclude dist \
  --exclude logs --exclude archive --exclude inbox --exclude reports --exclude brief --exclude exports \
  --exclude wall_photos --exclude wallet_drafts --exclude mitrahome_home.txt --exclude familyagent_home.txt \
  --exclude 'config/*' "$APP"/ "$INST"/
mkdir -p "$INST/config" "$INST/inbox" "$INST/logs"
cp "$HERE/family.json" "$INST/config/family.json"
cd "$INST"
export MITRAHOME_NO_SCHEDULER=1
"$PY" data/migrate.py >/dev/null
"$PY" data/members.py sync >/dev/null
"$PY" data/life.py seed >/dev/null
"$PY" "$HERE/seed_rivera.py" > logs/demo_seed.out
tail -1 logs/demo_seed.out > logs/demo_wall_token.txt
"$PY" "$HERE/wall_photos.py"
echo "install ready: $INST"
