'use strict';
const topicNames=Object.fromEntries(Object.entries(CATALOG).map(([s,g])=>[s,Object.values(g).flatMap(v=>v.split('|'))]));
const limits={LR:60,AR:10,QA:40,VA:40}, subjects={LR:'Logical Reasoning',AR:'Abstract Reasoning',QA:'Quants & DI',VA:'Verbal & RC'};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function requireThat(test,message){if(!test)throw Error(message)}
function int(v,min,max=1000000){return Number.isInteger(v)&&v>=min&&v<=max}
function nonempty(v,max=500){return typeof v==='string'&&!!v.trim()&&v.length<=max}
function stateOf(log,topic){
  const rounds=[{target:150,sittings:[],status:'Practising'}];
  for(const e of log.filter(e=>e.data.topic===topic)){
    const r=rounds.at(-1),d=e.data;
    if(e.kind==='assign')r.target=d.target;
    if(e.kind==='practice')r.sittings.push(e);
    if(e.kind==='request'){r.status='Awaiting review';r.request=e}
    if(e.kind==='decision'){r.decision=e;r.status=d.action==='stop'?'Complete':'Reviewed';
      if(d.action!=='stop')rounds.push({target:d.target,sittings:[],status:'Practising'});}
  }
  return rounds;
}
function totals(rows){return rows.reduce((v,e)=>({a:v.a+e.data.attempts,c:v.c+e.data.correct,t:v.t+e.data.seconds}),{a:0,c:0,t:0})}
const mentorKinds=['assign','decision','read'];
function validateEvent(e,log){
  requireThat(UUID.test(e.id)&&UUID.test(e.student)&&Number.isFinite(Date.parse(e.at)),'Invalid record identity or timestamp.');
  const d=e.data,k=e.kind;requireThat(d&&typeof d==='object','Missing record data.');
  requireThat(['session','mock','practice','assign','request','decision','read'].includes(k),'Unknown record type.');
  if(k==='mock'){requireThat(nonempty(d.name,120)&&nonempty(d.issue)&&Object.entries(limits).every(([s,m])=>int(d[s],0,m)),'Check mock name, scores and problem log.');return}
  if(k==='read'){requireThat(log.some(x=>x.id===d.ref&&['request','session'].includes(x.kind)),'Alert does not exist.');return}
  requireThat(topicNames[d.section]?.includes(d.topic),'Choose a syllabus topic.');
  if(k==='session'){requireThat(nonempty(d.name,120)&&nonempty(d.note)&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&Number.isFinite(Date.parse(d.date)),'Enter class name, date and follow-up.');return}
  const rounds=stateOf(log,d.topic),r=rounds.at(-1),a=totals(r.sittings).a;
  requireThat(d.round===rounds.length,'The topic round has changed. Refresh and try again.');
  if(k==='decision'){requireThat(r.status==='Awaiting review'&&['more','less','stop'].includes(d.action)&&nonempty(d.note),'A pending request and feedback are required.');
    if(d.action!=='stop')requireThat(int(d.target,1)&&(d.action==='more'?d.target>=1:d.target<r.target),'For a reduced workload, enter fewer questions than the previous target.');
    return}
  requireThat(r.status==='Practising','This round is closed for entries.');
  if(k==='assign')requireThat(int(d.target,1),'Enter a positive assignment.');
  if(k==='practice'){requireThat(int(d.attempts,1)&&int(d.correct,0,d.attempts)&&int(d.seconds,1,86400),'Check attempts, correct answers and duration.');
    if(d.session)requireThat(log.some(x=>x.kind==='session'&&x.id===d.session&&x.data.topic===d.topic),'Choose a session for this topic.');}
  if(k==='request')requireThat(a>=r.target,'Finish the assigned count before requesting review.');
}
