# ![Spotify Playlist Shuffler](./assets/banner.svg)

Spread an artist’s tracks across a playlist, smooth out jumps in tempo, or
build toward a high-energy finish. Preview the order, then save it as a new
Spotify playlist or apply it to the original.

[Setup](#setup) · [Shuffle modes](#shuffle-modes) · [Data sources](#data-sources) · [API](#api)

## Shuffle modes

| Mode | How it works |
| --- | --- |
| Pure random | Shuffles all tracks at random. |
| Artist-balanced | Distributes each artist’s tracks more evenly across the playlist. |
| Artist spacing | Leaves room between songs by the same artist. |
| Smooth BPM transitions | Keeps tempo changes gradual from one track to the next. |
| Energy curves | Arranges tracks along an energy curve, such as a gradual build. |
| Mood sequences | Orders tracks by mood to create a progression. |

Shuffle runs in your browser. You can sort the result before saving.
The app blocks overwrites for playlists with local files or podcast episodes
because Spotify can’t add those items back.

## Explore a playlist

- **Tracks** — Search and sort by title, artist, album, contributor, date added,
  duration or release year. Compare BPM, key, energy, danceability, mood,
  acousticness, instrumentalness, loudness and popularity where available.
- **Previews** — Press ▶ to hear a 30-second clip when one is available.
- **Insights** — See total play time, artist diversity, release decades, top
  artists and genres, plus average BPM, mood and other audio characteristics.
- **Discover** — Explore suggestions from related artists and add the songs you like.

## Setup

**Requirements** — Node.js 20 or newer and a Spotify account. Spotify requires the app owner to have **Premium** for apps in Development Mode.

### 1. Create a Spotify app

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and click **Create app**.
2. Fill in any name and description.
3. In **Redirect URIs**, add exactly:

   ```text
   http://127.0.0.1:3000/api/auth/callback
   ```

   Spotify doesn't accept `localhost`, so it must be `127.0.0.1`. There must be no trailing slash.

4. Under **Which API/SDKs are you planning to use?**, check **Web API**, accept the terms and save.
5. Open the app's **Settings** and copy the **Client ID** and **Client secret**.
6. Optional — to let other people sign in, add their Spotify email under **User Management**. Apps in Development Mode accept up to 5 users.

### 2. Configure and run

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable                | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| `SPOTIFY_CLIENT_ID`     | Client ID from your Spotify app                                                |
| `SPOTIFY_CLIENT_SECRET` | Client secret from your Spotify app                                            |
| `SPOTIFY_REDIRECT_URI`  | `http://127.0.0.1:3000/api/auth/callback` (same value as in the dashboard)     |
| `SESSION_SECRET`        | Random string with at least 32 characters. Generate one with the command below |

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Start the app and open [http://127.0.0.1:3000](http://127.0.0.1:3000):

```bash
npm run dev
```

If you open `localhost:3000` instead, the login redirects you to `127.0.0.1` automatically, because the session cookie has to be on the same host as the Spotify redirect.
`.env` is ignored by git. Never commit it.

### Troubleshooting

| Problem                                           | Fix                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `INVALID_CLIENT: Invalid redirect URI` on Spotify | The Redirect URI in the dashboard must be exactly the same as `SPOTIFY_REDIRECT_URI`                    |
| "Security check failed" after login               | Clear cookies for `localhost` and `127.0.0.1` and try again. Don't refresh the callback page            |
| Back on the home page after accepting             | Make sure you use `127.0.0.1:3000`, and that `SESSION_SECRET` didn't change while logging in            |
| 403 errors after login                            | Your Spotify account isn't in the app's **User Management** list, or the app owner doesn't have Premium |
| Some tracks have no audio data                    | ReccoBeats doesn't have every track. BPM falls back to Deezer when possible                             |
| A track shows × on the preview button             | Neither Deezer nor iTunes has a preview for it                                                          |

## Data sources

Spotify supplies the playlist. ReccoBeats, Deezer and iTunes fill in audio details, previews and discovery data without extra API keys.

| Data                                                | Source                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Playlists, tracks, who added them, artist genres    | [Spotify Web API](https://developer.spotify.com/documentation/web-api)              |
| Tempo, key, energy, danceability, mood, loudness... | [ReccoBeats](https://reccobeats.com) (by Spotify track ID)                          |
| BPM fallback and popularity (Deezer rank)           | [Deezer API](https://developers.deezer.com/api) (by ISRC)                           |
| 30 second previews                                  | Deezer, then [iTunes Search API](https://performance-partners.apple.com/search-api) |
| Related artists for Discover                        | Deezer                                                                              |

### How it stays fast

- The track list loads from Spotify and ReccoBeats right away. Deezer details (BPM fallback and popularity) load in the background in batches and fill in the table as they arrive, with progress shown under the playlist title.
- Deezer allows 50 requests every 5 seconds, so its calls go through a rate limiter and are retried instead of failing silently.
- Results from ReccoBeats, Deezer and user names are cached in memory while the server runs, so opening a playlist again is much faster.
- Previews are looked up only when you press play.
- Shuffle and insights are calculated in the browser from the tracks already loaded, with no extra requests.

## Scripts

| Command                 | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `npm run dev`           | Start the development server                        |
| `npm run build`         | Create a production build                           |
| `npm run start`         | Serve the production build                          |
| `npm run lint`          | Run ESLint                                          |
| `npm run typecheck`     | Run the TypeScript compiler                         |
| `npm run test`          | Run the unit tests                                  |
| `npm run test:coverage` | Run the tests with coverage (must stay at 100%)     |
| `npm run check`         | Run lint, typecheck and tests with coverage         |

### Tests

Unit tests use [Vitest](https://vitest.dev) and never call real APIs: `fetch` is mocked, and the environment comes from `test/setup.ts`, not your `.env`. Coverage is enforced at 100% (lines, branches, functions and statements) for the server code, domain logic, API clients, controllers, the proxy and the pure UI logic. CI runs the same check on every push.

## Project structure

The code is split in layers. Each one only depends on the layers below it.

```text
app/
  api/                    Controllers: thin route handlers (auth, validate, call a service)
  dashboard/              Playlist grid page
  playlists/[id]/         Playlist page and its tabs (tracks, shuffle, insights, discover)
    _components/track-table/  Table columns, sorting, rows and preview button
components/ui/            Reusable UI components
lib/
  domain/
    models/               Types and small helpers, no framework code
    engines/              Pure algorithms: shuffle, insights, discovery, mood
  services/               Use cases: playlists, track data (with caches), users, discovery
  clients/                Adapters for external APIs
    http/                 Shared transport: timeouts, bounded retries, JSON
    spotify/              Spotify Web API, OAuth, raw types and mappers
    reccobeats/           Audio features
    deezer/               BPM, popularity, previews and related artists (rate limited)
    itunes/               Preview fallback
  http/                   Controller helpers, error mapping, CSRF check, security headers
  auth/                   Session cookie, PKCE, token refresh
  config/                 Validated environment, app origin, allowed media hosts
  validation/             zod schemas for every input
  api/                    Typed client used by the browser, one file per resource
  hooks/                  React hooks (async actions, previews, background details)
  utils/                  Small generic helpers (arrays, caching, rate limiting, formatting)
proxy.ts                  CSRF guard for API writes, auth guard for pages, security headers
```

## API

| Method | Route                                | Description                                       |
| ------ | ------------------------------------ | ------------------------------------------------- |
| GET    | `/api/playlists`                     | Playlists you own or collaborate on               |
| POST   | `/api/playlists`                     | Create a playlist with tracks                     |
| GET    | `/api/playlists/:id`                 | Playlist details                                  |
| GET    | `/api/playlists/:id/tracks`          | Tracks in original order with audio features      |
| PUT    | `/api/playlists/:id/tracks`          | Overwrite the track order                         |
| POST   | `/api/playlists/:id/tracks`          | Add tracks                                        |
| GET    | `/api/playlists/:id/recommendations` | New song suggestions                              |
| POST   | `/api/tracks/details`                | BPM and popularity from Deezer for up to 50 ISRCs |
| GET    | `/api/tracks/preview`                | Preview URL for one track (Deezer, then iTunes)   |
| GET    | `/api/artists/genres`                | Genres for up to 20 artists                       |

## Security

- **Tokens stay on the server.** They live in an encrypted `HttpOnly`, `SameSite=Lax` cookie (`__Host-` prefixed and `Secure` in production). Expired tokens are refreshed once even when several requests arrive together.
- **OAuth with PKCE and `state`** against code interception and login CSRF. The state is single use.
- **CSRF protection for API writes.** `POST`/`PUT` requests must come from the app's own origin (`Origin` or `Sec-Fetch-Site`), because `SameSite` alone also trusts other apps on the same host.
- **No trust in request headers for redirects.** Redirects use the origin from `SPOTIFY_REDIRECT_URI`, never `Host` or `X-Forwarded-Host`.
- **Validated input everywhere.** Every body, query string and route parameter goes through zod. Bodies over 1 MB are rejected.
- **Safe external data.** Calls to external APIs have timeouts and bounded retries. Preview URLs are only passed on when they point to the allowed audio hosts. Shared caches are keyed by the request data itself, so one user can't change what another one sees.
- **Strict headers.** Content Security Policy (with `object-src 'none'` and `frame-ancestors 'none'`), `X-Frame-Options`, `nosniff`, COOP/CORP and HSTS in production.
- **Errors don't leak.** Clients get generic messages, and upstream response bodies and stack traces are never returned.
- **No database.** User names and track lookups are cached in memory while the server runs. Nothing is written to disk.

## License

[MIT](LICENSE)
