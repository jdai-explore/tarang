# tarang

A mobile songbook for live jamming sessions. The public site shows numbered songs with supplied lyrics, search, a dark/light theme, and adjustable lyric text size.

## Run locally

Install Node.js 20 or newer, then run `npm install` and `npm run dev`. Open `http://localhost:3000`.

## Update songs

Edit `content/songs.json`. Each entry needs a unique positive `number`, a `title`, `titleHindi`, `film`, `language`, and `lyrics`. Songs with `lyrics: null` are drafts and are omitted from the public site. Lyric line breaks can be written as `\n` inside the JSON string. Only publish lyrics you have permission to use. Run `npm run build` to validate the data and produce static files in `out/`.

## Deploy

Import this GitHub repository into Vercel as a Next.js project and set the production branch to `main`. Static export is configured in `next.config.ts`; Vercel will serve the generated pages without a runtime database. Assign `tarang.vercel.app` in the Vercel project settings and verify it resolves to the production deployment. Review preview deployments before merging content changes.

See `PLAN.md` for the roadmap and launch checks.
