# ![Spotify Playlist Shuffler](./assets/banner.svg)

Spread an artist’s tracks across a playlist, smooth out jumps in tempo, or
build toward a high-energy finish. Preview the order, then save it as a new
Spotify playlist or apply it to the original.

[Setup](#setup) · [Shuffle modes](#shuffle-modes) · [Troubleshooting](#troubleshooting) · [Development](#development)

## Shuffle modes

| Mode                   | How it works                                                      |
| ---------------------- | ----------------------------------------------------------------- |
| Pure random            | Shuffles all tracks at random.                                    |
| Artist-balanced        | Distributes each artist’s tracks more evenly across the playlist. |
| Artist spacing         | Leaves room between songs by the same artist.                     |
| Smooth BPM transitions | Keeps tempo changes gradual from one track to the next.           |
| Energy curves          | Arranges tracks along an energy curve, such as a gradual build.   |
| Mood sequences         | Orders tracks by mood to create a progression.                    |

Shuffle runs in your browser. You can sort the result before saving.
The app blocks overwrites for playlists with local files or podcast episodes
because Spotify can’t add those items back.

## Explore a playlist

- **Tracks:** Search and sort by title, artist, album, contributor, date added,
  duration or release year. Compare BPM, key, energy, danceability, mood,
  acousticness, instrumentalness, loudness and popularity where available.
- **Previews:** Press ▶ to hear a 30-second clip when one is available.
- **Insights:** See total play time, artist diversity, release decades, top
  artists and genres, plus average BPM, mood and other audio characteristics.
- **Discover:** Explore suggestions from related artists and add the songs you like.

## Setup

**Requirements:** Node.js 20 or newer and a Spotify account. Spotify requires the app owner to have **Premium** for apps in Development Mode.

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
6. Optional: to let other people sign in, add their Spotify email under **User Management**. Apps in Development Mode accept up to 5 users.

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

If you open `localhost:3000` instead, you're redirected to `127.0.0.1` automatically.
Keep your `.env` private and never commit it.

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

| Data                                             | Source                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Playlists, tracks, who added them, artist genres | [Spotify Web API](https://developer.spotify.com/documentation/web-api)        |
| Tempo, key, energy, danceability, mood, loudness | [ReccoBeats](https://reccobeats.com)                                          |
| BPM fallback and popularity                      | [Deezer API](https://developers.deezer.com/api)                               |
| 30-second previews                               | Deezer, or [iTunes Search](https://performance-partners.apple.com/search-api) |
| Related artists for Discover                     | Deezer                                                                        |

None of them need an extra account or API key.

## Privacy

Everything runs on your machine. Your Spotify login stays in an encrypted cookie in your browser, and nothing is saved to a database.

## Development

### Tech stack

- [Next.js 16](https://nextjs.org) (App Router), React 19 and TypeScript
- Tailwind CSS 4
- [iron-session](https://github.com/vvo/iron-session) for the session cookie
- [zod](https://zod.dev) for input validation
- [Vitest](https://vitest.dev) for tests

### Scripts

| Command                 | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Start the development server                       |
| `npm run build`         | Create a production build                          |
| `npm run start`         | Serve the production build                         |
| `npm run lint`          | Run ESLint                                         |
| `npm run typecheck`     | Run the TypeScript compiler                        |
| `npm run test`          | Run the unit tests                                 |
| `npm run test:coverage` | Run the tests with a coverage report               |
| `npm run check`         | Lint, typecheck and test with coverage             |
| `npm run test:e2e`      | Smoke tests against a running app (start it first) |

Unit and component tests don't call real APIs and don't read your `.env`. The smoke tests in `test/e2e` call a running app over HTTP and only use routes that work without signing in.

### Project structure

```text
app/
  api/                    Route handlers
  dashboard/              Playlist grid
  playlists/[id]/         Playlist page and its tabs (tracks, shuffle, insights, discover)
components/ui/            Shared UI components
lib/
  domain/models/          Types and small helpers
  domain/engines/         Shuffle, insights, discovery and mood algorithms
  services/               Playlists, track data, users and discovery
  clients/                Spotify, ReccoBeats, Deezer and iTunes clients
  http/                   Route helpers, errors and security headers
  auth/                   Session, PKCE and token refresh
  config/                 Environment and app settings
  validation/             Input schemas
  api/                    Browser client for the app's API
  hooks/                  React hooks
  utils/                  Generic helpers
proxy.ts                  Auth and request checks for every route
test/                     Tests, mirroring the folders above, plus shared fixtures
```

### API

All routes need a signed-in session.

| Method | Route                                | Description                                    |
| ------ | ------------------------------------ | ---------------------------------------------- |
| GET    | `/api/playlists`                     | Playlists you own or collaborate on            |
| POST   | `/api/playlists`                     | Create a playlist with tracks                  |
| GET    | `/api/playlists/:id`                 | Playlist details                               |
| GET    | `/api/playlists/:id/tracks`          | Tracks in their original order with audio data |
| PUT    | `/api/playlists/:id/tracks`          | Replace the track order                        |
| POST   | `/api/playlists/:id/tracks`          | Add tracks                                     |
| GET    | `/api/playlists/:id/recommendations` | Song suggestions                               |
| POST   | `/api/tracks/details`                | BPM and popularity for up to 50 ISRCs          |
| GET    | `/api/tracks/preview`                | Preview URL for one track                      |
| GET    | `/api/artists/genres`                | Genres for up to 20 artists                    |

## License

[MIT](LICENSE)
