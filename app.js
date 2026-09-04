/* ============================================================
   工作台 WorkBench App — 移动 PWA 主逻辑
   ============================================================ */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmtDay = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayStr = () => fmtDay(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WEEK = ['日','一','二','三','四','五','六'];

function toast(msg, type='ok'){
  const w = $('#toastWrap');
  const t = document.createElement('div');
  t.className = 'toast '+type; t.textContent = msg;
  w.appendChild(t);
  setTimeout(()=>{t.classList.add('out'); setTimeout(()=>t.remove(),300);}, 2600);
}

/* 存储 */
const Store = {
  key:'wbapp_data_v1',
  read(){ try{ return JSON.parse(localStorage.getItem(this.key)) || null; }catch(e){ return null; } },
  write(d){ localStorage.setItem(this.key, JSON.stringify(d)); }
};

/* 状态 */
const State = {
  tasks: [],
  newsCat:'daily',
  newsData:null,
  taskView:'list',
  taskFilter:'all',
  log: {},
  aiSummaries:{},
  ideas: [],
  ideaAi:true,
  calYear:new Date().getFullYear(),
  calMonth:new Date().getMonth(),
  theme:'warm',
};

/* =============================================================
   模块一：最新资讯
   ============================================================= */
const NewsCategories = [
  {id:'daily',name:'每日热点',icon:'◎'},
  {id:'fin',  name:'财经',icon:'¥'},
  {id:'game', name:'游戏',icon:'◆'},
  {id:'ai',   name:'AI前沿',icon:'✦'},
  {id:'uad',  name:'抖音/小红书',icon:'◈'},
];
const NewsPool = {
  daily:[
    {t:'AI 助手正加速渗透职场日常，效率工具成新增长极',d:'从文档处理到数据分析，生成式AI正重构白领工作流。',tag:'要闻'},
    {t:'多地发布「人工智能+」行动政策，聚焦制造与民生场景落地',d:'政策明确培育行业大模型应用标杆。',tag:'政策'},
    {t:'国民级应用完成新一轮架构升级，端侧智能成体验核心',d:'新版本主打流畅与主动服务，用户活跃度回升。',tag:'科技'},
    {t:'今晨财经观察：消费与科技板块情绪回暖',d:'分析师提示关注业绩确定性主线。',tag:'财经'},
    {t:'新一代移动芯片发布，能效比大幅提升引业界热议',d:'端侧大模型运行成为标配能力。',tag:'硬件'},
    {t:'国家图书馆上线数字人文平台，古籍资源开放共享',d:'借助 AI 实现古籍自动识别与标点断句。',tag:'文化'},
  ],
  fin:[
    {t:'两市开盘温和走高，科技成长风格占优',d:'北向资金净流入，AI算力方向获关注。',tag:'A股'},
    {t:'央行开展公开市场操作，维护流动性合理充裕',d:'机构解读：货币政策延续稳健取向。',tag:'宏观'},
    {t:'多只 AI 主题 ETF 份额持续增长，机构加码布局算力',d:'头部私募调研显示对产业趋势关注度提升。',tag:'基金'},
    {t:'人民币汇率保持基本稳定，双向波动特征明显',d:'基本面支撑充足，无需过度担忧单边走势。',tag:'汇市'},
    {t:'黄金延续强势，避险与央行购金需求共同支撑',d:'金价创阶段新高，关注通胀路径。',tag:'大宗'},
    {t:'中报季收官：超六成公司净利增长，盈利质量改善',d:'高端制造与消费复苏方向表现突出。',tag:'中报'},
  ],
  game:[
    {t:'现象级大作新赛季上线，首日同时在线人数再创新高',d:'玩法更新引爆玩家热情，股价受提振。',tag:'新品'},
    {t:'国产开放世界新游公开实机演示，画面表现获好评',d:'自研引擎技术进一步成熟。',tag:'国产'},
    {t:'热门手游周年庆开启，限定活动与福利集中放送',d:'流水预期升温。',tag:'手游'},
    {t:'电竞季后赛落幕，黑马战队完成逆袭夺冠',d:'总决赛收视创赛季新高。',tag:'电竞'},
    {t:'云游戏进入规模化阶段，订阅服务竞争白热化',d:'延迟体验成关键，多家平台加码投入。',tag:'云游戏'},
    {t:'独立游戏年度评选启动，多款口碑佳作入围',d:'鼓励创新表达，生态持续多元。',tag:'独立'},
  ],
  ai:[
    {t:'新一代推理模型发布，数学与代码能力刷新基准',d:'在复杂推理与长上下文任务上表现突出。',tag:'大模型'},
    {t:'国产大模型竞技场榜单更新，中文能力对标国际一流',d:'开源模型登榜，推理成本下探。',tag:'国产'},
    {t:'多模态 Agent 突破：可自主规划并操作软件完成复杂任务',d:'被视为通向通用助手的里程碑。',tag:'Agent'},
    {t:'端侧 AI 芯片出货放量，手机电脑本地推理普及',d:'隐私与离线需求驱动算力向端侧迁移。',tag:'端侧'},
    {t:'AI 安全对齐新论文：提出可扩展监督与可解释性框架',d:'业界呼吁能力跃升同时守住安全底线。',tag:'对齐'},
    {t:'AI 编程助手普及率再升，开发者人效报告出炉',d:'代码审查与重构效率提升最明显。',tag:'编程'},
  ],
  uad:[
    {t:'小红书公布生活方式趋势关键词，户外与健康生活热度攀升',d:'笔记社区氛围持续强化。',tag:'小红书'},
    {t:'抖音短剧再出新爆款，单集播放破亿引行业关注',d:'品牌定制短剧成营销新宠。',tag:'抖音'},
    {t:'直播电商年中复盘：低价之外，体验与信任成新关键词',d:'退货率下降成共同目标。',tag:'电商'},
    {t:'爆款笔记方法论：情绪价值与利他信息并行成传播密码',d:'真实感仍是流量核心。',tag:'运营'},
    {t:'AI 数字人主播批量进场，中小商家迎来内容降本',d:'虚拟形象带货成本仅为真人十分之一。',tag:'AI应用'},
    {t:'短视频平台加码本地生活，探店内容带火小众目的地',d:'按视频打卡成为出行新方式。',tag:'本地生活'},
  ],
};

function renderNewsTabs(){
  const tabs = $('#newsTabs'); tabs.innerHTML='';
  NewsCategories.forEach(c=>{
    const b=document.createElement('button');
    b.className='cat-tab'+(c.id===State.newsCat?' active':'');
    b.dataset.cat=c.id;
    b.innerHTML=`<span>${c.icon} ${c.name}</span><span class="cat-count">${NewsPool[c.id].length}</span>`;
    b.onclick=()=>{ State.newsCat=c.id; renderNewsTabs(); renderNews(); };
    tabs.appendChild(b);
  });
}
function renderNews(){
  const cat=State.newsCat;
  $('#newsBrief').innerHTML=`<b>${NewsCategories.find(c=>c.id===cat).name}</b><span>${todayStr()} · 已更新</span>`;
  const list=$('#newsList'); list.innerHTML='';
  State.newsData[cat].forEach((n,i)=>{
    const heat=35+Math.floor(Math.random()*64);
    const card=document.createElement('a');
    card.href='javascript:void(0)';
    card.className='news-card';
    card.style.textDecoration='none';
    card.innerHTML=`
      <div class="news-rank">${i<3?'0'+(i+1):i+1}</div>
      <div>
        <div class="news-meta">
          ${i===0?'<span class="news-hot">热</span>':''}
          <span class="news-tag">${esc(n.tag)}</span>
          <span class="news-heat">热度 ${heat}万</span>
        </div>
        <div class="news-title">${esc(n.t)}</div>
        <div class="news-desc">${esc(n.d)}</div>
      </div>`;
    card.onclick=()=>toast('已为你打开这条资讯');
    list.appendChild(card);
  });
}
function freshNews(randomize){
  const data={};
  Object.keys(NewsPool).forEach(k=>{
    data[k]=[...NewsPool[k]];
    if(randomize) data[k]=data[k].sort(()=>Math.random()-.5).slice(0,6);
  });
  State.newsData=data;
}
function initNews(){
  freshNews(true);
  renderNewsTabs();
  renderNews();
  $('#newsRefreshBtn').onclick=()=>{
    const btn=$('#newsRefreshBtn');
    btn.classList.add('spinning'); btn.disabled=true;
    $('#newsSyncState').textContent='刷新中…';
    setTimeout(()=>{
      freshNews(true);
      renderNewsTabs(); renderNews();
      btn.classList.remove('spinning'); btn.disabled=false;
      $('#newsSyncState').textContent='已更新 '+new Date().toTimeString().slice(0,5);
      toast('热点已刷新');
      setTimeout(()=>$('#newsSyncState').textContent='点击刷新加载热点',3000);
    },500);
  };
}

/* =============================================================
   模块二：任务打卡
   ============================================================= */
const PERIOD_LABEL={none:'一次性',daily:'每日',weekday:'工作日',weekly:'每周',monthly:'每月'};
function taskDueOn(task,dateStr){
  const d=new Date(dateStr+'T00:00:00');
  const first=task.date||todayStr();
  switch(task.period){
    case 'daily': return true;
    case 'weekday': return d.getDay()>=1 && d.getDay()<=5;
    case 'weekly': return dateStr===first || dayGap(first,dateStr)%7===0;
    case 'monthly': return new Date(dateStr).getDate()===new Date(first).getDate() || dateStr===first;
    default: return dateStr===first;
  }
}
function dayGap(a,b){
  const A=new Date(a+'T00:00:00'),B=new Date(b+'T00:00:00');
  return Math.round((B-A)/86400000);
}
function isOnceDue(task){ return task.period==='none' && task.date===todayStr(); }
function visibleTasks(filter){
  let list=[...State.tasks];
  if(filter==='today') list=list.filter(t=>isOnceDue(t)||(t.period!=='none'&&taskDueOn(t,todayStr())));
  else if(filter==='todo') list=list.filter(t=>!t.done);
  else if(filter==='done') list=list.filter(t=>t.done);
  list.sort((a,b)=>{
    const aDue=a.period==='none'&&a.date===todayStr()&&!a.done;
    const bDue=b.period==='none'&&b.date===todayStr()&&!b.done;
    if(aDue!==bDue) return aDue?-1:1;
    return a.prio-(b.prio||2) || String(a.date).localeCompare(String(b.date));
  });
  return list;
}
function toggleTaskCheck(taskId){
  const t=State.tasks.find(x=>x.id===taskId); if(!t) return;
  if(t.period==='none'){
    t.done=!t.done;
    toast(t.done?'任务已完成 ✔':'已改回未完成');
  }else{
    const td=todayStr();
    t.doneDates=t.doneDates||[];
    const ix=t.doneDates.indexOf(td);
    if(ix>=0){ t.doneDates.splice(ix,1); toast('已取消今日打卡'); }
    else{ t.doneDates.push(td); toast('今日打卡成功 ✓'); }
    t.done=false;
  }
  save(); renderTaskArea();
}
function subProgress(t){
  return t.subs&&t.subs.length? t.subs.filter(s=>s.done).length+'/'+t.subs.length : null;
}
function renderTaskList(){
  const wrap=$('#taskList'); wrap.innerHTML='';
  const list=visibleTasks(State.taskFilter);
  $('#taskEmpty').classList.toggle('hidden',list.length>0);
  const today=todayStr();
  list.forEach(t=>{
    const done = t.period==='none'? t.done : ((t.doneDates||[]).includes(today));
    const card=document.createElement('div');
    card.className='task-card'+(done?' done':'');
    const due= t.period==='none'?t.date:(PERIOD_LABEL[t.period]||'');
    const overdue= t.period==='none' && !done && t.date && t.date<today;
    const prog=subProgress(t);
    card.innerHTML=`
      <div class="task-main">
        <div class="t-check" data-act="toggle" title="${done?'取消完成':'完成'}">✓</div>
        <div class="t-text">
          <div class="t-title">${esc(t.title)}</div>
          ${prog?`<div class="t-sub">${esc(prog)} 子任务</div>`:''}
          <div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap">
            <span class="prio-tag p${t.prio||2}">${t.prio==1?'高':t.prio==3?'低':'中'}</span>
            ${t.period!=='none'?`<span class="period-tag recur">↻ ${PERIOD_LABEL[t.period]}</span>`:`<span class="period-tag">${due}</span>`}
            ${overdue?`<span class="t-due overdue">已逾期</span>`:''}
          </div>
        </div>
        <div class="t-right">
          <button class="t-del" data-act="del" title="删除">🗑</button>
        </div>
      </div>`;
    if(t.subs&&t.subs.length){
      const sub=document.createElement('div'); sub.className='task-subtree';
      sub.innerHTML=t.subs.map((s,si)=>`
        <button class="t-sub-item ${s.done?'done':''}" data-sub="${t.id}:${si}">${s.done?'✓':'○'} ${esc(s.text)}</button>`).join('');
      sub.querySelectorAll('.t-sub-item').forEach(el=>{
        el.onclick=()=>{ const [tid,si]=el.dataset.sub.split(':'); toggleSub(tid,+si); };
      });
      card.appendChild(sub);
    }
    card.querySelector('[data-act=toggle]').onclick=()=>toggleTaskCheck(t.id);
    card.querySelector('[data-act=del]').onclick=()=>{
      if(confirm('确定删除「'+t.title+'」？')){ State.tasks=State.tasks.filter(x=>x.id!==t.id); save(); renderTaskArea(); toast('已删除'); }
    };
    wrap.appendChild(card);
  });
}
function toggleSub(taskId,si){
  const t=State.tasks.find(x=>x.id===taskId); if(!t||!t.subs[si])return;
  t.subs[si].done=!t.subs[si].done;
  save(); renderTaskArea();
}
function renderCalendar(){
  const y=State.calYear,m=State.calMonth;
  $('#calTitle').textContent=`${y}年 ${m+1}月`;
  const grid=$('#calGrid'); grid.innerHTML='';
  WEEK.forEach(w=>{ const d=document.createElement('div'); d.className='cal-dow'; d.textContent=w; grid.appendChild(d); });
  const firstDow=new Date(y,m,1).getDay();
  const days=new Date(y,m+1,0).getDate();
  const today=todayStr();
  for(let i=0;i<firstDow;i++){ const c=document.createElement('div'); c.className='cal-cell dim'; grid.appendChild(c); }
  for(let day=1;day<=days;day++){
    const ds=fmtDay(new Date(y,m,day));
    const c=document.createElement('div');
    c.className='cal-cell'+(ds===today?' today':'');
    let hasTask=0, todayDone=0;
    State.tasks.forEach(t=>{
      if(t.period==='none'){ if(t.date===ds){ hasTask++; if(t.done)todayDone++; } }
      else if(taskDueOn(t,ds)){ hasTask++; if((t.doneDates||[]).includes(ds))todayDone++; }
    });
    c.innerHTML=`<div class="cal-day">${day}</div>`+
      (hasTask?`<div class="cal-dots">${Array.from({length:Math.min(hasTask,6)}).map((_,i)=>`<span class="cal-dot-mini" style="${i<todayDone?'background:var(--teal)':''}"></span>`).join('')}${hasTask>6?'…':''}</div>`:'');
    c.title = hasTask? `${hasTask} 项任务 · ${todayDone} 已完成` : '无任务';
    c.onclick=()=>{ if(hasTask){ State.taskFilter='today'; $('#taskViewSeg .seg-btn[data-tview=list]').click(); switchTaskView('list'); toast('已切到清单查看今日任务'); } };
    grid.appendChild(c);
  }
  const rem= (grid.children.length)%7; if(rem) for(let i=0;i<7-rem;i++){ const c=document.createElement('div'); c.className='cal-cell dim'; grid.appendChild(c); }
}

let tmSubs=[];
let tmPrio=2;
function openTaskModal(prefillTitle=''){
  tmSubs=[]; tmPrio=2;
  $('#tmTitle').value=prefillTitle||'';
  $('#tmSubInput').value=''; $('#tmDate').value=todayStr();
  $('#tmPeriod').value='none';
  renderPrioPick(); renderSubChips();
  $('#taskModal').classList.remove('hidden');
  setTimeout(()=>$('#tmTitle').focus(),50);
}
function renderPrioPick(){
  $$('#tmPrio .prio-btn').forEach(b=>b.classList.toggle('active',+b.dataset.p===tmPrio));
}
function renderSubChips(){
  const w=$('#tmSubChips'); w.innerHTML='';
  tmSubs.forEach((s,i)=>{
    const c=document.createElement('span'); c.className='sub-chip';
    c.innerHTML=`<b>${esc(s)}</b><button>×</button>`;
    c.querySelector('button').onclick=()=>{ tmSubs.splice(i,1); renderSubChips(); };
    w.appendChild(c);
  });
}
function saveTaskFromModal(){
  const title=$('#tmTitle').value.trim();
  if(!title){ toast('请填写任务标题','warn'); return; }
  const period=$('#tmPeriod').value;
  const date=$('#tmDate').value||todayStr();
  State.tasks.push({id:uid(),title,period,date,prio:tmPrio,
    subs:tmSubs.map(t=>({text:t,done:false})),done:false,doneDates:[]});
  save(); closeTaskModal(); renderTaskArea();
  toast('任务已添加');
}
function closeTaskModal(){ $('#taskModal').classList.add('hidden'); }

function initTaskModule(){
  $('#taskAddBtn').onclick=()=>openTaskModal();
  $('#taskVoiceBtn').onclick=()=>startVoice('task');
  $('#taskModalClose').onclick=closeTaskModal;
  $('#taskModalCancel').onclick=closeTaskModal;
  $('#taskModalSave').onclick=saveTaskFromModal;
  $('#taskModal').addEventListener('click',e=>{ if(e.target.id==='taskModal')closeTaskModal(); });
  $('#tmSubInput').addEventListener('keydown',e=>{
    if(e.key==='Enter'){ e.preventDefault(); const v=e.target.value.trim(); if(v){ tmSubs.push(v); e.target.value=''; renderSubChips(); } }
  });
  $$('#tmPrio .prio-btn').forEach(b=>b.onclick=()=>{ tmPrio=+b.dataset.p; renderPrioPick(); });
  $$('#taskViewSeg .seg-btn').forEach(b=>b.onclick=()=>{
    switchTaskView(b.dataset.tview);
    $$('#taskViewSeg .seg-btn').forEach(x=>x.classList.toggle('active',x===b));
  });
  $$('#taskFilter .chip').forEach(c=>c.onclick=()=>{
    State.taskFilter=c.dataset.f;
    $$('#taskFilter .chip').forEach(x=>x.classList.toggle('active',x===c));
    renderTaskList();
  });
  $('#calPrev').onclick=()=>{ State.calMonth--; if(State.calMonth<0){State.calMonth=11;State.calYear--;} renderCalendar(); };
  $('#calNext').onclick=()=>{ State.calMonth++; if(State.calMonth>11){State.calMonth=0;State.calYear++;} renderCalendar(); };
}
function switchTaskView(v){
  State.taskView=v;
  $('#taskList').classList.toggle('hidden',v!=='list');
  $('#taskEmpty').classList.toggle('hidden', true);
  $('#taskCalendar').classList.toggle('hidden',v!=='calendar');
  $('#taskFilter').style.display = v==='list'?'':'none';
  if(v==='calendar'){ renderCalendar(); $('#taskEmpty').classList.add('hidden'); }
}
function renderTaskArea(){
  if(State.taskView==='calendar') renderCalendar();
  else renderTaskList();
}

/* =============================================================
   模块三：工作总结
   ============================================================= */
function renderLogDate(){ $('#logDate').textContent = todayStr(); }
function renderLogHistory(){
  const wrap=$('#logHistory'); wrap.innerHTML='';
  const dates=Object.keys(State.log).sort().reverse();
  if(!dates.length){ wrap.innerHTML='<div style="color:var(--ink-3);font-size:12px;padding:6px 4px">还没有历史日志</div>'; return; }
  dates.forEach(ds=>{
    const item=document.createElement('div'); item.className='log-item';
    const txt=State.log[ds];
    const hasSum=State.aiSummaries[ds];
    item.innerHTML=`<div class="log-item-date"><span>${ds}</span>${hasSum?'<span class="sum-badge">✓ AI已归纳</span>':''}</div>
      <div class="log-item-text">${esc(txt.length>80?txt.slice(0,80)+'…':txt)}</div>`;
    item.style.cursor='pointer';
    item.onclick=()=>{ $('#logInput').value=State.log[ds]||''; if(State.aiSummaries[ds]) renderAiSummary(ds); };
    wrap.appendChild(item);
  });
}
function aiSummarize(text){
  const sent=text.split(/[。；\n！？!?]/).map(s=>s.trim()).filter(s=>s.length>1);
  const items=[];
  sent.forEach(s=>{
    let core=s.replace(/^(上午|下午|今天|昨晚|中午|晚上|早上|本日|本周|昨日|刚才)\s*[，,、:：]?\s*/,'');
    items.push(core.replace(/\s{2,}/g,' '));
  });
  const kws=['完成','修复','推进','编写','调研','评审','上线','实现','优化','开发','处理','解决','维护','调试','设计','沟通','复盘','整理','阅读','学习','测试','发布','对接','参加','准备'];
  const taskItems=sent.filter(s=>kws.some(k=>s.includes(k))).slice(0,6);
  const highlights = taskItems.length? taskItems : items.slice(0,6);
  const totalItems = items.length;
  const catMap=[['开发|代码|接口|bug|模块|功能|上线|实现','开发'],['会议|评审|对齐|沟通|协调|汇报|讨论','沟通协作'],['文档|方案|需求|设计|原型|PRD|写作','文档方案'],['数据|分析|测试|优化|复盘|调研|整理','分析复盘']];
  let topCat='综合推进'; let topN=0;
  catMap.forEach(([re,label])=>{
    const n=sent.filter(s=>new RegExp(re).test(s)).length;
    if(n>topN){topN=n;topCat=label;}
  });
  const goodKw=['完成','修复','上线','搞定','解决','实现','通过'];
  const good=sent.filter(s=>goodKw.some(k=>s.includes(k))).length;
  const eff=Math.min(98, Math.round(52+good*9+sent.length*2));
  const kpis=[{l:'记录事项',v:totalItems},{l:'关键成果',v:highlights.length},{l:'推进效率',v:eff+'%'}];
  const summary=`今日共记录 ${totalItems} 项工作，重心集中在「${topCat}」方向${taskItems.length?`，其中 ${taskItems.length} 项构成主要产出`:''}。${good?`有 ${good} 条可识别为完成/闭环事项，整体推进节奏${eff>=80?'良好':'正常'}。`:''}建议下一步聚焦高优先级遗留项，并在收尾时同步进展给相关协作方。`;
  return {kpis, items:highlights, summary};
}
function renderAiSummary(ds){
  const s=State.aiSummaries[ds];
  const out=$('#reportOut');
  if(!s){ out.innerHTML='<div class="placeholder">该日期暂无AI总结</div>'; return; }
  out.innerHTML=`
    <div style="font-size:11px;color:var(--ink-3);margin-bottom:5px;font-family:var(--mono)">日期 ${ds}</div>
    <div class="sum-kpi">${s.kpis.map(k=>`<div class="kpi"><b>${k.v}</b><span>${k.l}</span></div>`).join('')}</div>
    <div class="sum-head">工作要点归纳</div>
    <ul>${s.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>
    <div class="sum-head">总体小结</div>
    <div class="sum-text">${esc(s.summary)}</div>`;
}
function doSummarize(){
  const text=$('#logInput').value.trim();
  if(!text){ toast('请先填写今日工作内容','warn'); return; }
  const ds=todayStr();
  State.log[ds]=text;
  const res=aiSummarize(text);
  State.aiSummaries[ds]=res;
  save(); renderLogHistory();
  renderAiSummary(ds);
  toast('已保存并生成 AI 总结 ✓');
}
function periodReport(){
  const period=$('#reportPeriod').value;
  const now=new Date();
  let start,end,label;
  if(period==='week'){
    const dow=now.getDay()||7; start=fmtDay(new Date(now.getTime()-(dow-1)*86400000)); end=fmtDay(now);
    label=`本周（${start.slice(5)} ~ ${end.slice(5)}）`;
  }else if(period==='month'){
    start=fmtDay(new Date(now.getFullYear(),now.getMonth(),1)); end=fmtDay(now);
    label=`${now.getMonth()+1}月`;
  }else{
    const q=Math.floor(now.getMonth()/3); start=fmtDay(new Date(now.getFullYear(),q*3,1)); end=fmtDay(now);
    label=`第${q+1}季度`;
  }
  const logs=Object.keys(State.log).filter(d=>d>=start&&d<=end);
  if(!logs.length){ toast(`本${period==='week'?'周':period==='month'?'月':'季度'}暂无日志记录`,'warn'); return; }
  let totalText=''; const allItems=[];
  logs.forEach(d=>{ totalText+=(State.log[d]||'')+'。'; const s=State.aiSummaries[d]; if(s&&s.items) allItems.push(...s.items); });
  const uniq=[...new Set(allItems)].slice(0,10);
  const days=logs.length;
  const kpis=[{l:'记录天数',v:days+'天'},{l:'累计事项',v:Math.max(allItems.length,totalText.split(/[。；\n]/).filter(Boolean).length)},{l:'关键产出',v:uniq.length+'项'}];
  $('#periodReportWrap').classList.add('show');
  $('#periodReportTitle').textContent=`周期总结 · ${label}`;
  const wd=period==='week'?'本周':period==='month'?'本月':'本季度';
  $('#periodReportBody').innerHTML=`<div class="period-kpis">${kpis.map(k=>`<div class="kpi"><b>${k.v}</b><span>${k.l}</span></div>`).join('')}</div>
    <div class="sum-head">${wd}工作成果</div>
    <ul>${uniq.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>
    <div class="sum-head">总体评价</div>
    <div class="sum-text">${wd}共 ${days} 个工作日有内容沉淀，覆盖了上述核心产出方向。整体工作节奏${days>=5?'稳定且连贯':'尚有部分断档'}。${allItems.length>8?'工作量与覆盖度都较饱满':'事项较为聚焦'}。建议下一${period==='week'?'周':period==='month'?'月':'季度'}优先聚焦重复出现的高价值事项。</div>`;
}
function initReportModule(){
  $('#logDate').textContent=todayStr();
  $('#logSaveBtn').onclick=doSummarize;
  $('#logClearBtn').onclick=()=>{ $('#logInput').value=''; $('#reportOut').innerHTML='<div class="placeholder">填写并保存后，<br>这里会生成结构化的 AI 总结。</div>'; toast('输入已清空'); };
  $('#reportGenBtn').onclick=periodReport;
  $('#periodReportClose').onclick=()=>$('#periodReportWrap').classList.remove('show');
}

/* =============================================================
   模块四：灵感记录
   ============================================================= */
function aiDiverge(idea){
  const kw=[
    {re:'app|产品|功能|用户|需求',topic:'产品构想',angles:['核心用户与痛点','MVP最小可用功能','商业化路径','关键指标']},
    {re:'写作|文章|文案|公众号|内容|故事|选题',topic:'内容创作',angles:['读者人群画像','黄金开头钩子','内容结构','传播与互动']},
    {re:'视频|拍|账号|短视频|直播|脚本',topic:'视频内容',angles:['爆款选题','3秒开场','分镜脚本','涨粉与变现']},
    {re:'设计|视觉|封面|ui|配色|风格',topic:'创意设计',angles:['视觉关键词','参考风格','配色与字体','落地场景']},
    {re:'项目|创业|方向|点子|商机|想法',topic:'商业机会',angles:['市场规模','竞争差异','最小成本','快速试错']},
    {re:'学习|读书|笔记|知识|课程|考试',topic:'学习成长',angles:['知识框架','联想知识点','行动清单','输出检验']},
  ];
  let topic='创意火花'; let match=null;
  kw.forEach(k=>{ if(!match&&new RegExp(k.re).test(idea)){match=k;topic=k.topic;} });
  const angles=match?match.angles:['灵感内核提炼','潜在延伸','可落地行动','长期价值'];
  const tips={
    '灵感内核提炼':['把这句话抽象成一句话假设','这个念头背后真正的动机是什么'],
    '潜在延伸':['如果放大100倍会是什么样','能否与正在做的事叠加产生化学反应'],
    '可落地行动':['记录下第一个最小执行步骤','本周内安排30分钟去验证'],
    '核心用户与痛点':['谁最会被这个想法打动','ta的哪些未被满足的需求被踩中'],
    'MVP最小可用功能':['砍掉80%功能，留下最核心的一个','用一个原型快速测试反应'],
    '商业化路径':['探索订阅/付费/增值三种模式','设计一个让人愿意付费的价值锚点'],
    '关键指标':['用哪个数字衡量它真的有用','北极星指标应该是什么'],
    '读者人群画像':['这类内容谁会主动转发','如何让读者觉得"说的就是我"'],
    '黄金开头钩子':['第一句抛出冲突还是悬念','用具体数字或场景制造代入'],
    '内容结构':['先结论还是先故事','用一个记忆点贯穿全文'],
    '传播与互动':['设计一个让人想评论的提问','金句做结尾增强转发欲'],
    '爆款选题':['第一个画面必须制造反差','用提问或痛点快速抓住注意力'],
    '3秒开场':['把核心动作拆成5个镜头','高光时刻放在前15秒'],
    '涨粉与变现':['哪类人群最容易持续关注','内容如何自然衔接转化'],
    '视觉关键词':['用一个词概括想要的气质','大胆尝试一个反常识的视觉锚点'],
    '参考风格':['列出三个同类风格灵感源','抽象成线条/材质/色彩三要素'],
    '配色与字体':['选定一个主色+一个强调色','字体传达冷感还是温度'],
    '落地场景':['先在哪个最小场景试跑','给这个想法找个立刻能用的宿主'],
    '市场规模':['这个需求是痛点还是痒点','天花板有多高、增速如何'],
    '竞争差异':['现有方案差在哪里','我凭什么做得更好'],
    '最小成本':['不需要烧钱的第一步是什么','能不能先用现有资源跑通'],
    '快速试错':['找个真实用户聊一次','做一个能测量意向的最小demo'],
    '知识框架':['这个知识点和已有认知如何挂钩','画一张一句话关系图'],
    '联想知识点':['三个跨领域案例与之呼应','能不能用一个比喻讲透它'],
    '行动清单':['今晚就能做的一件小事','把它排进日程而不是收藏夹'],
    '输出检验':['能否用教别人的方式检验理解','写一段100字复述看看'],
    '长期价值':['三个月后它还会让我兴奋吗','哪些部分是普适可复用的'],
  };
  const out=[`「${topic}」启发：${idea.slice(0,28)}${idea.length>28?'…':''}`];
  const pool=angles.map(a=>tips[a]||a);
  pool.forEach((t,i)=>{
    if(i<pool.length) out.push(`延伸方向${i+1} · ${Array.isArray(t)?t.join(' / '):t}`);
  });
  const words=['创意','用户','场景','价值','落地','验证','放大','聚焦','趋势','复利'];
  out.push('发散标签：'+words.sort(()=>Math.random()-.5).slice(0,4).join(' · '));
  return {topic, lines:out.slice(0,4)};
}
function addIdea(text,src='text',doDiverge=true){
  const idea={id:uid(),text,date:new Date().toLocaleString('zh-CN',{hour12:false}),src,diverge:null};
  if(doDiverge&&State.ideaAi){
    const r=aiDiverge(text);
    idea.diverge=r;
  }
  State.ideas.unshift(idea);
  save(); renderIdeas();
}
function renderIdeas(){
  const board=$('#ideaBoard'); board.innerHTML='';
  $('#ideaEmpty').classList.toggle('hidden',State.ideas.length>0);
  State.ideas.forEach(idea=>{
    const c=document.createElement('div'); c.className='idea-card';
    c.innerHTML=`
      <button class="idea-del" title="删除">×</button>
      <div class="idea-meta">
        <span class="idea-src">${idea.src==='voice'?'🎤 语音':idea.src==='text'?'⌨ 手打':'灵感'}</span>
        <span class="idea-date">${esc(idea.date)}</span>
      </div>
      <div class="idea-text">${esc(idea.text)}</div>
      ${idea.diverge?`<div class="idea-diverge">${esc(idea.diverge.lines.join(' · '))}</div>`:''}`;
    c.querySelector('.idea-del').onclick=()=>{ if(confirm('删除这条灵感？')){ State.ideas=State.ideas.filter(x=>x.id!==idea.id); save(); renderIdeas(); toast('已删除'); } };
    board.appendChild(c);
  });
}
function initIdeaModule(){
  $('#ideaSaveBtn').onclick=()=>{ const v=$('#ideaInput').value.trim(); if(!v){toast('请输入灵感内容','warn');return;} addIdea(v); $('#ideaInput').value=''; toast('灵感已记录 ✓'); };
  $('#ideaInput').addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); $('#ideaSaveBtn').click(); }
  });
  $('#ideaVoiceBtn').onclick=()=>startVoice('idea');
  $('#ideaAiSwitch').onclick=()=>{
    State.ideaAi=!State.ideaAi;
    $('#ideaAiSwitch').classList.toggle('on',State.ideaAi);
    save(); toast(State.ideaAi?'已开启 AI 灵感发散':'已关闭 AI 灵感发散');
  };
  $('#ideaAiSwitch').classList.add(State.ideaAi?'on':'');
}

