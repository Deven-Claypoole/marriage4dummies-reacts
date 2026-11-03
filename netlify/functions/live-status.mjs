
/* Marriage4Dummies-Reacts Livestream Checker */

const CHANNEL_ID = 'UC9krtPrvVRzxBRuR7q4qeUQ';

const successHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-cache',
  'Netlify-CDN-Cache-Control':
    'public, durable, max-age=1800, stale-while-revalidate=300'
};

const errorHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

export default async function handler() {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.error('YOUTUBE_API_KEY is missing');

    return new Response(
      JSON.stringify({
        live: null,
        error: 'Livestream status unavailable'
      }),
      { status: 503, headers: errorHeaders }
    );
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      channelId: CHANNEL_ID,
      eventType: 'live',
      type: 'video',
      maxResults: '1',
      key: apiKey
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `YouTube API returned ${response.status}`
      );
    }

    const video = data.items?.[0];
    const videoId = video?.id?.videoId;

    const result = {
      live: Boolean(videoId),
      title: video?.snippet?.title || null,
      thumbnail:
        video?.snippet?.thumbnails?.high?.url ||
        video?.snippet?.thumbnails?.default?.url ||
        null,
      url: videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : null
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: successHeaders }
    );

  } catch (error) {
    console.error(
      'Live status check failed:',
      error?.message || error
    );

    return new Response(
      JSON.stringify({
        live: null,
        error: 'Livestream status unavailable'
      }),
      { status: 503, headers: errorHeaders }
    );
  }
}
