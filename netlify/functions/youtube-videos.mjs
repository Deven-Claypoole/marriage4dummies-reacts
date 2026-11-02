const playlists = [
  ['Juice WRLD Reactions','Hip-Hop','PLEHx2jI2VxqdIn184F-ySzK7XwomXLA5c'],
  ['Nene Royal Reactions','Rock','PLGAZwAsNbIiA'],
  ['Slipknot Reactions','Metal','PLEHx2jI2Vxqd6xV07I4ftTC0mnMeHHNoW'],
  ['Voctave Reactions','A Cappella','PLEHx2jI2VxqdcMh0a5RXyxy2UopORMOlX'],
  ['KISS Reactions','Classic Rock','PLEHx2jI2Vxqch7es-5NEgLphEFMK7Lynh'],
  ['Nightwish Reactions','Metal','PLEHx2jI2VxqcuYINog55IEsXsoWVc-Da8'],
  ['The Fat Electrician Reactions','Commentary','PLEHx2jI2Vxqfmh64_kXFN-dZ8_xC4eOgE'],
  ['Charlie Kirk Videos','Commentary','PLEHx2jI2Vxqez-pY4m02CaDYyjd2cm90Z'],
  ['Classic Rock Hits Reactions','Classic Rock','PLEHx2jI2VxqegUa8uIctE9zb5XY8k1syz'],
  ['Christian Worship Reactions','Worship','PLEHx2jI2VxqfhKqrnsWrorV3rdD3KlpmW']
];
let cached = null;
let expires = 0;
export default async function handler(request) {
  if (request.method !== 'GET') return new Response('Method not allowed',{status:405});
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return Response.json({error:'YOUTUBE_API_KEY not configured'},{status:503});
  if (cached && Date.now()<expires) return Response.json(cached, {headers:{'Cache-Control':'public, max-age=300, s-maxage=3600'}});
  const videos=[]; const errors=[];let playlistsLoaded=0;
  // Requests are limited to 50 results per page by YouTube. Cap at 20 pages per playlist.
  for (const [playlist,category,playlistId] of playlists) {
    try {
      let token='';let pages=0;
      do {
        const url=new URL('https://www.googleapis.com/youtube/v3/playlistItems');
        url.searchParams.set('part','snippet');url.searchParams.set('playlistId',playlistId);
        url.searchParams.set('maxResults','50');url.searchParams.set('key',key);
        if(token) url.searchParams.set('pageToken',token);
        const r=await fetch(url);
        if(!r.ok) throw new Error('YouTube API status '+r.status);
        const data=await r.json();
        for(const item of data.items||[]) {
          const id=item.snippet?.resourceId?.videoId;
          const title=item.snippet?.title;
          if(!id || !title || title==='Private video' || title==='Deleted video') continue;
          videos.push({title,category,artist:playlist,playlist,thumbnail:item.snippet?.thumbnails?.medium?.url||'',url:'https://www.youtube.com/watch?v='+encodeURIComponent(id),id});
        }
        token=data.nextPageToken||'';pages++;
      } while(token && pages<20);
      playlistsLoaded++;
    }catch(e){errors.push({playlist,message:e.message});}
  }
  const unique=[...new Map(videos.map(v=>[v.id,v])).values()];
  const payload={videos:unique,playlistsLoaded,errors,updatedAt:new Date().toISOString()};
  if(playlistsLoaded>0){cached=payload;expires=Date.now()+15*60*1000;}
  return Response.json(payload,{headers:{'Cache-Control':'public, max-age=300, s-maxage=3600'}});
}
