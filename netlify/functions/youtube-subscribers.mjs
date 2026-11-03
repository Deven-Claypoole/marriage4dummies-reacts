// Netlify Functions endpoint for the public Marriage4Dummies-Reacts YouTube subscriber count.
// Keep the Google API key in Netlify's YOUTUBE_API_KEY environment variable.
const CHANNEL_ID = 'UC9krtPrvVRzxBRuR7q4qeUQ';
const CHANNEL_URL = `https://www.youtube.com/channel/${CHANNEL_ID}`;
let cache = null;
let cacheExpires = 0;

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=0, s-maxage=120'}
});

export default async function handler(request) {
  if (request.method !== 'GET') return json({error:'Method not allowed'},405);
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return json({error:'Subscriber counter needs a YouTube API key in Netlify'},503);
  if (cache && Date.now() < cacheExpires) return json(cache);
  try {
    const endpoint = new URL('https://www.googleapis.com/youtube/v3/channels');
    endpoint.searchParams.set('part','snippet,statistics');
    endpoint.searchParams.set('id',CHANNEL_ID);
    endpoint.searchParams.set('key',key);
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),9000);
    let response;
    try { response=await fetch(endpoint,{signal:controller.signal}); }
    finally { clearTimeout(timeout); }
    if(!response.ok){
      console.error('YouTube subscriber API error:',response.status,(await response.text()).slice(0,450));
      return json({error: response.status===403 ? 'YouTube API key or quota needs attention' : 'YouTube count temporarily unavailable'},502);
    }
    const data=await response.json();
    const item=data.items?.[0];
    if(!item || item.id!==CHANNEL_ID)return json({error:'YouTube channel not found'},502);
    const hidden=Boolean(item.statistics?.hiddenSubscriberCount);
    const number=Number(item.statistics?.subscriberCount);
    if(!hidden && (!Number.isSafeInteger(number)||number<0))return json({error:'YouTube did not provide a subscriber total'},502);
    cache={name:item.snippet?.title||'Marriage4Dummies - Reacts',channelUrl:CHANNEL_URL,hidden,subscribers:hidden?null:number,rounded:true,source:'YouTube Data API'};
    cacheExpires=Date.now()+120000;
    return json(cache);
  }catch(error){console.error('Subscriber count request failed:',error?.message||error);return json({error:'Unable to contact YouTube right now'},502);}
}
