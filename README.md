# tarang

A mobile songbook for live jamming sessions. The public site shows numbered songs with supplied lyrics, search, a dark/light theme, and adjustable lyric text size.

## Run locally

Install Node.js 20 or newer, then run `npm install` and `npm run dev`. Open `http://localhost:3000`. For live sessions, set `REDIS_URL` to a Redis endpoint with pub/sub support. Without it, the independent songbook still works but session creation returns 503.

## Update songs

Edit `content/songs.json`. Each entry needs a unique positive `number`, a `title`, `titleHindi`, `film`, `language`, and `lyrics`. Songs with `lyrics: null` are drafts and are omitted from the public site. Lyric line breaks can be written as `\n` inside the JSON string. Optional `chordPro` text uses `[Am]` chord markers; preview pasted chord text at `/tools/chordpro/` and review it before committing. Only publish lyrics and chords you have permission to use. Run `npm run build` to validate and build the site.

## Deploy

Import this GitHub repository into Vercel as a Next.js project and set the production branch to `main`. The song pages are statically generated, while `/api/live` uses Vercel Functions. Configure `REDIS_URL` with a TLS-enabled Redis connection that supports pub/sub, then assign `tarang.vercel.app` in Vercel project settings and verify it resolves to production. Review preview deployments before merging content changes. A session leader's private token is stored in that browser's local storage; share only the six-character join code. Sessions expire after eight hours.

## Test live coordination

With Redis running and `REDIS_URL` set, run `npm run build`, `npm run start`, then `node scripts/load-test.mjs`. The script sends 120 updates over roughly 30 seconds and measures Redis fan-out to 500 simulated listeners. It does not establish 500 browser WebSockets or prove Vercel plan capacity. Complete a deployed multi-device and 500-connection test before relying on live sync at an event.

See `PLAN.md` for the roadmap and launch checks.
