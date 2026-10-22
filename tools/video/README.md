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

## phone/ - a 41 second 16:9 demo walkthrough of the phone app (1920x1080)

Pairing screen, then Today, Calendar, Money, Family and Lists in the phone app's demo mode (the made-up Rivera
household), with a voice-over and the same words as captions. The scenes and the captions are in `phone/index.html`;
`phone/assets/` holds the six screenshots (`1-pairing.png` .. `6-lists.png`, shot from the demo) and the eight
voice-over clips `vo/s1.wav` .. `s8.wav`.

Render (in `tools/video/phone`, same environment variables as above):

```
npx --yes hyperframes@0.8.181 check
npx --yes hyperframes@0.8.181 render --crf 24 -o renders/mitra-home-phone-demo.mp4
```

The clips are committed so a render needs no speech model. To change the words, edit the caption and the matching
`<audio>` line in `index.html`, then make the clip again with `hyperframes tts` (voice `af_heart`, Kokoro, runs on this
machine). Kokoro needs `pip install kokoro-onnx soundfile` in a throwaway virtual environment (never the global
Python), pointed to with `HYPERFRAMES_PYTHON`; set each `<audio>` `data-duration` to the new clip's length.

The finished MP4 is not committed. The published copy is on YouTube (channel CLOUDWAREEDGE): https://youtu.be/GD40jC-bRiM.
