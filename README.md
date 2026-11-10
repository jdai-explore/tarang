# Tarang

Tarang is a mobile live songbook for non-commercial jamming sessions. Approved Gmail leaders maintain a private song library and ordered playlists. One leader controls each live session; followers join with a code and receive only the current song and synchronized position. Followers do not sign in. Light/dark mode, text size, and chord visibility remain personal preferences.

## Setup

Use Node.js 22 or newer. Install with `npm ci` and run `npm run build` before deploying. The app needs these server-side Vercel variables (never commit their values or give them a `NEXT_PUBLIC_` prefix):

- `DATABASE_URL`: connected Neon Postgres database.
- `NEON_AUTH_BASE_URL`: Neon Managed Auth endpoint.
- `NEON_AUTH_COOKIE_SECRET`: random 32+ character cookie-signing key.
- `TARANG_OWNER_EMAIL`: the verified Gmail account that may approve or revoke other leaders.
- `ABLY_API_KEY`: Ably Pub/Sub key for live follower updates.

Configure both the production origin and the stable preview origin under **Neon Console → Auth → Configuration → Domains**. This project uses Neon's shared, Neon-branded Google OAuth app by explicit choice; Neon recommends custom OAuth credentials for production. Only the configured owner and explicitly approved leaders may access the library or control sessions. Google sign-in alone grants no leader authority.

The private schema is in `db/001_private_songbook.sql`. Apply it to the connected Neon database before using the private workspace. The initial two songs were imported from the former public JSON file during migration; all subsequent songs must be entered through the leader workspace. The repository does not carry lyric bodies. Existing Git history and old deployment URLs can still contain previously published lyrics.

## Use

Leaders sign in at `/leader/`, add songs, create an ordered playlist, and start a session. Share only the ten-character code. An approved leader can reopen the workspace and press **Resume leading**, or another approved leader can press **Take over**. Each takeover rotates a server-side control epoch so the previous leader's device can no longer update the session. End the session explicitly when done.

Followers open `/`, enter the code, and see only the currently selected song. They can pause or resume following. Tarang stores the authoritative session in Neon and sends small state events through Ably; it does not send lyrics in Ably messages. Follower song APIs are live-session scoped and marked `private, no-store`.

## Event checks

Before an event, test owner sign-in, an unapproved Google account, a second approved leader, takeover from another device, an old leader's rejected update, song change and scroll sync on Android and iPhone, reconnect after network loss, and end-session access denial. Measure connection and message use at realistic audience sizes. Ably's free-tier 500-connection cap does not accommodate 500 followers plus a leader; plan headroom or a paid tier for that size.

See [PLAN.md](PLAN.md) for detailed design decisions and remaining launch checks.
