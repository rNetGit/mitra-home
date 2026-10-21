# Short videos of Mitra Home

Made with [HyperFrames](https://github.com/heygen-com/hyperframes) (Apache-2.0): each video is an HTML page animated
with GSAP, which HyperFrames plays frame by frame in headless Chrome and saves as an MP4 with FFmpeg. It renders on
this machine; no HeyGen account is needed. The pictures are the made-up Rivera family from `tools/demo/`, so nothing
real goes in.

You need Node 22+ and FFmpeg (`brew install ffmpeg` on a Mac, `winget install Gyan.FFmpeg` on Windows).

## tour/ - a 30 second 16:9 tour (1920x1080)

Title, Today, Calendar, Money and Wallet on the phone, the Mitra Wall, and an end card with the site's address.
Everything is in `tour/index.html`: the scenes are `<section>`s with `data-start` / `data-duration` (seconds), the
motion is one GSAP timeline at the bottom.

1. After `tools/demo/README.md` has refreshed `assets/shots/`, copy the pictures in (from this repository's root):

   ```
   cp assets/shots/{pc-today,pc-calendar,phone-money,phone-wallet,wall-week}.jpg assets/logo/mark.svg tools/video/tour/assets/
   ```

2. Check and render (in `tools/video/tour`; the version is pinned in `package.json` so renders stay the same):

   ```
   export HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1
   npx --yes hyperframes@0.8.181 check
   npx --yes hyperframes@0.8.181 render --crf 24 -o renders/mitra-home-tour.mp4
   ```

   About 30 seconds on an M3; the file is about 6.5 MB. `npx --yes hyperframes@0.8.181 preview` opens a live preview.
   `HYPERFRAMES_NO_TELEMETRY=1` turns off HyperFrames' anonymous render statistics; `HYPERFRAMES_SKIP_SKILLS=1` stops
   it installing its agent skills into this folder.

3. Look at it, then copy `renders/mitra-home-tour.mp4` to `assets/video/` when the site should use it.

`AGENTS.md` and `CLAUDE.md` in `tour/` come from `hyperframes init` (notes for coding agents). The text uses Inter
from Google Fonts, so the render needs the internet once and looks the same on the Mac and the PC.
