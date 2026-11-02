import { AccessToken } from 'livekit-server-sdk';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export default async function handler(request){
 if(request.method!=='POST')return reply(405,{error:'POST required'});
 const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,lkUrl=process.env.LIVEKIT_URL,key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET;
 if(!url||!anon||!lkUrl||!key||!secret)return reply(503,{error:'Voice calling needs server configuration.'});
 const bearer=request.headers.get('authorization')||'';
 if(!/^Bearer [^ ]+$/.test(bearer))return reply(401,{error:'Please sign in.'});
 const jwt=bearer.slice(7);
 let body;try{body=await request.json()}catch{return reply(400,{error:'Invalid request'})}
 if(body?.type!=='private'||!uuid.test(body?.friendId||''))return reply(400,{error:'A valid friend is required'});
 try{
  // Verify user identity with Supabase Auth, not untrusted request data.
  const userResponse=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,authorization:'Bearer '+jwt}});
  if(!userResponse.ok)return reply(401,{error:'Session expired. Sign in again.'});
  const user=await userResponse.json();if(!uuid.test(user?.id||'')||user.id===body.friendId)return reply(403,{error:'Invalid friend'});
  // Authenticate as the caller and reuse the site's existing friend/block rules.
  const permission=await fetch(url+'/rest/v1/rpc/m4d_can_message',{method:'POST',headers:{apikey:anon,authorization:'Bearer '+jwt,'content-type':'application/json'},body:JSON.stringify({recipient_id:body.friendId})});
 
if (!permission.ok) {
  console.error(
    'Voice permission RPC failed',
    'HTTP status:', permission.status,
    'Supabase error:', await permission.text()
  );
  return reply(403, {
    error: 'Cannot verify friendship and blocking permissions.'
  });
}

  const allowed=await permission.json();if(allowed!==true)return reply(403,{error:'You can only call accepted, unblocked friends.'});
  // Same pair always joins same room; random usernames and phone numbers not used.
  const room='m4d-private-'+[user.id,body.friendId].sort().join('-');
  const token=new AccessToken(key,secret,{identity:user.id,ttl:'15m'});
  token.addGrant({roomJoin:true,room,canPublish:true,canSubscribe:true,canPublishData:false,canUpdateOwnMetadata:false});
  return reply(200,{url:lkUrl,token:await token.toJwt()});
 }catch(e){console.error('Voice authorization failed',e);return reply(500,{error:'Unable to start voice call. Please try again.'})}
}
export const config={path:'/.netlify/functions/voice-token'};