/* =============================================================
   语音输入
   ============================================================= */
let recognition=null;
function getRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ toast('当前浏览器不支持语音识别，建议使用 Safari/Chrome/Edge','err'); return null; }
  if(recognition) return recognition;
  recognition=new SR();
  recognition.lang='zh-CN';
  recognition.interimResults=false;
  recognition.continuous=false;
  return recognition;
}
let voiceCtx=null;
function startVoice(ctx){
  const rec=getRecognition(); if(!rec) return;
  voiceCtx=ctx;
  const pill=$('#listenPill');
  pill.classList.remove('hidden');
  $('#listenPillText').textContent= ctx==='task'?'请说出要添加的任务…':'请说出此刻的灵感…';
  rec.onstart=()=>{ $('#listenPillText').textContent= ctx==='task'?'正在聆听…':'正在聆听你的灵感…'; };
  rec.onresult=e=>{
    const text=e.results[0][0].transcript.trim();
    if(!text) return;
    if(ctx==='task') aiParseTask(text);
    else showIdeaVoiceText(text);
  };
  rec.onerror=ev=>{
    pill.classList.add('hidden');
    if(ev.error==='not-allowed') toast('麦克风权限被拒绝，请在浏览器中允许','err');
    else if(ev.error==='no-speech') toast('未检测到声音','warn');
    else toast('语音识别出错：'+ev.error,'err');
  };
  rec.onend=()=>{ pill.classList.add('hidden'); };
  try{ rec.start(); }
  catch(e){ toast('语音已占用，请稍后再试','warn'); pill.classList.add('hidden'); }
}
function aiParseTask(text){
  const bar=$('#taskParseBar'); bar.classList.remove('hidden');
  let title=text; let subs=[]; let period='none', prio=2, date=todayStr();
  if(/很重要|紧急|加急|优先|高优先级/.test(title)){prio=1;title=title.replace(/很重要|很紧急|紧急|加急|优先|高优先级/g,'').trim();}
  else if(/不着急|低优先级/.test(title)){prio=3;title=title.replace(/不着急|低优先级/g,'').trim();}
  const pMap=[['每天|每日|天天',()=>period='daily'],['工作日|周一到周五',()=>period='weekday'],['每周|每星期',()=>period='weekly'],['每月|每个月',()=>period='monthly']];
  pMap.forEach(([re,fn])=>{ if(new RegExp(re).test(title)){fn(); title=title.replace(new RegExp(re,'g'),'');} });
  const colon=title.match(/[：:]\s*(.+)/);
  if(colon){ subs=colon[1].split(/[、，,和及与]/).filter(s=>s.trim()&&s.length>1).map(s=>s.trim().replace(/[。.!！?？]/g,'')); title=title.split(/[：:]/)[0].trim(); }
  else if(title.includes('然后')){ subs=title.split(/然后/).slice(1).map(s=>s.trim()).filter(Boolean); title=title.split(/然后/)[0].trim(); }
  ['请','帮我','麻烦','我想','我要','去','做一下','记得'].forEach(w=>{ title=title.replace(new RegExp('^'+w),''); });
  title=title.replace(/^(完成|记录|添加|建立|创建一个?任务叫|任务叫)/,'').trim();
  title=title.replace(/[。.!！?？]$/,'').trim() || '未命名任务';
  window.__taskParse={title,subs,period,prio,date,raw:text};
  $('#taskParseText').innerHTML=`<b>识别：</b>「${esc(title)}」${period!=='none'?' · '+PERIOD_LABEL[period]:''}${subs.length?' · '+subs.length+'个子任务':''}`;
}
function showIdeaVoiceText(text){
  $('#ideaParseBar').classList.remove('hidden');
  window.__ideaParse=text;
  $('#ideaParseText').innerHTML=`「${esc(text)}」`;
}
function applyTaskParse(){
  if(!window.__taskParse) return;
  const p=window.__taskParse;
  openTaskModal(p.title);
  $('#tmPeriod').value=p.period; $('#tmDate').value=p.date;
  if(p.subs.length) tmSubs=p.subs.slice(0,5);
  tmPrio=p.prio; renderPrioPick(); renderSubChips();
  $('#taskParseBar').classList.add('hidden');
}
function cancelTaskParse(){ window.__taskParse=null; $('#taskParseBar').classList.add('hidden'); }
function applyIdeaParse(){
  const text=window.__ideaParse; if(!text) return;
  addIdea(text,'voice',State.ideaAi);
  $('#ideaParseBar').classList.add('hidden');
  $('#ideaInput').value='';
  toast('灵感已保存 🎤');
}
function cancelIdeaParse(){ window.__ideaParse=null; $('#ideaParseBar').classList.add('hidden'); }

