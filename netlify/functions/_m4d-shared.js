const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const appId = 'c43c6075-5953-4ea7-98d7-2b0e887322e5';
const homepage = 'https://marriage4dummies-reacts.netlify.app';
function env(key){const v=process.env[key];if(!v)throw Error('Server setup missing '+key);return v;}
function db(){return createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});}
const reply=(status,obj)=>({statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(obj)});
function safeLink(input){
  const value=(input||'/').trim();
  if(value.startsWith('/')&&!value.startsWith('//'))return homepage+value;
  try{const u=new URL(value);if(u.protocol!=='https:')throw Error('Only HTTPS links are allowed');
   const allowed=new Set(['marriage4dummies-reacts.netlify.app','youtube.com','www.youtube.com','youtu.be']);
   if(!allowed.has(u.hostname))throw Error('Link must point to M4D or YouTube');return u.toString();
  }catch(e){throw Error('Invalid notification link: '+e.message)}
}
function idem(id,part){const h=crypto.createHash('sha256').update(String(id)+':'+part).digest('hex').slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
async function sendToOneSignal(event, userIds, part){
  if(!userIds.length)return {id:null};
  const payload={app_id:appId,headings:{en:event.title.slice(0,100)},contents:{en:event.body.slice(0,240)},url:safeLink(event.target_url),target_channel:'push',include_aliases:{external_id:userIds},idempotency_key:idem(event.id,part)};
  const result=await fetch('https://api.onesignal.com/notifications',{method:'POST',headers:{Authorization:'Key '+env('ONESIGNAL_REST_API_KEY'),'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const response=await result.json().catch(()=>({}));
  if(!result.ok)throw Error('OneSignal '+result.status+': '+JSON.stringify(response).slice(0,300));
  // A successful response with no ID can still mean nobody has an active push subscription.
  return response;
}
async function matchingRecipients(client,event){
  if(event.recipient_id){
    const {data,error}=await client.from('m4d_notification_preferences').select(event.category).eq('user_id',event.recipient_id).maybeSingle();
    if(error)throw error;
    return data&&data[event.category]===false?[]:[event.recipient_id];
  }
  // Respect preferences for broadcast recipients, too. Only registered M4D members
  // linked via OneSignal.login(user.id) can receive personalized/broadcast alerts.
  const ids=[];for(let page=1;page<=200;page++){
    const {data,error}=await client.auth.admin.listUsers({page,perPage:200});if(error)throw error;
    const users=data?.users||[];ids.push(...users.map(x=>x.id));if(users.length<200)break;
  }
  const accepted=[];
  for(let i=0;i<ids.length;i+=200){
    const slice=ids.slice(i,i+200);
    const {data,error}=await client.from('m4d_notification_preferences').select('user_id,'+event.category).in('user_id',slice);
    if(error)throw error;
    const disabled=new Set((data||[]).filter(r=>r[event.category]===false).map(r=>r.user_id));
    accepted.push(...slice.filter(id=>!disabled.has(id)));
  }
  return accepted;
}
async function dispatchEvent(client,event){
  const recipients=await matchingRecipients(client,event);
  for(let i=0;i<recipients.length;i+=500)await sendToOneSignal(event,recipients.slice(i,i+500),i/500);
  const {error}=await client.from('m4d_push_events').update({delivery_status:'sent',processed_at:new Date().toISOString(),last_error:null}).eq('id',event.id);
  if(error)throw error;
  return recipients.length;
}
module.exports={db,reply,safeLink,dispatchEvent};
