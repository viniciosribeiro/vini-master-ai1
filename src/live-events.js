// Immutable D1 audit rows. The UI may animate, but these events come exclusively from database writes.
export function liveCursor(value){
 const n=Number(value||0);
 return Number.isSafeInteger(n)&&n>=0?n:0;
}
export function liveLimit(value){
 const n=Number(value);
 return Number.isSafeInteger(n)?Math.min(120,Math.max(5,n)):80;
}
export async function readLiveEvents(db,params={}){
 const after=liveCursor(params.after),limit=liveLimit(params.limit);
 const query=after?
  'SELECT id,mission_id,agent_id,description,created_at FROM activity WHERE id>? ORDER BY id ASC LIMIT ?':
  'SELECT id,mission_id,agent_id,description,created_at FROM (SELECT id,mission_id,agent_id,description,created_at FROM activity ORDER BY id DESC LIMIT ?) ORDER BY id ASC';
 const rows=await db.prepare(query).bind(...(after?[after,limit]:[limit])).all();
 const events=(rows.results||[]).filter(x=>Number.isSafeInteger(Number(x.id)));
 const head=await db.prepare('SELECT COALESCE(MAX(id),0) AS latest FROM activity').first();
 const latestId=liveCursor(head?.latest),lastId=events.length?liveCursor(events[events.length-1].id):after;
 return {events,lastId,latestId,hasMore:after>0&&events.length>=limit&&lastId<latestId,serverTime:new Date().toISOString()};
}
