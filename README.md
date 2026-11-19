# Spotify Playlist Shuffler

[![CI](https://github.com/zabotg/spotify-playlist-shuffler/actions/workflows/ci.yml/badge.svg)](https://github.com/zabotg/spotify-playlist-shuffler/actions/workflows/ci.yml)

Spotify only has a normal shuffle that you can't control. This app connects to your Spotify account and reorders your playlists with smarter shuffle modes, shows insights about them and suggests new songs. It runs locally on your machine.

## Features

- **Shuffle modes**: pure random, artist-balanced, artist spacing, smooth BPM transitions, energy curves and mood sequences
- **Preview before saving**: sort the preview by any column, listen to short previews, then overwrite the playlist or save a new one
- **Insights**: duration, artist diversity, release decades, top artists, genres and audio characteristics
- **Discovery**: suggests songs from artists related to the ones in your playlist
- **Safe overwrite**: refuses to overwrite playlists with local files or episodes, because Spotify can't add them back

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router), React 19 and TypeScript
- Tailwind CSS 4
- [iron-session](https://github.com/vvo/iron-session) for encrypted cookie sessions
- [zod](https://zod.dev) for input and environment validation
- [Vitest](https://vitest.dev) for unit tests
- Spotify Web API (OAuth Authorization Code with PKCE) and the public Deezer API (BPM, previews and related artists)

## Running locally

**Requirements:** Node.js 20 or newer and a Spotify account.

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and add this Redirect URI:

   ```text
   http://127.0.0.1:3000/api/auth/callback
   ```

   Spotify does not accept `localhost` as a redirect host, so use `127.0.0.1`.

2. Install dependencies and create your env file:

   ```bash
   npm install
   cp .env.example .env
   ```

3. Fill in `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`, and generate a session secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

4. Start the app and open [http://127.0.0.1:3000](http://127.0.0.1:3000):

   ```bash
   npm run dev
   ```

## Scripts

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start the development server             |
| `npm run build`     | Create a production build                |
| `npm run start`     | Serve the production build               |
| `npm run lint`      | Run ESLint                               |
| `npm run typecheck` | Run the TypeScript compiler              |
| `npm run test`      | Run the unit tests                       |
| `npm run check`     | Run lint, typecheck and tests together   |

## Project structure

```text
app/
  api/                  Route handlers (thin: auth, validate, call a service)
  dashboard/            Playlist grid
  playlists/[id]/       Playlist page and its tabs (shuffle, insights, discover)
components/ui/          Reusable UI components
lib/
  auth/                 Session, PKCE and login errors
  config/               Validated environment variables
  domain/               Core types and constants, no framework code
  engines/              Pure algorithms: shuffle, insights, discovery
  services/             Use cases that combine Spotify, Deezer and the engines
  spotify/              Spotify API client, raw types and mappers
  deezer/               Deezer API client
  http/                 Error handling and security headers
  api/                  Typed client used by the browser
proxy.ts                Auth guard and security headers
```

The shuffle and insights engines are pure functions that receive a random source, so they are easy to test without network calls.

## API

| Method | Route                                    | Description                         |
| ------ | ---------------------------------------- | ----------------------------------- |
| GET    | `/api/playlists`                         | Playlists you own or collaborate on |
| POST   | `/api/playlists`                         | Create a playlist with tracks       |
| GET    | `/api/playlists/:id`                     | Playlist details                    |
| POST   | `/api/playlists/:id/shuffle`             | Preview a shuffled order            |
| PUT    | `/api/playlists/:id/tracks`              | Overwrite the track order           |
| POST   | `/api/playlists/:id/tracks`              | Add tracks                          |
| GET    | `/api/playlists/:id/insights`            | Playlist insights                   |
| GET    | `/api/playlists/:id/recommendations`     | New song suggestions                |

## Spotify API limitations

Spotify restricted its Web API for apps in Development Mode (November 2024 and February 2026):

- Development Mode apps need a Premium account and allow up to 5 authorized users
- Audio features (energy, mood, key) are not available to most new apps, so the energy curve and mood modes need extended access. The other modes work for everyone
- Track popularity, artist top tracks and recommendations were removed, so discovery uses related artists from Deezer and matches them with Spotify search
- BPM and audio previews come from Deezer, matched by ISRC

## Security

- Tokens never reach the browser: they live in an encrypted, `httpOnly` session cookie
- OAuth uses PKCE and a random `state` parameter against code interception and CSRF
- Every request body and query string is validated with zod
- Strict security headers, including a Content Security Policy
- No database: nothing about your account or listening history is stored

## License

[MIT](LICENSE)
