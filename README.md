# Spotify Playlist Shuffler

Smarter shuffle modes, playlist insights and music discovery for your Spotify playlists. Runs locally on your machine.

## Features

- **Shuffle modes**: pure random, artist-balanced, artist spacing, smooth BPM transitions, energy curves and mood sequences
- **Preview before saving**: reorder the preview by any column, then overwrite the playlist or save it as a new one
- **Insights**: duration, artist diversity, release decades, top artists, genres and audio characteristics
- **Discovery**: suggests new tracks from artists related to the ones in your playlist

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- Tailwind CSS
- [iron-session](https://github.com/vvo/iron-session) for encrypted cookie sessions
- [zod](https://zod.dev) for input validation
- Spotify Web API (OAuth Authorization Code + PKCE) and the public Deezer API (BPM and audio previews)

## Requirements

- Node.js 20 or newer
- A Spotify account and an app created in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

## Running locally

1. **Create a Spotify app** in the Developer Dashboard and add this Redirect URI:

   ```text
   http://127.0.0.1:3000/api/auth/callback
   ```

   Spotify does not accept `localhost` as a redirect host, so use `127.0.0.1`.

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from your Spotify app, and generate a session secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

4. **Start the app**

   ```bash
   npm run dev
   ```

   Open [http://127.0.0.1:3000](http://127.0.0.1:3000) and sign in with Spotify.

## Scripts

| Command         | Description                  |
| --------------- | ---------------------------- |
| `npm run dev`   | Start the development server |
| `npm run build` | Create a production build    |
| `npm run start` | Serve the production build   |
| `npm run lint`  | Run ESLint                   |

## Security

- Tokens never reach the browser: they live in an encrypted, `httpOnly` session cookie
- OAuth uses PKCE and a random `state` parameter to prevent code interception and CSRF
- No database: nothing about your account or listening history is stored

## License

[MIT](LICENSE)
