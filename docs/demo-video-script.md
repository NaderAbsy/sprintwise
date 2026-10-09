# Demo video script (about 3 minutes)

`pnpm record-demo --voice` records this script with a natural AI voice-over and matching captions (`docs/demo.mp4` and `docs/demo.webm`). The voice is [Kokoro](https://github.com/hexgrad/kokoro), an open-source neural model (Apache 2.0) that runs locally with no account or cost; the first run downloads it (about 300 MB). It needs `brew install ffmpeg`. Without `--voice` it records captions only. Choose a voice with `DEMO_VOICE`: `af_heart` (default, US), `am_michael` (US), `bf_emma` or `bm_george` (UK).

The narration lives in `src/demo/video-lines.json`, which is also the transcript under the video on the home page.

**Where it's filmed:** a local production build with test sign-in and the pretend Jira, never the live site:

```bash
export ENABLE_TEST_SIGN_IN=true JIRA_FAKE=true BETTER_AUTH_URL=http://localhost:3100
pnpm build && pnpm start --port 3100
pnpm record-demo --voice
```

Before filming, the script signs up a test user ("Sam Taylor") and, off camera, creates an empty "Online shop" project, a "Tidyhome app" project with the 12 sample stories, three finished sprints of invented work (for the velocity), and an empty Sprint 12. The public pages are filmed signed out; then the same browser signs in for the rest. Everything on screen is invented. The share dialog shows the live site's address, since the link it makes would have that address on the live site.

**Publishing:** copy smaller encodes to `public/media/` (MP4 `-crf 30`, WebM VP9 `-crf 48`), and refresh `demo-poster.webp` from a frame of the opening scene.

| Scene | On screen | Line in `video-lines.json` |
| --- | --- | --- |
| Home | Hero, then the AI-draft example | `intro`, `answer`, `aiDraft` |
| Demo backlog | Weakest first; open TIDY-103 "Fast and easy checkout" | `rules`, `weak`, `noAi` |
| Score your own | Type a vague title, score it, add a description, criteria and points, score again | `tryIt`, `climbs` |
| Sample sprint | Metrics, then the finding banner | `baseline`, `metrics`, `finding` |
| Trends | The trends section of the demo | `trends` |
| Report | `/demo/report`, the burn-up and the print button | `report` |
| Jira (signed in) | Online shop → Import: the Jira search, preview, import 3 issues | `jira` |
| Refinement | Tidyhome app → Refinement, next story | `refine` |
| Share | Backlog → Share → Create link | `share` |
| Planning | Sprint 12: tick four stories; the helper shows the usual points and an unready story | `planning` |
| Close | The home page, signed out: Try the demo, then Sign in with GitHub | `start`, `close` |
