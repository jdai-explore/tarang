# Tarang implementation plan

## Purpose and current state

Tarang is a mobile songbook for a non-commercial jamming session with roughly 200–500 readers. The leader selects a song and scroll position; joined phones follow through Ably Pub/Sub. The current GitHub/Vercel app already has numbered songs, a reader, preferences, ChordPro display, and working live sync. Redis is no longer used.

The next release has two goals: let an authorized leader recover control after a tab, browser, or device loss; and keep lyrics private until the leader makes a song available during a live session. These are product and data-access changes, not just new buttons.

## Decisions and boundaries

1. **One organizer identity for the first release.** The organizer signs in with a high-entropy recovery secret kept in a password manager. Store only its verifier server-side and issue a short-lived, Secure, HttpOnly, SameSite cookie after login. Never put the secret in a URL, browser local storage, Ably message, or repository. Add server-side rate limiting to login and code lookup. If multiple independent organizers are needed later, replace this with managed accounts rather than sharing a secret.
2. **One private durable store.** Use a small server-side database (for example, a free-tier Vercel Marketplace Postgres instance) for song metadata and lyrics, ordered playlists, and session records. Keep Ably solely for low-latency notifications. Do not rely on Ably's default two-minute history for session existence or leader recovery. Store the database credential only in Vercel server environment variables. A private Blob store could hold large files later, but is unnecessary for text songs.
3. **No public lyric source.** Move lyrics out of the public GitHub repository, static HTML, search indexes, build artifacts, and public JSON. A private repository alone is insufficient if Next.js still prerenders public lyrics. Song titles may be public only if the organizer chooses; the default pre-session page shows a join form and basic event information, not the catalog or lyrics.
4. **Access is time- and session-scoped, not copy protection.** A follower with a valid join code can read only the currently released song while the session is live. A leader can privately read and practice the whole library before the event. Once lyrics have appeared on someone's device, the site cannot prevent screenshots, copying, or previously saved content; `Cache-Control: no-store` reduces incidental retention but cannot erase what a person saw.

## Organizer library and playlist

- Provide an organizer-only library to add/edit songs, language or script variants, optional ChordPro, and a rehearsal view. Save drafts in the private store. Validate length, numbering, and text; publish only content the organizer has permission to share.
- Let the organizer create a named, ordered playlist from library songs, reorder it, and designate a current event playlist. This is a planning tool, not an advance public release. Playlist edits persist independently of live sessions.
- Start a session from a selected playlist. The leader sees the full playlist and can choose the next song. Followers receive only the active song's ID and scroll anchor; the API delivers that song's lyrics only after checking the live session. Do not put lyrics or the unreleased playlist in Ably messages.
- When the leader changes songs, commit the active song in the database, then publish a small Ably state event. A follower that reconnects fetches the authoritative session snapshot and current song from the server; an event is a prompt to refetch, not the sole source of truth.

## Leader recovery and session lifecycle

- Closing a tab must not end the event. The durable session record holds the active playlist, song, position, status, expiry, and a monotonically increasing revision. Ably's brief history is no longer the recovery mechanism. The leader can reopen Tarang, sign in on the same or another device, see the active event, and press **Resume leading**. If the prior browser still has a valid cookie, skip the login prompt; do not depend on local storage for authority.
- On resume, rotate a server-side leader lease/epoch. Only requests from the current lease may change song or position; the old tab becomes read-only and sees a takeover notice. This prevents two devices fighting over followers. Use a short renewable lease, atomic compare-and-swap updates, and a visible takeover action for the organizer. A normal tab close needs no special release call.
- Persist song changes immediately and position updates at a modest, throttled cadence; publish position changes through Ably at the existing capped rate. Show a reconnecting indicator and retry transient failures. After recovery, fetch the last saved position and let the leader confirm or adjust before broadcasting, avoiding a surprise jump for everyone.
- Explicit **End session** revokes further follower lyric access and token renewals, marks the record ended, and stops broadcasts. Session expiry is a backstop for forgotten events; it must not silently end an active session because a browser paused for two minutes. Rotate the join code for each event. Do not promise remote deletion of lyrics already displayed.

## Follower access and security

- Use an unguessable, event-specific join code or link. The current six-hex-character code is too small for a gated lyric API; increase entropy (for example, 10 random Base32 characters) and rate-limit lookups. The code is a capability to join the live event, not an organizer credential. Avoid putting it in analytics or referrer-leaking URLs where possible.
- All lyric routes run server-side with authorization and `Cache-Control: private, no-store`; disable static generation, CDN caching, and public API enumeration for protected content. Each request verifies that the session is live and that the requested song is the current released song. A follower cannot request a future song merely by changing a URL. Keep organizer endpoints behind the organizer cookie and server-side role checks.
- Issue Ably subscribe-only tokens for the one active session channel, with short TTL and renewal checks against session status. Never expose the Ably API key. Rate-limit session creation, login, join, and lyric fetch endpoints. Use TLS, normal CSRF protections for cookie-authenticated writes, and avoid logging secrets or full lyric bodies.
- If the intended meaning is **no lyric until each song is selected**, this design enforces it. If the organizer wants the full playlist unlocked at session start instead, make that an explicit policy choice before implementation; do not accidentally leak it through the UI or APIs.

## Implementation sequence

1. **Private content foundation:** Provision the durable store and organizer credential; add schema/migrations, server-only data access, authentication, and an organizer library/playlist UI. Import the existing two songs, then remove their lyrics from the public repo. Verify old static URLs, build output, and APIs no longer disclose them. Removing them from future versions cannot erase Git history and external copies.
2. **Session durability and recovery:** Store session state and current leader epoch in the database; add resume/takeover, atomic leader authorization, throttled state persistence, explicit end, and reconnect snapshots. Keep the existing Ably broadcast transport. Test close/reopen, another-device takeover, stale-tab rejection, and network loss.
3. **Gated follower reader:** Replace public prerendered lyric pages/catalog with the join-first experience and authorized current-song API. Change browser navigation and Ably events to use only the active song. Test direct URL access, guessed future song IDs, expired sessions, token renewal, and cache headers.
4. **Release safely:** Deploy to a protected preview, test organizer practice and two follower browsers across song changes/recovery/end, then merge. Confirm production redirects and old URLs do not expose lyrics. Load-test 200–400 readers and validate Ably message/connection and database request limits before an event; 500 followers plus a leader exceeds Ably's free 500-connection cap.

## Later possibilities

Multiple organizer accounts, shared setlists, next-event information, games, and pickup-lot signup are separate follow-ons. Signup and games require their own data retention and privacy design.
