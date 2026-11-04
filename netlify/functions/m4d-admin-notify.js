const {db,reply,safeLink}=require('./_m4d-shared');
exports.handler=async event=>{
 if(event.httpMethod!=='POST')return reply(405,{error:'Method not allowed'});
 try{
  const token=(event.headers.authorization||event.headers.Authorization||'').match(/^Bearer (.+)$/)?.[1];
  if(!token)return reply(401,{error:'Sign in as an admin first.'});
  const client=db();
  const {data:userData,error:userError}=await client.auth.getUser(token);
  if(userError||!userData?.user)return reply(401,{error:'Your session expired. Sign in again.'});
  // Evaluate the existing m4d_is_admin() function with the caller's JWT.
  const base=process.env.SUPABASE_URL;
  const response=await fetch(base+'/rest/v1/rpc/m4d_is_admin',{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
  if(!response.ok||await response.json()!==true)return reply(403,{error:'Admin authorization required.'});
  const body=JSON.parse(event.body||'{}');
  const allowed=['announcements','live','vault','requests'];
  if(!allowed.includes(body.category)||typeof body.title!=='string'||typeof body.body!=='string'||!body.title.trim()||!body.body.trim()||body.title.length>100||body.body.length>240)return reply(400,{error:'Invalid notification fields.'});
  const url=safeLink(typeof body.target_url==='string'?body.target_url:'/');
  // Avoid accidental repeat presses and abuse (one alert per admin per 30 seconds).
  const since=new Date(Date.now()-30000).toISOString();
  const {count,error:rateError}=await client.from('m4d_push_events').select('id',{count:'exact',head:true}).like('source_key','admin:'+userData.user.id+':%').gte('created_at',since);
  if(rateError)throw rateError;
  if(count>=1)return reply(429,{error:'You can send another alert after 30 seconds.'});
  const {error}=await client.from('m4d_push_events').insert({recipient_id:null,category:body.category,title:body.title.trim(),body:body.body.trim(),target_url:url,source_key:'admin:'+userData.user.id+':'+crypto.randomUUID()});
  if(error)throw error;
  return reply(202,{queued:true});
 }catch(error){console.error('M4D admin push:',error);return reply(500,{error:'Could not queue alert. Check Netlify function settings and logs.'})}
};
const crypto=require('node:crypto');