/* =============================================================
   主题切换
   ============================================================= */
function applyTheme(t){
  State.theme=t;
  document.body.setAttribute('data-theme', t);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', getComputedStyle(document.body).getPropertyValue('--theme-color').trim());
  const icons={warm:'◐',cold:'❄',night:'☾'};
  $('#themeIcon').textContent=icons[t];
  // 主题卡片高亮
  $$('.theme-card').forEach(c=>c.classList.toggle('active', c.dataset.theme===t));
  save();
}
function initTheme(){
  $$('.theme-card').forEach(c=>c.onclick=()=>{
    applyTheme(c.dataset.theme);
    $('#themePanel').classList.add('hidden');
    toast('已切换为'+(c.querySelector('b').textContent));
  });
  $('#themeBtn').onclick=()=>$('#themePanel').classList.toggle('hidden');
  $('#menuBtn').onclick=()=>$('#themePanel').classList.toggle('hidden');
  $('#themeClose').onclick=()=>$('#themePanel').classList.add('hidden');
  $('#clearDataBtn').onclick=()=>{
    if(confirm('确定清除所有本地数据？此操作不可恢复。')){
      localStorage.removeItem(Store.key);
      localStorage.removeItem('wbapp_seeded');
      location.reload();
    }
  };
  applyTheme(State.theme);
}

