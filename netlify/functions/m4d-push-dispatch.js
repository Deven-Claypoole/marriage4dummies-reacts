const {db,dispatchEvent}=require('./_m4d-shared');
exports.config={schedule:'* * * * *'};
exports.handler=async()=>{
 const client=db();
 const {data, error}=await client.rpc('m4d_claim_push_events',{batch_size:12});
 if(error)throw error;
 for(const event of data||[]){
   try{await dispatchEvent(client,event)}
   catch(err){
     console.error('M4D push queue event '+event.id+': '+err.message);
     await client.from('m4d_push_events').update({delivery_status:event.attempts<4?'pending':'failed',last_error:String(err.message).slice(0,500)}).eq('id',event.id);
   }
 }
};
