Marriage4Dummies-Reacts Automatic Video Search

1. Create a Google Cloud project and enable YouTube Data API v3.
2. Create an API key and restrict it to YouTube Data API v3. Keep it secret.
3. On Netlify, open your existing site > Site configuration > Environment variables. Add YOUTUBE_API_KEY with the key as value, scope including Functions.
4. Deploy this complete folder to the SAME Netlify site, using Netlify CLI or a Git-connected repository. Note: plain drag-and-drop deployments may not build Netlify Functions; use a Git repository deployment if functions are missing.
5. Check https://YOUR-SITE.netlify.app/.netlify/functions/youtube-videos . It should return JSON with videos.
6. Open the site and search for a video title. The backend caches responses; CDN caches responses as well.

Notes: The Nene Royal playlist ID may be incomplete. The API only indexes publicly accessible videos. Each playlist is capped at 1000 videos to bound runtime. The index refreshes when the endpoint is requested and its cache expires; this is not a guaranteed timed background sync. Netlify Function runtime limits may require reducing the per-playlist cap for very large playlists.