/* =============================================================
   导航 / 初始化
   ============================================================= */
function switchModule(mod){
  $$('.module').forEach(s=>s.classList.toggle('hidden', s.id!=='mod-'+mod));
  $$('.tab').forEach(b=>b.classList.toggle('active', b.dataset.mod===mod));
  if(mod==='news'){ renderNewsTabs(); renderNews(); }
  if(mod==='task') renderTaskArea();
  if(mod==='report'){ renderLogHistory(); renderAiSummary(todayStr()); }
  if(mod==='idea') renderIdeas();
  try{ history.replaceState(null,'','#'+mod); }catch(e){}
  // scroll to top on tab change
  try{ const el=document.querySelector('.app'); if(el&&el.scrollTo) el.scrollTo({top:0,behavior:'instant'}); }catch(e){}
  try{ if(window.scrollTo) window.scrollTo({top:0,behavior:'instant'}); }catch(e){}
}
function renderToday(){
  const n=new Date();
  const h=n.getHours();
  $('#brandSub').textContent = (h<6?'夜深':h<12?'早安':h<18?'午安':h<22?'晚安':'夜深')+' · '+n.toLocaleDateString('zh-CN',{month:'long',day:'numeric'});
}
function updateHello(){
  const h=new Date().getHours();
  $('#greetText').textContent = h<6?'夜深了，注意休息':h<12?'早上好':h<18?'下午好':'晚上好';
  const todos=State.tasks.filter(t=>{ if(t.period==='none')return !t.done&&t.date===todayStr(); return !(t.doneDates||[]).includes(todayStr()); }).length;
  $('#helloTasks').textContent=todos;
  $('#helloDone').textContent=State.tasks.filter(t=>{ if(t.period==='none')return t.done; return (t.doneDates||[]).includes(todayStr()); }).length;
}
function save(){
  Store.write({
    tasks:State.tasks, log:State.log, aiSummaries:State.aiSummaries,
    ideas:State.ideas, ideaAi:State.ideaAi, theme:State.theme,
  });
}
function load(){
  const d=Store.read(); if(!d) return;
  if(Array.isArray(d.tasks)) State.tasks=d.tasks;
  if(d.log) State.log=d.log;
  if(d.aiSummaries) State.aiSummaries=d.aiSummaries;
  if(Array.isArray(d.ideas)) State.ideas=d.ideas;
  if(typeof d.ideaAi==='boolean') State.ideaAi=d.ideaAi;
  if(['warm','cold','night'].includes(d.theme)) State.theme=d.theme;
}
function seedDemo(){
  if(!State.tasks.length){
    const ds=todayStr();
    State.tasks.push(
      {id:uid(),title:'复盘本周AI产品调研报告',subs:[{text:'整理竞品功能对比',done:true},{text:'提炼3条可借鉴点',done:false}],period:'none',date:ds,prio:1,done:false,doneDates:[]},
      {id:uid(),title:'每日站会同步进展',period:'weekday',date:ds,prio:2,done:false,doneDates:[ds],subs:[]},
      {id:uid(),title:'阅读一篇行业深度文章',period:'weekly',date:ds,prio:3,done:false,doneDates:[],subs:[]}
    );
  }
  if(!State.log[todayStr()]){
    State.log[todayStr()]='上午完成AI产品需求评审，与设计对齐新版工作台视觉。下午修复登录模块3个bug并上线，还输出了本周周报大纲。';
    State.aiSummaries[todayStr()]=aiSummarize(State.log[todayStr()]);
  }
  if(!State.ideas.length){
    State.ideas=[
      {id:uid(),text:'做一个"一句话把想法讲清楚"的灵感卡片工具',date:new Date().toLocaleString('zh-CN',{hour12:false}),src:'手打',diverge:{topic:'产品构想',lines:['「产品构想」启发：灵感卡片工具','延伸方向1 · 核心用户与痛点','延伸方向2 · MVP最小可用功能','延伸方向3 · 商业化路径']}}
    ];
  }
  save();
}

