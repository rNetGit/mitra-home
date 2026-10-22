"""Save a running demo install (tools/demo/make_install.sh) as the website's read-only demo in demo/.

    python tools/demo/build_demo.py http://127.0.0.1:8611 INSTALL_DIR [OUT_DIR]

Walks the app's pages (adult view, Mitra Wall, a child's view), saves each as a flat .html file named after its address
(/records?domain=people&section=classes -> records_domain_people_section_classes.html), points links between saved pages
at each other, sends every other link, form and request to a "Demo only" note, and copies the static files.
Standard library only. The install's data is invented (seed_rivera.py); nothing real goes into the demo.
"""
import html
import http.cookiejar
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from collections import deque
from pathlib import Path

BASE = sys.argv[1].rstrip("/")
INST = Path(sys.argv[2])
OUT = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(__file__).resolve().parents[2] / "demo"
WEBSITE = "../index.html"
PHONE_DEMO = "../phone-demo.html"  # the page with the QR that opens the phone app's demo household

# Pages a visitor can walk to. Query keys that pick a page part are kept; anything else (dates, searches, record ids,
# filters) would multiply pages and is sent to the note.
ADULT_START = ["/", "/calendar?view=week", "/calendar?view=month", "/calendar?view=year", "/add", "/money", "/family",
               "/family/house", "/family/routines", "/wallet", "/notes", "/chat", "/settings", "/work", "/help",
               "/settings/audit", "/add/photo?kind=dates", "/add/photo?kind=recipe"]
ALLOWED_PATHS = re.compile(r"^/($|calendar$|add$|add/photo$|money$|family$|family/house$|family/routines$|records$|"
                           r"wallet$|wallet/park$|notes$|chat$|settings$|settings/audit$|work$|help$)")
KEEP_KEYS = {"view", "part", "domain", "section", "group", "tab", "g", "kind", "car"}
WALL_PAGES = ["/wall", "/wall/week", "/wall/month", "/wall/chores", "/wall/lists", "/wall/meals", "/wall/rest",
              "/wall/money"]
KID_PAGES = ["/"]
MAX_PAGES = 160

DEMO_HEAD = """<script>
(function(){
  function note(){var n=document.getElementById('demo-note');if(!n)return;n.hidden=false;clearTimeout(n._t);n._t=setTimeout(function(){n.hidden=true},2600);}
  window.fetch=function(){note();return new Promise(function(){});};
  var X=XMLHttpRequest.prototype;X.open=function(){};X.send=function(){note();};X.setRequestHeader=function(){};
  document.addEventListener('DOMContentLoaded',function(){  // saved charts: scale with the page instead of a fixed width
    document.querySelectorAll('.chart svg').forEach(function(s){
      if(!s.getAttribute('viewBox')){var w=parseFloat(s.getAttribute('width')),h=parseFloat(s.getAttribute('height'));
        if(w&&h){s.setAttribute('viewBox','0 0 '+w+' '+h);s.removeAttribute('width');s.removeAttribute('height');}}
    });
  });
  if(navigator.serviceWorker){navigator.serviceWorker.register=function(){return Promise.resolve();};}
  document.addEventListener('submit',function(e){e.preventDefault();note();},true);
  document.addEventListener('click',function(e){var a=e.target.closest('[data-demo]');if(a){e.preventDefault();note();}},true);
})();
</script>"""
DEMO_STYLE = """<style>#demo-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:9999;background:#173826;color:#fff;font:13px/1.4 system-ui,Segoe UI,sans-serif;padding:8px 14px;border-radius:999px;display:flex;gap:12px;align-items:center;box-shadow:0 4px 18px rgba(0,0,0,.25);max-width:calc(100% - 24px);flex-wrap:wrap;justify-content:center}
#demo-bar a{color:#BFE3CD}
.chart>div{width:100%!important;height:auto!important}
.chart svg{position:static!important;width:100%!important;height:auto!important;display:block}@media (max-width:760px){#demo-bar{bottom:84px;padding:6px 12px}#demo-bar span{display:none}.helptip{display:none!important}}</style>"""
NOTE = ('<div id="demo-note" hidden style="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000;'
        'background:#1F2328;color:#fff;padding:10px 16px;border-radius:10px;font:14px system-ui,Segoe UI,sans-serif;'
        'box-shadow:0 4px 16px rgba(0,0,0,.3)">Demo only: in your own copy this would save.</div>')


