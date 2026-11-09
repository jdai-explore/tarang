# Tarang implementation plan

## Purpose and audience

Tarang is a mobile songbook for a live jamming session with 200–500 readers. The primary user is a participant holding a phone who needs to find a numbered song and read it immediately. Android and iPhone browsers are first-class targets. No sign-in or app installation is required.

## First release

1. Show the active event's numbered song list on the home page. Support search by number and title.
2. Open a dedicated, readable page for each song. Display the prepared language/script and offer a one-tap return to the list.
3. Offer light and dark themes and adjustable lyric text size. Save these choices on the device.
4. Keep song and event content in reviewed GitHub files. Build static pages with Next.js and deploy the `main` branch through Vercel.
5. Publish at `tarang.vercel.app` after verifying that the Vercel project owns that address. Keep the site usable on slow mobile connections and test simultaneous access by 200–500 readers.

## Content workflow

`content/songs.json` is a starter catalog of song metadata, not a publishable lyric collection. Before an event, the organizer supplies lyrics they have permission to publish, confirms spelling and script, orders the songs, and reviews a Vercel preview deployment. Each song needs a stable number, title, language, and lyric text. If multiple scripts or translations are provided, each version should be explicitly labeled and selectable.

## Build sequence

1. Define an event and song schema, validate unique numbers and required fields at build time, and separate draft songs with missing lyrics from public songs.
2. Build the mobile song list, search, and song reader as statically rendered pages.
3. Add theme and text-size preferences, accessibility checks, and responsive layouts.
4. Connect GitHub to Vercel, configure the production domain, and verify preview and production deployments.
5. Test on representative Android and iPhone browsers, long Hindi lyrics, slow networks, and 200–500 concurrent readers before the first event.

## Later possibilities

Add a next-event page, games, or pickup-lot signup as separate features after the songbook works reliably. Signup or live games would require a data store and abuse/privacy decisions; static song reading does not.
