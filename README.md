# ![Spotify Playlist Shuffler](./assets/banner.svg)

Spread an artist’s tracks across a playlist, smooth out jumps in tempo, or
build toward a high-energy finish. Preview the order, then save it as a new
Spotify playlist or apply it to the original.

[Setup](#setup) · [Shuffle modes](#shuffle-modes) · [Troubleshooting](#troubleshooting)

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

Spotify supplies your playlists. [ReccoBeats](https://reccobeats.com), [Deezer](https://developers.deezer.com/api) and [iTunes](https://performance-partners.apple.com/search-api) fill in audio details, previews and suggestions, with no extra accounts or API keys.

## Privacy

Everything runs on your machine. Your Spotify login stays in an encrypted cookie in your browser, and nothing is saved to a database.

## License

[MIT](LICENSE)