def bar(prefix, links):
    a = "".join(f'<a href="{prefix}{href}">{label}</a>' for label, href in links)
    return f'<div id="demo-bar"><strong>Demo</strong><span>Made-up Rivera family. Nothing you click is saved.</span>{a}</div>'


def opener(cookies=None):
    jar = cookies or http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar


def norm(url):
    """An app address -> (path, kept query) or None when it is not a page we save."""
    u = urllib.parse.urlsplit(html.unescape(url))
    if u.scheme or u.netloc:
        return None
    path = u.path or "/"
    q = [(k, v) for k, v in urllib.parse.parse_qsl(u.query) if k in KEEP_KEYS]
    if len(q) != len(urllib.parse.parse_qsl(u.query)):
        return None
    return path, urllib.parse.urlencode(q)


def fname(path, query, prefix=""):
    stem = path.strip("/").replace("/", "_") or "index"
    for k, v in urllib.parse.parse_qsl(query):
        stem += f"_{k}_{re.sub(r'[^A-Za-z0-9]+', '-', v)}"
    return prefix + stem + ".html"


def get(op, url):
    with op.open(BASE + url, timeout=60) as r:
        return r.geturl(), r.read().decode("utf-8")


def crawl(op, starts, allowed, limit, follow=True):
    pages, queue, seen = {}, deque(), set()
    for s in starts:
        n = norm(s)
        if n and n not in seen:
            seen.add(n)
            queue.append(n)
    while queue and len(pages) < limit:
        path, query = queue.popleft()
        url = path + ("?" + query if query else "")
        try:
            final, body = get(op, url)
        except Exception as e:  # noqa: BLE001
            print("skip", url, e)
            continue
        if urllib.parse.urlsplit(final).path != path:  # a redirect (login, setup): not a page of its own
            print("redirected", url, "->", final)
            continue
        pages[(path, query)] = body
        if not follow:
            continue
        for href in re.findall(r'href="([^"#]+)', body):
            n = norm(href)
            if n and n not in seen and allowed.match(n[0]):
                seen.add(n)
                queue.append(n)
    return pages


def rewrite(body, names, prefix, demo_bar, extra=""):
    """Saved-page links -> files; static -> static/; anything else -> the demo note."""
    def attr(m):
        name, val = m.group(1), m.group(2)
        raw = html.unescape(val)
        if raw.startswith("/static/"):
            return f'{name}="{prefix}static/{raw[8:]}"'
        if raw.startswith("/tokens.css"):
            return f'{name}="{prefix}static/tokens.css"'
        ph = re.match(r"^/(?:settings/)?wall/photo/([0-9a-f]{16}\.jpg)$", raw)
        if ph:
            return f'{name}="{prefix}wall_photo/{ph.group(1)}"'
        if name != "href":
            return m.group(0)
        frag = ""
        if "#" in raw:
            raw, frag = raw.split("#", 1)
            frag = "#" + frag
            if not raw:
                return m.group(0)
        n = norm(raw)
        if n and n in names:
            return f'href="{names[n]}{frag}"'
        return 'href="#" data-demo="1"'
    body = re.sub(r'\b(href|src|data-src|data-photo|content)="(/[^"]*)"', attr, body)
    body = re.sub(r"(data-photos=)(['\"])(.*?)\2", lambda m: m.group(1) + m.group(2) + m.group(3).replace("/wall/photo/", prefix + "wall_photo/") + m.group(2), body)
    body = re.sub(r'<link rel="manifest"[^>]*>', "", body)
    venv = Path(sys.executable).parent.parent
    for where, fake in ((INST, "/Users/rivera/MitraHome"), (venv, "/Users/rivera/MitraHome/.venv"),
                        (INST.parent, "/Users/rivera")):  # this machine's folders -> invented ones
        for form in sorted({str(where), str(where.resolve()), str(where).replace("/private/", "/", 1)}, key=len, reverse=True):
            body = body.replace(form, fake)
    body = re.sub(r'(name="csrf-token" content=")[^"]*', r"\1demo", body)
    body = body.replace('<meta charset="utf-8">', '<meta charset="utf-8">' + DEMO_HEAD, 1)
    body = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + DEMO_STYLE + demo_bar + NOTE, body, count=1)
    body = re.sub(r"<body", "<body" + extra, body, count=1)
    return body


