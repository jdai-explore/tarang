# tarang

A mobile songbook for live jamming sessions. The public site shows numbered songs with supplied lyrics, search, a dark/light theme, and adjustable lyric text size.

## Run locally

Install Node.js 20 or newer, then run `npm install` and `npm run dev`. Open `http://localhost:3000`. For live sessions, set `ABLY_API_KEY` on the server. Without it, the independent songbook still works and live controls are hidden.

## Update songs

Edit `content/songs.json`. Each entry needs a unique positive `number`, a `title`, `titleHindi`, `film`, `language`, and `lyrics`. Songs with `lyrics: null` are drafts and are omitted from the public site. Lyric line breaks can be written as `\n` inside the JSON string. Optional `chordPro` text uses `[Am]` chord markers; preview pasted chord text at `/tools/chordpro/` and review it before committing. Only publish lyrics and chords you have permission to use. Run `npm run build` to validate and build the site.

## Deploy

The GitHub `main` branch deploys to the Tarang Vercel project at `tarang-gray.vercel.app`. The song pages are statically generated. Set `ABLY_API_KEY` as an encrypted Vercel environment variable for the server; never use a `NEXT_PUBLIC_` prefix or put the key in GitHub. The server issues subscribe-only Ably tokens to browsers. It publishes initial session state and leader updates to a session channel, while Ably sends those updates to followers. Review preview deployments before merging content changes. A session leader's private token is stored in that browser's local storage; share only the six-character join code. Sessions expire after eight hours. The leader sends a state heartbeat each minute so new followers can retrieve it from Ably's default two-minute history.

## Test live coordination

After configuring Ably, test one leader and at least two followers on different browsers before an event. Ably's free plan currently allows 500 concurrent connections and 500 messages per second, counting deliveries to followers. The leader sends at most roughly one scroll update per 1.2 seconds. Plan for fewer than 500 total devices on the free tier, and measure real usage before an event; 500 followers plus the leader exceeds the free connection cap.

See `PLAN.md` for the roadmap and launch checks.