/* PWA 安装 + service worker */
let deferredPrompt=null;
function setupPWA(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    setTimeout(()=>{
      if(!localStorage.getItem('wbapp_install_dismissed')){
        $('#installTip').classList.remove('hidden');
      }
    },3000);
  });
  $('#installDismiss').onclick=()=>{ $('#installTip').classList.add('hidden'); localStorage.setItem('wbapp_install_dismissed','1'); };
  // 区分平台提示
  const ua=navigator.userAgent.toLowerCase();
  let hint='在浏览器菜单选择「添加到主屏幕」即可像 App 一样使用';
  if(ua.includes('iphone')||ua.includes('ipad')) hint='在 Safari 中点击分享按钮 → 添加到主屏幕';
  else if(ua.includes('android')) hint='在浏览器菜单中选择「添加到主屏幕」或「安装应用」';
  $('#installHint').textContent=hint;
}

function init(){
  load();
  freshNews(true);
  renderToday();
  // 主题必须在 DOM 渲染前应用
  applyTheme(State.theme);
  // tab 导航
  $$('.tab').forEach(b=>b.onclick=()=>switchModule(b.dataset.mod));
  // 模块初始化
  initNews();
  initTaskModule();
  initReportModule();
  initIdeaModule();
  initTheme();
  // AI解析按钮
  $('#taskParseApply').onclick=applyTaskParse;
  $('#taskParseCancel').onclick=cancelTaskParse;
  $('#ideaParseApply').onclick=applyIdeaParse;
  $('#ideaParseCancel').onclick=cancelIdeaParse;
  // 助手 banner 语音快速按钮
  $('#quickVoice').onclick=()=>startVoice('task');
  // 默认模块（按 #hash 或 news）
  const hash=(location.hash||'').replace('#','');
  const target=['news','task','report','idea'].includes(hash)?hash:'news';
  switchModule(target);
  // 初始填入今日日志
  if(State.log[todayStr()]){ $('#logInput').value=State.log[todayStr()]; }
  renderTaskArea();
  renderIdeas();
  renderLogHistory();
  updateHello();
  // 首次种子数据
  if(!localStorage.getItem('wbapp_seeded')){
    seedDemo();
    localStorage.setItem('wbapp_seeded','1');
    // 种子后再渲染一次
    renderTaskArea(); renderIdeas(); renderLogHistory();
  }
  setupPWA();
}
document.addEventListener('DOMContentLoaded', init);