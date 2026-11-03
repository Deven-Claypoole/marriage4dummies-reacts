
const PLAYLIST_ID = 'PLEHx2jI2VxqdIn184F-ySzK7XwomXLA5c';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Netlify-CDN-Cache-Control':
        'public, durable, max-age=21600, stale-while-revalidate=86400'
    }
  });

export default async function handler(request) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const key = process.env.YOUTUBE_API_KEY;

  if (!key) {
    return json({
      error: 'YouTube API key is not configured in Netlify'
    }, 503);
  }

  const videos = [];
  const seen = new Set();
  let nextPage = '';
  let partial = false;

  try {
    for (let page = 0; page < 40; page++) {
      const url = new URL(
        'https://www.googleapis.com/youtube/v3/playlistItems'
      );

      url.searchParams.set('part', 'snippet');
      url.searchParams.set('playlistId', PLAYLIST_ID);
      url.searchParams.set('maxResults', '50');
      url.searchParams.set('key', key);

      if (nextPage) {
        url.searchParams.set('pageToken', nextPage);
      }

      const response = await fetch(url, {
        signal: AbortSignal.timeout(8500)
      });

      if (!response.ok) {
        if (!videos.length) {
          return json({
            error: 'YouTube playlist request unavailable'
          }, 502);
        }

        partial = true;
        break;
      }

      const payload = await response.json();

      for (const entry of payload.items || []) {
        const snippet = entry.snippet || {};
        const id = snippet.resourceId?.videoId;
        const title = snippet.title || '';

        if (
          !/^[A-Za-z0-9_-]{11}$/.test(id || '') ||
          !title ||
          title === 'Private video' ||
          title === 'Deleted video' ||
          seen.has(id)
        ) continue;

        seen.add(id);
        videos.push({ id, title });
      }

      nextPage = payload.nextPageToken || '';

      if (!nextPage) break;
    }

    return json({
      videos,
      playlistId: PLAYLIST_ID,
      partial: partial || !!nextPage
    });
  } catch (error) {
    console.error('Juice reactions:', error.message);

    return json({
      error: 'Playlist loading unavailable'
    }, 502);
  }
}
