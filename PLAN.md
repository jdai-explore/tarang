# Tarang implementation plan

## Purpose and audience

Tarang is a mobile songbook for a non-commercial live jamming session with 200–500 readers. A participant must be able to find and read a numbered song immediately on an Android or iPhone browser, without an account or app installation. During a live set, one leader can change songs and scroll while joined devices follow.

## Current foundation

The numbered list, search, reader, light/dark mode, and text-size preference are implemented. GitHub files hold song content; songs without lyrics are hidden. Next.js currently uses `output: "export"` to make static pages. No live service or Vercel project is configured yet.

## Target live experience

1. Participants can continue reading independently without joining a session.
2. A leader starts a session and shares a short join code or link. A private leader token protects controls; the public join code grants follower access only.
3. Joining opens the current song and shows a clear following/connection indicator. Leader song changes and scroll movements reach joined devices.
4. Followers can pause following to browse or scroll on their own, then resume at the leader's current position. Theme, text size, and optional chord visibility stay personal to each device.
5. If connectivity drops, lyrics remain readable. The client reconnects, reloads current session state, and resumes without a surprising jump.

## Architecture and free-tier feasibility

- Keep songs in reviewed GitHub files and prerender public song pages. Serve lyrics and assets from Vercel's CDN; send only small coordination events through the live channel.
- Remove static `output: "export"` when introducing a Vercel Function for WebSocket sessions. Keep song pages statically generated within the normal Next.js deployment.
- Prototype WebSockets on Vercel Functions. Hobby currently supports them, but connections close at the function's maximum duration (currently 300 seconds), requiring reconnect and state resync.
- Use a shared store with pub/sub across function instances for the current song, scroll position, session expiry, and broadcast. In-memory state will not reliably serve all participants. Check current free-tier capacity and terms of Redis or another managed real-time provider before choosing one.
- Allow one leader per session. Throttle scroll updates to roughly 2–4 per second while moving; send song changes immediately. Transmit a section/line anchor and fractional progress, rather than raw pixels, to account for different viewports and text sizes.
- Add sequence numbers to discard stale events. New or reconnected devices load a snapshot before following further events. Expire idle sessions and rotate leader tokens per event.

## Content workflow

`content/songs.json` is the starter catalog. Before an event, the organizer supplies lyrics they have permission to publish, confirms spelling and script, orders songs, and reviews a preview deployment. Each published song needs a stable number, title, language, and lyric text. If multiple scripts or translations are provided, each version must be labeled and selectable.

Add optional ChordPro text per song and a viewer that can hide chords. First support explicit `[Am]` chord markers and section directives. An organizer-only paste converter should show a preview for manual correction before content is committed to GitHub. Inferring correct chords from plain lyrics is outside the first synced release.

## Build sequence

1. **Live prototype:** Choose a shared-state service after checking its free-tier connection and message limits. Build leader/follower song selection and position broadcast, reconnect/resync, and protected leader actions.
2. **Product integration:** Add start/join/leave controls, follow status, resume-following, and an accessible leader control surface. Preserve independent reading.
3. **ChordPro:** Extend and validate the content schema, render optional chords, and add the reviewed paste-conversion workflow.
4. **Deployment:** Connect GitHub `main` to Vercel, set service credentials in Vercel, and verify that the production deployment uses `tarang.vercel.app`. Review previews before merging content changes.
5. **Event readiness:** Test Android Chrome, Samsung Internet, and iPhone Safari; varied viewport and text sizes; screen sleep and network changes; leader disconnect/rejoin; and 200–500 connected followers at realistic scroll rates. Measure latency, reconnect time, delivery consistency, and provider usage before deciding on paid capacity.

## Later possibilities

Add next-event information, games, or pickup-lot signup as separate features after live song following is reliable. Signup and games need their own data and privacy design.
