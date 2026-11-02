
const CHANNEL_ID = "UC9krtPrvVRzxBRuR7q4qeUQ";

export default async function handler() {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=120, s-maxage=300"
  };

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error("YouTube API key is not configured");
    }

    const params = new URLSearchParams({
      part: "snippet",
      channelId: CHANNEL_ID,
      eventType: "live",
      type: "video",
      maxResults: "5",
      key: apiKey
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message || "YouTube API request failed"
      );
    }

    const video = data.items?.[0];

    return new Response(JSON.stringify({
      live: Boolean(video),
      title: video?.snippet?.title || null,
      thumbnail: video?.snippet?.thumbnails?.high?.url || null,
      url: video
        ? `https://www.youtube.com/watch?v=${video.id.videoId}`
        : null
    }), { status: 200, headers });

  } catch (error) {
    console.error("Live status check failed:", error.message);

    return new Response(JSON.stringify({
      live: null,
      error: "Unable to check livestream status"
    }), { status: 503, headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }});
  }
}
