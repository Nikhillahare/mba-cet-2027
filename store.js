const config=window.BEN_CONFIG,cloud=!!(config.url||config.publishableKey),adminPage=document.body.dataset.role==='admin';
const mode=new URLSearchParams(location.search).get('demo')==='1'?'demo':cloud?'cloud':'offline';
const localKey='ben.cet27.'+mode, empty=()=>({profiles:[],events:[]});
let db=empty(),me='',client=null,mentor=false,account=null;
const newId=()=>crypto.randomUUID();
const fresh=(kind,student,data,at=new Date().toISOString())=>({id:newId(),kind,student,data,at});
function seed(){
 const one={id:newId(),name:'Aditi Patil',batch:'BEN Hybrid'},two={id:newId(),name:'Rohan Shah',batch:'BEN Hybrid'};
 const s={section:'LR',topic:'Circular Arrangement'},dt=n=>new Date(Date.now()-n*3600000).toISOString();
 const session=fresh('session',one.id,{...s,name:'Circular seating workshop',date:dt(48).slice(0,10),note:'Practised mixed-facing arrangements.'},dt(48));
 const events=[session,fresh('practice',one.id,{...s,round:1,attempts:110,correct:88,seconds:5280,session:session.id},dt(24)),fresh('mock',one.id,{name:'BEN Mock 01',LR:40,AR:8,QA:27,VA:30,issue:'Spent too long on one seating puzzle.'},dt(12)),
 fresh('practice',two.id,{section:'QA',topic:'Percentages',round:1,attempts:150,correct:120,seconds:7800},dt(5)),fresh('request',two.id,{section:'QA',topic:'Percentages',round:1},dt(4))];
 return {profiles:[one,two],events};
}
async function rpc(name,args={}){const {data,error}=await client.rpc(name,args);if(error)throw Error(error.message);return data}
async function reload(){
 if(mode==='cloud'){db=await rpc('ben_snapshot');mentor=db.admin;me=account.id}
 else{const str=localStorage.getItem(localKey);db=str?JSON.parse(str):mode==='demo'?seed():empty();if(!str)localStorage.setItem(localKey,JSON.stringify(db));me=localStorage.getItem(localKey+'.me')||(mode==='demo'?db.profiles[0]?.id:'')||'';mentor=adminPage}
}
async function localEdit(fn){requireThat(navigator.locks,'Open on localhost or HTTPS for safe local saves.');await navigator.locks.request(localKey,async()=>{await reload();let next=structuredClone(db);fn(next);localStorage.setItem(localKey,JSON.stringify(next));db=next})}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v}
function identical(a,b){return JSON.stringify(canonical({...a,at:new Date(a.at).toISOString()}))===JSON.stringify(canonical({...b,at:new Date(b.at).toISOString()}))}
function mergeEvents(next,items){
 let byId=new Map(next.events.map(e=>[e.id,e]));for(const e of items){
  const prev=byId.get(e.id);if(prev){requireThat(identical(prev,e),'Conflicting record. No changes applied.');continue}
  requireThat(next.profiles.some(p=>p.id===e.student),'Missing student profile.');
  validateEvent(e,next.events.filter(x=>x.student===e.student));next.events.push(e);byId.set(e.id,e);
 }
}
async function write(e){if(mode==='cloud'){await rpc('ben_write',{items:[e]});await reload()}else await localEdit(next=>mergeEvents(next,[e]))}
function backup(id){
 return {format:'ben-cet-tracker',version:1,scope:id?'student':'batch',exportedAt:new Date().toISOString(),profiles:db.profiles.filter(p=>!id||p.id===id),events:db.events.filter(e=>(!id||e.student===id)&&(!id||e.kind!=='read'))};
}
function download(id){const data=backup(id),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='BEN-'+(id?data.profiles[0].name.replace(/[^\w-]+/g,'-'):'Batch')+'-'+data.exportedAt.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
async function restore(files,trust,matchNames=false){
 const docs=await Promise.all([...files].map(async f=>JSON.parse(await f.text())));docs.sort((a,b)=>Date.parse(a.exportedAt)-Date.parse(b.exportedAt));
 let profiles=[],items=[],aliases=new Map(),latestExport=new Map();
 for(const doc of docs){
 requireThat(doc.format==='ben-cet-tracker'&&doc.version===1&&['student','batch'].includes(doc.scope)&&Array.isArray(doc.events)&&Array.isArray(doc.profiles)&&Number.isFinite(Date.parse(doc.exportedAt)),'Unsupported backup. Use a BEN tracker v1 JSON export.');
 requireThat(doc.scope!=='student'||doc.profiles.length===1,'Invalid student backup.');
 requireThat(adminPage||doc.scope==='student','Choose your own student backup.');
 for(const p of doc.profiles){requireThat(UUID.test(p.id)&&nonempty(p.name,100)&&nonempty(p.batch,100),'Invalid profile.');requireThat(adminPage||p.id===me||(!me&&mode!=='cloud'),'This backup belongs to another student.');latestExport.set(p.id,doc.exportedAt);if(!profiles.some(x=>x.id===p.id))profiles.push(p)}
 if(matchNames&&mode==='cloud'&&adminPage){
  const norm=s=>s.trim().toLowerCase().replace(/\s+/g,' ');
  for(const p of doc.profiles){if(profile(p.id))continue;
   const matches=db.profiles.filter(x=>norm(x.name)===norm(p.name)&&norm(x.batch)===norm(p.batch));
   requireThat(matches.length===1,'Account match must be unique for '+p.name+' / '+p.batch+'. Check their registered profile.');
   requireThat(![...aliases].some(([old,id])=>old!==p.id&&id===matches[0].id),'Two backup identities match one account.');
   aliases.set(p.id,matches[0].id);
  }
 }
 for(const e of doc.events){requireThat(doc.profiles.some(p=>p.id===e.student),'Orphaned record.');if(mentorKinds.includes(e.kind)&&!db.events.some(x=>x.id===e.id)){
 requireThat(mode!=='cloud'&&!adminPage||adminPage&&trust,'New mentor decisions require a trusted mentor backup or an existing decision.');}
 items.push(aliases.has(e.student)?{...e,student:aliases.get(e.student)}:e)}
 }
 profiles=profiles.map(p=>({...(aliases.has(p.id)?profile(aliases.get(p.id)):p),sourceExport:latestExport.get(p.id)}));
 requireThat(adminPage||profiles.length===1,'Choose backups for one student.');
 function apply(next){for(const p of profiles){
  let current=next.profiles.find(x=>x.id===p.id);
  if(!current){current={id:p.id,name:p.name,batch:p.batch};next.profiles.push(current)}
  if(adminPage){current.last_import=new Date().toISOString();if(!current.newest_export||Date.parse(p.sourceExport)>Date.parse(current.newest_export))current.newest_export=p.sourceExport}
 }mergeEvents(next,items)}
 if(mode==='cloud'){apply(structuredClone(db));await rpc('ben_restore',{people:profiles,items});await reload()}
 else{await localEdit(apply);if(!me&&!adminPage&&profiles.length)localStorage.setItem(localKey+'.me',profiles[0].id);await reload()}
 return docs.map(d=>({date:d.exportedAt,names:d.profiles.map(p=>p.name).join(', ')}));
}