def save_set(pages, prefix, demo_bar, extra=""):
    names = {k: fname(*k) for k in pages}
    for k, body in pages.items():
        out = OUT / prefix / names[k]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(rewrite(body, names, "../" * prefix.count("/"), demo_bar, extra), encoding="utf-8")
    return names


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    # 1) adults (the install has no PINs yet, so this PC gets an open session)
    op, _ = opener()
    adult = crawl(op, ADULT_START, ALLOWED_PATHS, MAX_PAGES)
    # 2) the Mitra Wall (the wall's cookie from seed_rivera.py)
    token = (INST / "logs" / "demo_wall_token.txt").read_text().strip()
    wjar = http.cookiejar.CookieJar()
    wjar.set_cookie(http.cookiejar.Cookie(0, "mh_wall", token, None, False, urllib.parse.urlsplit(BASE).hostname, False,
                                          False, "/wall", True, False, None, False, None, None, {}))
    wop, _ = opener(wjar)
    wall = crawl(wop, WALL_PAGES, re.compile(r"^/wall"), 20, follow=False)
    # 3) a child's view: give the throwaway install PINs, then sign in as the youngest child
    subprocess.run([sys.executable, "-c",
                    "import sys; sys.path.insert(0, 'data'); import auth; "
                    "auth.set_user('Marcus', 'adult', '482915'); auth.set_user('Mateo', 'limited', '730264')"],
                   cwd=INST, check=True)
    kop, _ = opener()
    kop.open(urllib.request.Request(BASE + "/login", data=urllib.parse.urlencode(
        {"name": "Mateo", "pin": "730264"}).encode(), method="POST"), timeout=30).read()
    kid = crawl(kop, KID_PAGES, re.compile(r"^/$"), 6, follow=False)

    links = [("See the Mitra Wall", "wall.html"), ("See a child's view", "kid/index.html"), ("Phone app demo", PHONE_DEMO), ("Website", WEBSITE)]
    names = save_set(adult, "", bar("", links))
    save_set(wall, "", bar("", [("Back to the app", "index.html"), ("Phone app demo", PHONE_DEMO), ("Website", WEBSITE)]),
             extra=' data-rest-url="wall_rest.html" data-home-url="wall.html"')
    save_set(kid, "kid/", bar("../", [("Back to the parents' view", "index.html"), ("Phone app demo", PHONE_DEMO), ("Website", WEBSITE)]))

    # static files, the CSS the app makes, the wall photos
    shutil.copytree(INST / "data" / "webapp" / "static", OUT / "static", ignore=shutil.ignore_patterns("sw.js"))
    (OUT / "static" / "tokens.css").write_text(get(op, "/tokens.css")[1], encoding="utf-8")
    (OUT / "wall_photo").mkdir()
    for p in sorted((INST / "wall_photos").glob("*.jpg")):
        shutil.copy2(p, OUT / "wall_photo" / p.name)
    print(f"saved {len(names)} adult pages, {len(wall)} wall pages, {len(kid)} child pages into {OUT}")


if __name__ == "__main__":
    main()
