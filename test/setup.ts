// Fixed test configuration, so tests never depend on a developer's local .env file.
process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
process.env.SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3000/api/auth/callback';
process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
