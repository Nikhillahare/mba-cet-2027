'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const button=(label,fn,arg='',cls='')=>'<button type="button" class="'+cls+'" data-action="'+fn+'" data-arg="'+esc(arg)+'">'+esc(label)+'</button>';
const input=(label,name,type='text',extra='')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" required '+extra+'></label>';
const area=(label,name)=>'<label>'+label+'<textarea name="'+name+'" required maxlength="500"></textarea></label>';
const panel=(title,html)=>'<section class="panel"><h2>'+esc(title)+'</h2>'+html+'</section>';
const form=(id,html,submit)=>'<form data-form="'+id+'">'+html+'<button class="primary">'+submit+'</button></form>';
const option=(v,label=v,sel=false)=>'<option value="'+esc(v)+'" '+(sel?'selected':'')+'>'+esc(label)+'</option>';
const list=(items,fn,empty='No entries yet.')=>items.length?items.map(x=>'<div class="item">'+fn(x)+'</div>').join(''):'<p class="muted">'+empty+'</p>';
const date=v=>new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'});
const localDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let dirty=false, pendingSave=null;
let tab=adminPage?'Today':'Preparation',section='LR',topic='Circular Arrangement',person='',filter='Pending approvals',search='',busy=false;
const logs=id=>db.events.filter(e=>e.student===id),profile=id=>db.profiles.find(p=>p.id===id),nameOf=id=>profile(id)?.name||'Student';
const totalScore=d=>Object.keys(limits).reduce((n,k)=>n+d[k],0);
const fmt=(n,d)=>d?(n/d).toFixed(1):'—';
const message=s=>{$('notice').textContent=s};
function selector(){return '<div class="actions">'+Object.keys(subjects).map(s=>button(s==='QA'?'QA & DI':s==='VA'?'VA & RC':s,'section',s,section===s?'active':'')).join('')+'</div><label>'+subjects[section]+' topic<select id="topic">'+Object.entries(CATALOG[section]).map(([g,v])=>'<optgroup label="'+esc(g)+'">'+v.split('|').map(t=>option(t,t,t===topic)).join('')+'</optgroup>').join('')+'</select></label>'}
function metrics(rows){const {a,c,t}=totals(rows);return [[a,'Attempted'],[c,'Correct'],[a?fmt(c*100,a)+'%':'—','Accuracy'],[fmt(t,a),'Sec / attempt'],[fmt(t,c),'Sec / right']]}
function metricBar(pairs){return '<div class="stats">'+pairs.map(([v,l])=>'<div><b>'+esc(v)+'</b><small>'+esc(l)+'</small></div>').join('')+'</div>'}
function roundsTable(rs){return '<div class="table"><table><tr><th>Round</th><th>Assigned</th><th>Attempted</th><th>Correct</th><th>Accuracy</th><th>Sec / right</th><th>Mentor decision</th></tr>'+rs.map((r,i)=>{const t=totals(r.sittings);return '<tr>'+[i+1,r.target,t.a,t.c,t.a?fmt(t.c*100,t.a)+'%':'—',fmt(t.t,t.c),r.decision?decisionText(r.decision.data):r.status].map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>'}).join('')+'</table></div>'}
const decisionText=d=>({more:'Practise more',less:'Practise less',stop:'Stop practice'})[d.action]+(d.action!=='stop'?' · '+d.target+' questions':'')+' — '+d.note;
function goalCharts(rounds, firstGoalAssigned) {
  const points = rounds.map((round, index) => ({
    name: 'Round ' + (index + 1),
    attempted: totals(round.sittings).a,
    target: round.target,
    source: index || firstGoalAssigned ? 'Mentor goal' : 'Default goal'
  }));
  const current = points.at(-1);
  const remaining = Math.max(0, current.target - current.attempted);
  const covered = Math.min(current.target, current.attempted);
  const percent = 100 * covered / current.target;
  const scale = Math.max(...points.map(p => Math.max(p.attempted, p.target)));
  const bar = (label, value, type) => `<div class="goal-bar">
    <span>${label}</span><div class="goal-rail" aria-hidden="true"><i class="${type}" style="width:${100 * value / scale}%"></i></div><b>${value}</b></div>`;
  const history = points.map(p => `<div class="bar-round"><strong>${p.name}</strong>
    ${bar(p.source, p.target, 'assigned')}${bar('Attempted', p.attempted, 'attempted')}</div>`).join('');
  const result = remaining ? remaining + (remaining === 1 ? ' question to go' : ' questions to go') : 'Goal reached';
  const extra = Math.max(0, current.attempted - current.target);
  return panel('Goal progress', `<div class="goal-layout">
    <figure><figcaption>Current round</figcaption>
      <div class="pie-wrap"><div class="goal-pie" aria-hidden="true" style="--share:${percent}%"></div>
      <div><strong class="goal-percent">${Math.floor(percent)}%</strong><p>${result}</p>
      <small>${current.source} · ${current.target} questions</small></div></div>
      <small><i class="key covered"></i>${covered} towards goal &nbsp; <i class="key remaining"></i>${remaining} remaining</small>
      ${extra ? '<p>Additional attempts · ' + extra + '</p>' : ''}</figure>
    <figure><figcaption>Attempts vs goal by round</figcaption>${history}</figure></div>`);
}
function topicPage(id,admin){
 const log=logs(id),rs=stateOf(log,topic),r=rs.at(-1),t=totals(r.sittings),all=rs.flatMap(v=>v.sittings),sessions=log.filter(e=>e.kind==='session'&&e.data.topic===topic);
 let html=panel(admin?'Review a topic':'Choose a topic',selector())+'<section class="hero"><small>'+esc(nameOf(id))+' · Round '+rs.length+'</small><h2>'+esc(topic)+'</h2><p>'+t.a+' of '+r.target+' assigned questions · '+r.status+'</p><div class="track"><i style="width:'+Math.min(100,100*t.a/r.target)+'%"></i></div>'+metricBar(metrics(r.sittings))+'<small>Practice goals · 70 sec per attempt · 60 sec per correct answer</small></section>';
 if(!admin)html+=goalCharts(rs,log.some(e=>e.kind==='assign'&&e.data.topic===topic&&e.data.round===1));
 if(rs.some(x=>x.decision))html+=panel('Latest mentor feedback','<p class="pre">'+esc(decisionText(rs.filter(x=>x.decision).at(-1).decision.data))+'</p>');
 if(admin&&r.status==='Awaiting review')html+=panel('Give your decision',form('decision','<label>Decision<select name="action" id="decisionAction">'+option('more','Practise more')+option('less','Practise less')+option('stop','Stop practice')+'</select></label><div id="nextTarget">'+input('Questions in next round','target','number','min="1" max="1000000"')+'</div>'+area('Feedback for the student','note'),'Send decision'));
 if(admin&&r.status==='Practising')html+=panel('Set this round’s assignment',form('assign',input('Assigned questions','target','number','min="1" max="1000000" value="'+r.target+'"'),'Save assignment'));
 if(!admin&&r.status==='Practising'){
 html+=panel('Log a practice sitting',form('practice','<div class="grid">'+input('Attempted','attempts','number','min="1" max="1000000"')+input('Correct','correct','number','min="0" max="1000000"')+input('Minutes','minutes','number','min="0" max="1440"')+input('Extra seconds','seconds','number','min="0" max="59" value="0"')+'</div><label>Related class session<select name="session">'+option('','Independent practice')+sessions.map(e=>option(e.id,e.data.date+' · '+e.data.name)).join('')+'</select></label>','Save sitting'));
 html+=panel('Mentor review',t.a>=r.target?button('I’ve practised the assigned questions','request','','primary'):'<p>'+ (r.target-t.a)+' questions remain before you can request review.</p>');
 }
 html+=panel('Round comparison',roundsTable(rs)+'<p class="muted">All rounds · '+totals(all).a+' attempts · '+fmt(totals(all).t,totals(all).c)+' sec per right</p>');
 return html+panel('Recent sittings',list([...all].reverse().slice(0,10),e=>esc(date(e.at))+' · '+e.data.attempts+' attempted · '+e.data.correct+' correct · '+fmt(e.data.seconds,60)+' min'));
}
function sessionsView(id,editable){
 const l=logs(id);return (editable?panel('Log a class session',selector()+form('session',input('Session / class name','name','text','maxlength="120"')+input('Class date','date','date','value="'+localDay()+'"')+area('Follow-up practice or what is still pending','note'),'Save session')):'')+panel('Session history',list(l.filter(e=>e.kind==='session').reverse(),e=>{
 const t=totals(l.filter(x=>x.kind==='practice'&&x.data.session===e.id));return '<b>'+esc(e.data.name)+'</b> · '+esc(e.data.date)+'<p>'+esc(e.data.topic)+' · '+t.a+' linked practice attempts</p><p class="pre">'+esc(e.data.note)+'</p>'}));
}
function mockHistory(id){return list(logs(id).filter(e=>e.kind==='mock').reverse(),e=>'<b>'+esc(e.data.name)+' · '+totalScore(e.data)+'/150</b><p>'+Object.keys(limits).map(k=>k+' '+e.data[k]+'/'+limits[k]).join(' · ')+'</p><p class="pre">'+esc(e.data.issue)+'</p><small>'+esc(date(e.at))+'</small>')}
function mocks(id,editable){return (editable?panel('Log a mock',form('mock',input('Mock name','name','text','maxlength="120"')+'<div class="grid">'+Object.entries(limits).map(([k,m])=>input(k+' / '+m,k,'number','min="0" max="'+m+'"')).join('')+'</div>'+area('Problem log · What affected your score?','issue'),'Save mock')):'')+panel('Mock history and problem logs',mockHistory(id))}
function latestTopicList(id){const l=logs(id);return [...new Set(l.filter(e=>e.data.round).map(e=>e.data.topic))].map(t=>{const rs=stateOf(l,t);return {topic:t,section:l.find(e=>e.data.topic===t).data.section,r:rs.at(-1),rs}})}
function alerts(){return db.events.filter(e=>e.kind==='session'||e.kind==='request').map(e=>{const log=logs(e.student);return {e,read:log.some(x=>x.kind==='read'&&x.data.ref===e.id),pending:e.kind==='request'&&!log.some(x=>x.kind==='decision'&&x.data.topic===e.data.topic&&x.data.round===e.data.round)}}).reverse()}
function alertRows(rows){return list(rows,({e,read,pending})=>'<span class="pill">'+(e.kind==='session'?'Session logged':pending?'Approval needed':'Reviewed')+'</span> <b>'+esc(nameOf(e.student))+'</b><p>'+esc(e.data.topic)+' · '+esc(e.kind==='session'?e.data.name:'Round '+e.data.round)+'</p><small>'+esc(date(e.at))+' · '+(read?'Read':'Unread')+'</small> '+button(e.kind==='session'?'Open session':'Open review','alert',e.id),'Nothing here yet.')}
function pendingCount(){return alerts().filter(x=>x.pending).length}
function personPicker(){return '<label>Student<select id="person">'+db.profiles.map(p=>option(p.id,p.name+' · '+p.batch,p.id===person)).join('')+'</select></label>'}
function batchTopics(){
 return panel('Batch progress for this topic',list(db.profiles,p=>{const r=stateOf(logs(p.id),topic).at(-1);return button(p.name,'reviewPerson',p.id)+' · '+totals(r.sittings).a+'/'+r.target+' · '+r.status}));
}
function studentProfile(){const id=person;if(!id)return '';const l=logs(id);return panel(nameOf(id),'<p>'+esc(profile(id).batch)+'</p><p class="muted">Last practice · '+esc(l.filter(e=>e.kind==='practice').at(-1)?date(l.filter(e=>e.kind==='practice').at(-1).at):'No sittings')+'<br>Last JSON import · '+esc(profile(id).last_import?date(profile(id).last_import):'None')+'<br>Newest imported backup · '+esc(profile(id).newest_export?date(profile(id).newest_export):'None')+'</p>'+list(latestTopicList(id),x=>button(x.topic,'profileTopic',x.topic)+' · '+x.r.status+' · '+totals(x.r.sittings).a+'/'+x.r.target,'No topic activity yet.'))+sessionsView(id,false)+mocks(id,false)+panel('Mentor decisions',list(l.filter(e=>e.kind==='decision').reverse(),e=>'<b>'+esc(e.data.topic)+'</b> · '+esc(decisionText(e.data))))}
function backups(){
 const id=adminPage?null:me;return panel('JSON backups','<p>Export a dated copy of '+(adminPage?'all student profiles and activity':'your profile and activity')+'. Imports merge records by their original IDs. Existing records are preserved.</p><div class="actions">'+button(adminPage?'Export batch JSON':'Export my JSON','export',id||'','primary')+(adminPage&&person?button('Export '+nameOf(person),'export',person):'')+'</div>')+panel('Import backups',form('restore','<label>Select JSON '+(adminPage?'files':'file')+'<input name="files" required type="file" accept=".json,application/json" '+(adminPage?'multiple':'')+'></label>'+(adminPage?'<label><input type="checkbox" name="trust"> Include new mentor decisions from files I personally exported or verified.</label>':'')+(adminPage&&mode==='cloud'?'<label><input type="checkbox" name="matchNames"> Link offline IDs to registered accounts by exact name and batch. Check student identities before selecting.</label>':'')+'<small>Use exports from this tracker. Files with a conflicting record or an unknown format are rejected together.</small><p></p>','Merge backup'));}
function render(){
 dirty=false;
 if(mode==='cloud'&&(!account||adminPage&&!mentor))return;
 if(!adminPage&&!profile(me))return onboarding();
 if(!profile(person))person=db.profiles[0]?.id||'';
 const tabs=adminPage?['Today','Alerts','Students','Topic Review','Mock Analysis','Backup']:['Preparation','Sessions','Mocks','Backup'];
 let content='';
 if(tab==='Today'){let a=alerts(),issues=new Map();for(const e of db.events.filter(x=>x.kind==='mock')){let k=e.student+'|'+e.data.issue.trim().toLowerCase();issues.set(k,(issues.get(k)||0)+1)}
 content='<section class="hero"><h2>Today’s mentoring desk</h2>'+metricBar([[db.profiles.length,'Students'],[a.filter(x=>x.pending).length,'Pending approvals'],[a.filter(x=>x.e.kind==='session'&&!x.read).length,'Unread sessions']])+'</section>'+panel('Awaiting your decision',alertRows(a.filter(x=>x.pending).reverse()))+panel('Latest class activity',alertRows(a.filter(x=>x.e.kind==='session').slice(0,5)))+panel('Repeated mock notes',list([...issues].filter(([,n])=>n>1),([k,n])=>esc(nameOf(k.slice(0,36)))+' · '+esc(k.slice(37))+' ('+n+' mocks)','No repeated notes yet.'))}
 if(tab==='Alerts'){const a=alerts();content=panel('Alerts','<div class="actions">'+['Pending approvals','Session logs','All'].map(v=>button(v,'filter',v,filter===v?'active':'')).join('')+'</div>'+alertRows(a.filter(x=>filter==='All'||(filter==='Session logs'?x.e.kind==='session':x.pending))))}
 if(tab==='Students')content=panel('Student directory','<label>Find by name or batch<input id="search" value="'+esc(search)+'" placeholder="Search students"></label><div id="directory"></div>')+studentProfile();
 if(tab==='Topic Review')content=person?panel('Student',personPicker())+topicPage(person,true)+batchTopics():panel('Topic review','Students appear after they complete their profile.');
 if(tab==='Mock Analysis')content=person?panel('Compare mock results',personPicker())+mocks(person,false):panel('Mock analysis','No student profiles yet.');
 if(tab==='Preparation')content=topicPage(me,false);
 if(tab==='Sessions')content=sessionsView(me,true);
 if(tab==='Mocks')content=mocks(me,true);
 if(tab==='Backup')content=backups();
 $('app').innerHTML='<small>'+esc(adminPage?'Mentor workspace':profile(me).batch)+'</small><h1>'+esc(adminPage?'Admin panel':nameOf(me))+'</h1><nav>'+tabs.map(t=>button(t+(t==='Alerts'&&pendingCount()?' ('+pendingCount()+')':''),'tab',t,tab===t?'active':'')).join('')+button('Refresh','refresh')+'</nav>'+content;
 if($('directory'))directory();
}
function directory(){$('directory').innerHTML=list(db.profiles.filter(p=>(p.name+' '+p.batch).toLowerCase().includes(search.toLowerCase())),p=>button(p.name,'person',p.id,p.id===person?'active':'')+' · '+esc(p.batch),'No matching students.')}
function onboarding(){
 $('app').innerHTML='<h1>Student profile</h1>'+panel('Your details',form('profile',input('Full name','name','text','maxlength="100"')+input('Batch','batch','text','maxlength="100"'),'Start tracking'))+(mode==='offline'?panel('Returning student',form('restore','<label>Your student JSON backup<input type="file" name="files" required></label>','Restore profile')):'');
}
function signIn(){ $('app').innerHTML='<h1>'+ (adminPage?'Mentor':'Student')+' sign in</h1>'+panel('MBA CET 2027',form('login',input('Email','email','email','autocomplete="email"')+input('Password','password','password','autocomplete="current-password"'),'Sign in'))}
function activeId(){return adminPage?person:me}
async function action(cmd,arg){
 if(cmd==='tab'){tab=arg;dirty=false}
 if(cmd==='section'){section=arg;topic=topicNames[arg][0]}
 if(cmd==='person'||cmd==='reviewPerson')person=arg;
 if(cmd==='filter')filter=arg;
 if(cmd==='profileTopic'){topic=arg;section=Object.keys(subjects).find(s=>topicNames[s].includes(topic));tab='Topic Review'}
 if(cmd==='alert'){const e=db.events.find(x=>x.id===arg);person=e.student;section=e.data.section;topic=e.data.topic;
 if(!logs(person).some(x=>x.kind==='read'&&x.data.ref===arg))await write(fresh('read',person,{ref:arg}));
 tab=e.kind==='session'?'Students':'Topic Review';if(e.kind==='session')message('Session · '+e.data.date+' · '+e.data.name+' — '+e.data.note);}
 if(cmd==='export'){download(arg||null);return}
 if(cmd==='refresh')await reload();
 if(cmd==='request'){const e=fresh('request',me,{section,topic,round:stateOf(logs(me),topic).length});validateEvent(e,logs(me));await write(e);message('Request sent for mentor review.')}
 if(cmd==='logout'){const {error}=await client.auth.signOut();if(error)throw error;location.reload();return}
 render();
}
async function submit(f){const k=f.dataset.form,v=new FormData(f),str=n=>String(v.get(n)||'').trim(),num=n=>Number(v.get(n));
 if(k==='login'){const {data,error}=await client.auth.signInWithPassword({email:str('email'),password:v.get('password')});if(error)throw error;account=data.user;await start();return}
 if(k==='profile'){const name=str('name'),batch=str('batch');requireThat(nonempty(name,100)&&nonempty(batch,100),'Name and batch required.');
 if(mode==='cloud')await rpc('ben_profile',{n:name,b:batch});else{const id=newId();await localEdit(next=>next.profiles.push({id,name,batch}));localStorage.setItem(localKey+'.me',id)}await reload();render();return}
 if(k==='restore'){const docs=await restore(f.elements.files.files,!!v.get('trust'),!!v.get('matchNames'));message('Merged '+docs.map(d=>d.names+' (exported '+date(d.date)+')').join(' · '));render();return}
 const id=activeId(),r=stateOf(logs(id),topic).length;let d={section,topic,round:r};
 if(k==='session')d={section,topic,name:str('name'),date:str('date'),note:str('note')};
 if(k==='mock')d={name:str('name'),issue:str('issue'),...Object.fromEntries(Object.keys(limits).map(s=>[s,num(s)]))};
 if(k==='practice')Object.assign(d,{attempts:num('attempts'),correct:num('correct'),seconds:60*num('minutes')+num('seconds'),session:str('session')});
 if(k==='assign')d.target=num('target');
 if(k==='decision'){d.action=str('action');d.note=str('note');if(d.action!=='stop')d.target=num('target')}
 const signature=JSON.stringify([id,k,d]);
 const e=pendingSave?.signature===signature?pendingSave.event:fresh(k,id,d);
 validateEvent(e,logs(id));pendingSave={signature,event:e};await write(e);pendingSave=null;dirty=false;message(k==='decision'?'Decision saved for the student.':'Saved.');render();
}
async function run(fn){if(busy)return;busy=true;message('');try{await fn()}catch(e){message(e.message||String(e))}finally{busy=false}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)run(()=>action(b.dataset.action,b.dataset.arg))});
document.addEventListener('submit',e=>{e.preventDefault();run(()=>submit(e.target))});
document.addEventListener('input',e=>{if(e.target.closest('form'))dirty=true;if(e.target.id==='search'){search=e.target.value;directory()}});
document.addEventListener('change',e=>{if(e.target.id==='topic'){topic=e.target.value;render()}if(e.target.id==='person'){person=e.target.value;render()}if(e.target.id==='decisionAction'){const hide=e.target.value==='stop';$('nextTarget').hidden=hide;$('nextTarget').querySelector('input').disabled=hide}});
async function start(){
 $('mode').textContent=mode==='demo'?'Fictional demo':mode==='cloud'?'Supabase connected':'Offline · this browser';
 if(mode==='cloud'){requireThat(/^https:\/\//.test(config.url)&&config.publishableKey,'Complete both values in config.js.');
 if(!client){await new Promise((ok,fail)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';s.onload=ok;s.onerror=()=>fail(Error('Cannot load Supabase. Check internet access and reload.'));document.head.append(s)});client=window.supabase.createClient(config.url,config.publishableKey)}
 const {data,error}=await client.auth.getSession();if(error)throw error;account=data.session?.user;if(!account){signIn();return}
 $('authAction').innerHTML=button('Sign out','logout');
 }
 await reload();if(mode==='cloud'&&adminPage&&!mentor){$('app').innerHTML=panel('Mentor access required','Sign in with the account registered as mentor in Supabase.');return}render();
}
window.addEventListener('storage',e=>{if(e.key===localKey&&!busy&&!dirty&&!document.querySelector('form :focus'))run(async()=>{await reload();render()})});
if(mode==='cloud')setInterval(async()=>{
 if(!account||busy||dirty||document.hidden||document.querySelector('form :focus')||(!adminPage&&!profile(me)))return;
 busy=true;try{const previous=JSON.stringify(db);await reload();if(JSON.stringify(db)!==previous)render()}catch(e){message('Sync unavailable. '+e.message)}finally{busy=false}
},30000);
run(start);
