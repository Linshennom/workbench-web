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
  key:'wbapp_data_v2',
  read(){ try{ return JSON.parse(localStorage.getItem(this.key)) || null; }catch(e){ return null; } },
  write(d){ localStorage.setItem(this.key, JSON.stringify(d)); }
};

/* 状态 */
const State = {
  tasks: [],
  newsCat:'daily',
  newsCats:null,
  newsData:null,
  taskView:'list',
  taskFilter:'all',
  log: {},
  aiSummaries:{},
  ideas: [],
  ideaAi:true,
  aiModels:[],
  calYear:new Date().getFullYear(),
  calMonth:new Date().getMonth(),
  theme:'warm',
};

/* =============================================================
   模块一：最新资讯
   ============================================================= */
/* 分类主表：全部为浏览器可直连的真实数据源（CORS 已开放、无需 API Key） */
const NEWS_MASTER = [
  {id:'daily', name:'每日热点', icon:'◎', src:'sixty', path:'/60s',        label:'60 秒读世界'},
  {id:'ai',    name:'AI 前沿',  icon:'✦', src:'aihot', path:'/items?mode=selected&window=24h&limit=20', label:'AI HOT'},
  {id:'weibo', name:'微博热搜', icon:'❂', src:'sixty', path:'/weibo',      label:'微博'},
  {id:'zhihu', name:'知乎热榜', icon:'◆', src:'sixty', path:'/zhihu',      label:'知乎'},
  {id:'douyin',name:'抖音热榜', icon:'◈', src:'sixty', path:'/douyin',     label:'抖音'},
  {id:'baidu', name:'百度热搜', icon:'❖', src:'sixty', path:'/baidu/hot',  label:'百度'},
  {id:'game',    name:'游戏资讯', icon:'🎮', src:'local', file:'data/game_news.json',    label:'游戏媒体'},
  {id:'finance', name:'财经资讯', icon:'📈', src:'local', file:'data/finance_news.json', label:'财经要闻'},
  {id:'realtime',name:'实时全网', icon:'⚡', src:'ai', label:'AI 联网检索（推荐通义千问）'},
];
const API_BASE = { sixty:'https://60s.viki.moe/v2', aihot:'https://aihot.virxact.com/api/v1' };

/* 用户自定义的分类展示配置：数组 [{id, enabled}]，顺序即展示顺序 */
function defaultNewsCats(){
  return NEWS_MASTER.map(c=>({id:c.id, enabled:true}));
}
/* 拼出当前应展示的分类数组（按用户顺序、过滤掉关闭的，并补齐缺失项） */
function getNewsCats(){
  let cfg = (State.newsCats && State.newsCats.length) ? State.newsCats.slice() : defaultNewsCats();
  const ids = cfg.map(x=>x.id);
  NEWS_MASTER.forEach(c=>{ if(!ids.includes(c.id)) cfg.push({id:c.id, enabled:true}); });
  return cfg
    .filter(x=>x.enabled)
    .map(x=>NEWS_MASTER.find(c=>c.id===x.id))
    .filter(Boolean);
}
/* 按 id 取分类定义（始终从主表查，避免顺序/开关影响） */
function findCat(id){ return NEWS_MASTER.find(c=>c.id===id) || null; }

/* ---- 格式化工具 ---- */
function fmtHeat(n){
  if(n==null||n==='') return '';
  n=Number(n); if(!isFinite(n)) return String(n);
  if(n>=1e8) return (n/1e8).toFixed(1)+'亿';
  if(n>=1e4) return (n/1e4).toFixed(1)+'万';
  return String(n);
}
function fmtAgo(iso){
  if(!iso) return '';
  const t=new Date(iso).getTime(); if(!t) return '';
  const d=Date.now()-t;
  if(d<3600000) return Math.max(1,Math.floor(d/60000))+' 分钟前';
  if(d<86400000) return Math.floor(d/3600000)+' 小时前';
  return Math.floor(d/86400000)+' 天前';
}
function fmtMinsAgo(at){
  if(!at) return '';
  const m=Math.round((Date.now()-at)/60000);
  if(m<1) return '刚刚更新';
  if(m<60) return m+' 分钟前更新';
  return Math.floor(m/60)+' 小时前更新';
}

/* ---- 归一化：把不同数据源统一成 {t,d,tag,url,heat,time,src} ---- */
const SIXTY_NAME={weibo:'微博热搜', zhihu:'知乎热榜', douyin:'抖音热榜', baidu:'百度热搜'};
function normSixty(catId, payload){
  const d=payload&&payload.data;
  if(!d) return [];
  if(catId==='daily'){
    return (d.news||[]).map(t=>({
      t, d:'', tag:'要闻', url:d.link||'', heat:'', time:d.date||'', src:'每日 60 秒'
    }));
  }
  const list=Array.isArray(d)? d : (d.list||d.items||[]);
  return list.map(it=>({
    t: it.title||'',
    d: it.detail||it.desc||it.excerpt||'',
    tag: SIXTY_NAME[catId]||'热榜',
    url: it.link||it.url||'',
    heat: it.hot_value!=null? fmtHeat(it.hot_value) : (it.hot!=null? fmtHeat(it.hot) : ''),
    time: '',
    src: SIXTY_NAME[catId]||'热榜',
  })).filter(x=>x.t);
}
const AI_CAT={ 'ai-models':'模型发布', 'ai-products':'产品工具', 'industry':'行业动态', 'paper':'论文', 'tip':'观点技巧' };
function normAihot(payload){
  const items=(payload&&payload.items)||[];
  return items.map(it=>({
    t: it.title||'',
    d: it.summary||'',
    tag: AI_CAT[it.category]||'AI',
    url: (it.links&&it.links.original)||(it.links&&it.links.aihot)||'',
    heat: it.score!=null? '热度 '+it.score : '',
    time: fmtAgo(it.publishedAt||it.discoveredAt),
    src: (it.source&&it.source.name)||'AI HOT',
  }));
}

/* ---- 带超时的 JSON 拉取 ---- */
async function fetchJSON(url, ms=12000){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(), ms);
  try{
    const r=await fetch(url,{signal:ctl.signal, headers:{Accept:'application/json'}});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  }finally{ clearTimeout(timer); }
}

/* ---- 缓存：内存优先，localStorage 兜底离线 ---- */
const NEWS_TTL=5*60*1000;
const newsCache={};
function newsCacheKey(id){ return 'wb_news_'+id; }
function readNewsCache(id){
  const hit=newsCache[id];
  if(hit && Date.now()-hit.at < NEWS_TTL) return hit;
  try{
    const raw=localStorage.getItem(newsCacheKey(id));
    if(raw){
      const o=JSON.parse(raw);
      if(o && o.items && Date.now()-o.at < NEWS_TTL*12){ newsCache[id]=o; return o; }
    }
  }catch(e){}
  return hit||null;
}
function writeNewsCache(id, items){
  const o={at:Date.now(), items};
  newsCache[id]=o;
  try{ localStorage.setItem(newsCacheKey(id), JSON.stringify(o)); }catch(e){}
}
async function loadCategory(catId, force){
  const cfg=findCat(catId);
  if(!cfg) throw new Error('未知分类');
  if(!force){
    const c=readNewsCache(catId);
    if(c) return {items:c.items, at:c.at, stale:Date.now()-c.at>=NEWS_TTL};
  }
  let items;
  if(cfg.src==='local'){
    const payload=await fetchJSON(cfg.file);
    items=(payload&&payload.items)||[];
  }else if(cfg.src==='ai'){
    /* 「AI 联网检索」分类：内容由设置里启用的大模型实时检索生成。
       Kimi/Moonshot 模型走内置 $web_search 真联网；其余模型基于知识尽力而为。 */
    const llm=getActiveAiModel();
    if(!llm) throw new Error('请先在「设置 → AI 大模型」启用并填好一个模型（通义千问可获得快而真的联网检索）');
    items=await callLLMSearchNews(cfg, llm, aiNewsSeeds(catId));
  }else{
    const payload=await fetchJSON(API_BASE[cfg.src]+cfg.path);
    items = cfg.src==='aihot'? normAihot(payload) : normSixty(catId, payload);
    /* 微博热搜：主源只给标题+热度。并行拉取增强源补上「微博官方话题分类」，
       让每条都有可读的归类内容（艺人/民生/综艺/突发…）。增强源失败不影响主列表。 */
    if(cfg.src==='sixty' && catId==='weibo'){
      await enrichWeiboCategories(items).catch(()=>{});
    }
  }
  if(!items.length) throw new Error('数据源暂时没有内容');
  writeNewsCache(catId, items);
  return {items, at:Date.now(), stale:false};
}
/* 微博热搜官方分类增强源（fork of 60s，CORS 开放，附带真实 category）
   按标题合并到主列表每条，字段存于 n.wbcat / n.wbtime */
const WEIBO_CAT_URL='https://hot.shaomingbo.com/v2/weibo';
async function enrichWeiboCategories(items){
  if(!items || !items.length) return items;
  try{
    const payload=await fetchJSON(WEIBO_CAT_URL, 6000);
    const list=(payload&&payload.data)||[];
    const byTitle=new Map();
    list.forEach(x=>{ if(!byTitle.has(x.title)) byTitle.set(x.title,x); });
    items.forEach(n=>{
      const m=byTitle.get(n.t);
      if(m){
        if(m.category) n.wbcat=String(m.category).trim();
        if(m.onboardTime){
          n.wbtime=String(m.onboardTime).trim();
          // 顺带把「上榜时间」转成友好相对时间，用于列表展示
          const rel=fmtAgo(n.wbtime.replace(' ','T'));
          if(rel) n.time=rel;
        }
        // 若主源缺 url，用增强源的搜索链接补齐
        if(!n.url && m.link) n.url=String(m.link);
      }
    });
  }catch(e){ /* 静默：增强源不可用时保留纯标题列表 */ }
  return items;
}

/* ---- 分类加载状态机 ---- */
const newsState={};
const newsInflight={};
function ensureCategory(catId, force){
  if(!force && newsState[catId] && (newsState[catId].items || newsState[catId].error)) return Promise.resolve();
  if(newsInflight[catId]) return newsInflight[catId];
  newsState[catId]=Object.assign({}, newsState[catId], {loading:true, error:null});
  renderNewsTabs();
  if(State.newsCat===catId) renderNews();
  const p=(async()=>{
    try{
      const r=await loadCategory(catId, force);
      newsState[catId]={items:r.items, at:r.at, stale:r.stale, loading:false, error:null};
    }catch(e){
      newsState[catId]=Object.assign({}, newsState[catId], {loading:false, error:e.message||'网络异常'});
    }finally{
      delete newsInflight[catId];
      renderNewsTabs();
      if(State.newsCat===catId) renderNews();
    }
  })();
  newsInflight[catId]=p;
  return p;
}

function renderNewsTabs(){
  const tabs=$('#newsTabs'); tabs.innerHTML='';
  const cats=getNewsCats();
  /* 当前激活分类如果被关闭，自动回退到第一个可见分类 */
  if(!cats.some(c=>c.id===State.newsCat)) State.newsCat = cats.length? cats[0].id : 'daily';
  cats.forEach(c=>{
    const st=newsState[c.id];
    const n=st&&st.items? st.items.length : 0;
    const b=document.createElement('button');
    b.className='cat-tab'+(c.id===State.newsCat?' active':'');
    b.dataset.cat=c.id;
    b.innerHTML=`<span>${c.icon} ${c.name}</span><span class="cat-count">${st&&st.loading?'…':(st&&st.error?'!':n)}</span>`;
    b.onclick=()=>{ State.newsCat=c.id; renderNewsTabs(); renderNews(); ensureCategory(c.id); };
    tabs.appendChild(b);
  });
}

function renderNews(){
  const cat=State.newsCat;
  const cfg=findCat(cat)||NEWS_MASTER[0];
  const st=newsState[cat];
  const list=$('#newsList');
  const brief=$('#newsBrief');
  list.innerHTML='';
  if(!st || st.loading){
    brief.innerHTML=`<b>${esc(cfg.name)}</b><span>正在从 ${esc(cfg.label)} 拉取实时数据…</span>`;
    list.innerHTML=Array.from({length:5}).map(()=>
      `<div class="news-card sk-card"><div class="sk-line w1"></div><div class="sk-line w2"></div></div>`).join('');
    return;
  }
  if(st.error){
    brief.innerHTML=`<b>${esc(cfg.name)}</b><span class="warn-text">拉取失败：${esc(st.error)}</span>`;
    list.innerHTML=`<div class="news-empty"><div class="ne-icon">📡</div><p>没能连上 ${esc(cfg.label)}</p><span>检查网络后点「刷新」重试</span></div>`;
    return;
  }
  const items=st.items||[];
  brief.innerHTML=`<b>${esc(cfg.name)}</b><span>${esc(cfg.label)} · ${items.length} 条 · ${st.stale?'缓存':'实时'} · ${esc(fmtMinsAgo(st.at))}</span>`;
  if(!items.length){
    list.innerHTML=`<div class="news-empty"><div class="ne-icon">🗒</div><p>暂无内容</p><span>该源当前没有返回条目</span></div>`;
    return;
  }
  items.forEach((n,i)=>{
    const card=document.createElement('div');
    card.className='news-card'+(n.ai?' ai':'');
    card.innerHTML=`
      <div class="news-rank">${n.ai?'✦':(i<9?'0'+(i+1):(i+1))}</div>
      <div>
        <div class="news-meta">
          ${n.ai?'<span class="news-tag aitag">✦ AI 实时</span>':''}
          ${i===0&&!n.ai?'<span class="news-hot">热</span>':''}
          <span class="news-tag">${esc(n.tag||'')}</span>
          ${n.wbcat?`<span class="news-tag wbcat">微博 · ${esc(n.wbcat)}</span>`:''}
          ${n.heat?`<span class="news-heat">${esc(n.heat)}</span>`:''}
          ${n.time?`<span class="news-time">${esc(n.time)}</span>`:''}
        </div>
        <div class="news-title">${esc(n.t)}</div>
        ${n.d?`<div class="news-desc">${esc(n.d)}</div>`:''}
        <div class="news-more">${n.url?'阅读原文 ↗':esc(n.src||'')}</div>
      </div>`;
    card.onclick=()=>openNewsDetail(cat,n,i+1);
    list.appendChild(card);
  });
}

/* 详情：展示真实摘要 + 原文跳转，不再编造正文 */
/* 微博热搜标题 → 话题领域推断（本地启发式） */
const WEIBO_TOPIC_MAP=[
  [/明星|艺人|演员|歌手|导演|剧组|综艺|选秀|红毯|演唱会|粉丝|偶像|CP|出轨|离婚|结婚|恋情|曝光|塌房|爆料|八卦|路透/,'娱乐明星'],
  [/电影|剧集|电视剧|番剧|动画|动漫|票房|上映|杀青|预告片|影评| Hollywood/,'影视综艺'],
  [/手机|电脑|芯片|AI|人工智能|自动驾驶|电动车|新能源|科技|数码|发布会|iPhone|华为|小米|特斯拉|元宇宙|直播带货|电商|互联网/,'科技数码'],
  [/股市|A股|港股|美股|基金|汇率|通胀|央行|降息|加息|房价|楼市|油价|黄金|比特币|经济|财报|IPO|破产|裁员|就业|社保|医保/,'财经商业'],
  [/地震|洪水|台风|暴雨|暴雪|高温|干旱|火灾|爆炸|事故|灾难|救援|伤亡|遇难|失联/,'灾害事故'],
  [/疫情|新冠|病毒|疫苗|流感|医院|医生|手术|药物|健康|养生|体检|医保/,'健康医疗'],
  [/高考|中考|考研|留学|录取|分数|大学|学校|教师|教育|双减|教材/,'教育文化'],
  [/国足|世界杯|NBA|CBA|奥运|亚运会|冠军|决赛|金牌|球员|教练|转会|联赛|网球|乒乓球/,'体育竞技'],
  [/外交|美国|日本|韩国|俄罗斯|乌克兰|台湾|香港|中东|北约|联合国|制裁|访华|访华|使馆/,'国际时政'],
  [/政策|新规|立法|两会|国务院|发改委|税务局|央行|公务员|编制|户籍|限购|限行|补贴/,'政策政务'],
  [/美食|穿搭|旅游|旅行|酒店|景点|打卡|探店|减肥|健身|瑜伽|护肤|化妆/,'生活方式'],
];
function inferWeiboTopics(title){
  const t=String(title||'');
  const tags=[];
  for(const [re,label] of WEIBO_TOPIC_MAP){ if(re.test(t)) tags.push(label); }
  if(!tags.length) tags.push('社会热点');
  return [...new Set(tags)].slice(0,3);
}
/* 微博官方分类 → 一句阅读引导（让详情不至于只有一句干巴巴的话） */
const WEIBO_CAT_GUIDE={
  '艺人':'属娱乐圈人物动态，通常围绕明星个人事件或公开露面，博文以粉丝讨论与娱乐号报道为主。',
  '综艺':'与正在播出的综艺节目相关，常因节目内容、嘉宾表现或名场面登榜。',
  '剧集':'与热播影视剧集相关，多因剧情走向、演员演技或幕后话题引发追剧讨论。',
  '电影':'与院线或网络电影相关，常因口碑、票房、档期或主创宣传上榜。',
  '演出':'指演唱会、音乐节、舞台剧等现场演出事件。',
  '民生新闻':'涉普通百姓日常生活的社会新闻，如就医、出行、就业、社保等，与公众切身利益相关。',
  '突发/灾害':'涉及突发事故或自然灾害，请以官方通报为准，注意信息核实与避险提示。',
  '社会':null,'社会热点':null,
  '国内时政':'与国家政策、政务活动、部委动态相关，可留意权威发布。',
  '海外新闻':'涉及境外国家与地区的时事，多来自驻外记者或国际媒体报道。',
  '财经':'与经济、股市、消费、就业等话题相关，可结合宏观与行业视角判断。',
  '互联网':'涉及互联网公司、平台产品、行业事件，多为科技媒体与从业者关注。',
  '数码':'围绕手机、电脑、智能硬件等消费电子产品及发布动态。',
  '教育':'与升学考试、学校、师生、教育政策相关。',
  '游戏':'围绕游戏产品、赛事、行业动态展开。',
  '情感':'涉及人际感情、两性话题、家庭关系等情感类内容。',
  '幽默':'多为轻松搞笑、逗趣段子或趣味事件，娱乐性内容为主。',
  '体育':'围绕体育赛事、运动员、球队与赛事结果。',
};
function weiboCatGuide(cat){
  if(WEIBO_CAT_GUIDE[cat]===null) return null;
  if(WEIBO_CAT_GUIDE[cat]) return `【阅读提示】${WEIBO_CAT_GUIDE[cat]}`;
  return null;
}
function openNewsDetail(cat,n,rank){
  const cfg=findCat(cat)||NEWS_MASTER[0];
  $('#newsTitle').textContent=n.t;
  $('#newsDetailMeta').innerHTML=
    `<span class="nd-tag">${esc(n.tag||'')}</span>
     <span>${esc(n.src||cfg.label)}</span>
     ${n.time?`<span>${esc(n.time)}</span>`:''}
     <span>第 ${rank} 位</span>`;
  $('#newsDetailHeat').textContent=n.heat||'';
  const paras=[];
  if(n.d) paras.push(n.d);
  // 微博热搜：官方分类 + AI 话题洞察 + 热度解读
  if(cat==='weibo'){
    const topics=inferWeiboTopics(n.t);
    const realCat=n.wbcat||topics[0];
    const heatTxt=n.heat||'';
    paras.push(
      `【话题归类】微博将「${n.t}」归入「${realCat}」话题。` +
      (heatTxt?`当前在榜${heatTxt}的搜索热度，处于全国热搜前列，属于当下大众正在集中关注的事件。`
             :`作为全国热搜在榜话题，反映当下大众注意力的集中方向。`)
    );
    const extra=weiboCatGuide(realCat);
    if(extra) paras.push(extra);
    paras.push(`可点击下方「阅读原文」跳转到微博搜索页，查看该话题下的实时博文与讨论。`);
  } else {
    paras.push(n.url
      ? '以上为该条资讯的原始摘要。完整报道请点击下方「阅读原文」跳转至来源页面查看。'
      : '该榜单来源仅提供标题，暂无更多正文。可在原平台搜索该标题查看完整内容。');
  }
  $('#newsDetailBody').innerHTML=paras.map(p=>`<p>${esc(p)}</p>`).join('');
  const open=$('#newsModalOpen');
  if(n.url){ open.href=n.url; open.classList.remove('hidden'); }
  else open.classList.add('hidden');
  $('#newsModal').classList.remove('hidden');
}
function closeNewsDetail(){ $('#newsModal').classList.add('hidden'); }

async function doNewsRefresh(from){
  const btn=$('#newsRefreshBtn');
  const fab=$('#newsFab');
  btn.classList.add('spinning'); btn.disabled=true;
  fab.classList.add('spinning'); fab.disabled=true;
  $('#newsSyncState').textContent='刷新中…';
  const cur=State.newsCat;
  try{
    await ensureCategory(cur, true);
    const st=newsState[cur];
    if(st && st.error){
      $('#newsSyncState').textContent='刷新失败，可重试';
      toast('刷新失败：'+st.error,'warn');
    }else if(st){
      $('#newsSyncState').textContent='已更新 '+new Date().toTimeString().slice(0,5);
      toast('已拉取 '+st.items.length+' 条实时资讯');
    }
  }catch(e){
    $('#newsSyncState').textContent='刷新失败';
    toast('刷新失败，请检查网络','warn');
  }finally{
    btn.classList.remove('spinning'); btn.disabled=false;
    fab.classList.remove('spinning'); fab.disabled=false;
    setTimeout(()=>{ $('#newsSyncState').textContent='下拉可刷新实时热点'; },4000);
  }
  /* 后台静默预取其余分类，切换时即时可见 */
  getNewsCats().forEach(c=>{ if(c.id!==cur) ensureCategory(c.id); });
}

/* ============================================================
   「AI 实时」联网搜索：用设置里启用的大模型，实时检索/汇总
   当前分类的最新资讯。结果去重后并入列表顶部并标注来源。
   提示：真正的新鲜度取决于你所填模型/网关是否开放联网能力；
   若不支持，AI 会基于其知识汇总近期热点（标注为 AI 实时）。
   ============================================================ */
function aiNewsSeeds(catId){
  const cfg=findCat(catId);
  const seeds=[cfg?cfg.name:''];
  const st=newsState[catId];
  if(st && st.items) seeds.push(...st.items.slice(0,4).map(n=>n.t));
  return [...new Set(seeds.filter(Boolean))].slice(0,5);
}
async function doAiNewsRefresh(){
  const cfg=getActiveAiModel();
  if(!cfg){ toast('请先在「设置 → AI 大模型」里启用并填好一个模型','warn'); return; }
  const cur=State.newsCat;
  const ccfg=findCat(cur);
  const btn=$('#newsAiBtn');
  btn.classList.add('spinning'); btn.disabled=true;
  $('#newsSyncState').textContent='AI 正在联网检索最新'+ccfg.name+'…';
  try{
    const items=await callLLMSearchNews(ccfg, cfg, aiNewsSeeds(cur));
    const fresh=mergeAiNews(cur, items);
    if(!fresh.length){
      $('#newsSyncState').textContent='AI 未发现较新的内容';
      toast('AI 未发现比当前更新的内容','ok');
      return;
    }
    const st=newsState[cur]||(newsState[cur]={items:[],error:null,loading:false,at:Date.now()});
    st.items=[...fresh, ...(st.items||[]).filter(n=>!n.ai)];
    st.aiAt=Date.now(); st.at=Date.now();
    st.error=null; st.loading=false;
    renderNews();
    toast('AI 实时检索到 '+fresh.length+' 条新资讯 ✦','ok');
  }catch(e){
    console.warn('AI 实时搜索失败：', e&&e.message);
    $('#newsSyncState').textContent='AI 检索失败，请重试';
    toast('AI 检索失败：'+friendlyAiErr(e),'warn');
  }finally{
    btn.classList.remove('spinning'); btn.disabled=false;
    setTimeout(()=>{ if(!btn.classList.contains('spinning')) $('#newsSyncState').textContent='点击刷新加载热点'; },4000);
  }
}
/* 把底层运行时错误转成用户可读文案（超时/中断/网络等），其余透出原信息 */
function friendlyAiErr(e){
  const m=String((e&&e.message)||'').toLowerCase();
  if(m.includes('abort')||m.includes('timed out')||m.includes('timeout')||e&&e.name==='AbortError')
    return '请求超时或被中断：Kimi 联网搜索较慢，已放宽到 90 秒。若仍超时请检查网络或换信号好的网络重试';
  if(m.includes('返回内容开头')) return String(e.message);
  if(m.includes('not be parsed')||m.includes('format')||m.includes('unexpected')) return '模型返回内容格式异常，请重试一次';
  return String((e&&e.message)||e||'未知错误');
}
/* 判定该模型配置是否走 Kimi/Moonshot（原生内置 $web_search 联网搜索） */
function isKimiModel(cfg){
  const b=String((cfg&&cfg.baseUrl)||'').toLowerCase();
  return b.includes('moonshot');
}
/* 判定是否走通义千问 / 阿里云百炼 DashScope（OpenAI 兼容端点 enable_search 联网搜索） */
function isQwenModel(cfg){
  const b=String((cfg&&cfg.baseUrl)||'').toLowerCase();
  return b.includes('dashscope') || b.includes('aliyuncs.com') || b.includes('tongyi');
}
/* 规整 baseUrl：去掉结尾斜杠；若填的是常见的域名根（漏了 /v1 或 /compatible-mode/v1），自动补上。
   例：https://api.moonshot.cn         → https://api.moonshot.cn/v1
       https://dashscope.aliyuncs.com  → https://dashscope.aliyuncs.com/compatible-mode/v1 */
function normBaseUrl(baseUrl){
  let b=String(baseUrl||'').trim().replace(/\/+$/,'');
  if(!b) return '';
  if(isQwenModel({baseUrl:b}) && !/\/compatible-mode\/v\d+$/i.test(b) && !/\/v\d+$/i.test(b)){
    b+='/compatible-mode/v1';
  }else if(!/\/v\d+$/i.test(b) && (isKimiModel({baseUrl:b}) || /api\.(deepseek|openai)\.com$/i.test(b))){
    b+='/v1';
  }
  return b;
}
/* 从非 2xx 响应里尽量提取服务端真实错误消息，拼进抛出的 Error */
async function throwRespError(r, fallback){
  let msg=fallback||('HTTP '+r.status);
  try{
    const j=await r.json();
    const em=(j&&j.error&&(j.error.message||j.error)) || (j&&j.message) || (j&&j.error);
    if(em) msg=String(em).slice(0,120);
  }catch(e){ /* 忽略，保留 fallback */ }
  const err=new Error(msg);
  err.status=r.status;
  throw err;
}
/* 解析大模型返回文本里的 JSON 数组（兼容被 ```json 代码块 / 文字 / 多余括号包裹的情况）。
   多级降级：先剥代码块围栏 → 定位首个 [ 到与之配对的 ] → JSON.parse；失败再退回首个[到末尾]启发式。 */
function extractJsonArray(content){
  if(!content) return [];
  let s=String(content);
  s=s.replace(/```(?:json)?/gi,'');   // 去掉 ```json / ``` 围栏
  const start=s.indexOf('[');
  if(start<0) return [];
  // 从首个 [ 起，按深度匹配到闭合的 ]（忽略字符串内部括号的简单处理：只匹配深度，失败再降级）
  let depth=0, inStr=false, esc=false, end=-1;
  for(let i=start;i<s.length;i++){
    const c=s[i];
    if(esc){ esc=false; continue; }
    if(inStr){
      if(c==='\\') esc=true;
      else if(c==='"') inStr=false;
      continue;
    }
    if(c==='"') inStr=true;
    else if(c==='[') depth++;
    else if(c===']'){ depth--; if(depth===0){ end=i; break; } }
  }
  let jsonStr = end>start ? s.slice(start,end+1) : s.slice(start);
  try{ const arr=JSON.parse(jsonStr); return Array.isArray(arr)?arr:[]; }
  catch(e){ /* 括号内字符串含转义异常等，降级到末尾启发式 */ }
  try{
    const m=s.match(/\[[\s\S]*\]/);
    const arr=JSON.parse(m?m[0]:s);
    return Array.isArray(arr)?arr:[];
  }catch(e){ return []; }
}
/* 把通用条目归一化为 App 资讯项 */
function toAiNewsItems(arr, cfgCat){
  return (arr||[]).map(x=>({
    ai:true,
    t:String(x.t||x.title||'').trim(),
    d:String(x.d||x.desc||'').trim(),
    tag:String(x.tag||cfgCat.name||'AI 实时').trim(),
    url:x.url?String(x.url):'',
    heat:x.heat?'AI · '+String(x.heat):'',
    src:'AI 实时',
  })).filter(n=>n.t.length>0);
}
/* 用 Kimi/Moonshot 的 $web_search 原生工具跑一轮对话，返回最终 content。
   关键：先声明 builtin_function，若返回 tool_calls 就把 arguments 原样回传(role=tool)，
   循环直到 finish_reason 不再是 tool_calls。
   Kimi 联网搜索需先在服务端执行检索、再基于海量结果生成完整回答，耗时明显高于普通对话，
   因此超时放宽到 timeoutMs（默认 75s），并设 max_tokens 保证长回答不被截断。 */
async function kimiChatFetch(url, cfg, messages, maxRounds, timeoutMs){
  const headers={'Content-Type':'application/json','Authorization':'Bearer '+cfg.key};
  /* Kimi 仅允许 temperature=1：这里不传该参数（服务端按默认 1 走），否则会 400 invalid temperature */
  const baseBody={model:cfg.model, stream:false, max_tokens: Number(cfg.maxTokens)||4096};
  const perRound=(Number(timeoutMs)&&timeoutMs>0)?timeoutMs:75000;
  let msgs=messages.slice();
  for(let round=0; round<maxRounds; round++){
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(), perRound);
    try{
      const r=await fetch(url,{method:'POST',headers,
        body:JSON.stringify(Object.assign({},baseBody,{messages:msgs,
          tools:[{type:'builtin_function',function:{name:'$web_search'}}]})),
        signal:ctl.signal});
      if(!r.ok) await throwRespError(r, 'HTTP '+r.status);
      const j=await r.json();
      const choice=j && j.choices && j.choices[0];
      const msg=choice && choice.message;
      const content=(msg&&msg.content)||'';
      if(!(msg && msg.tool_calls && msg.tool_calls.length)){
        return content; // 模型已给出最终回答
      }
      // 追加 assistant 消息，并逐个 tool_call 原样回传 arguments
      msgs.push(msg);
      msg.tool_calls.forEach(tc=>{
        msgs.push({role:'tool', tool_call_id:tc.id, name:tc.function.name,
          content:String(tc.function.arguments||'{}')});
      });
    }finally{ clearTimeout(timer); }
  }
  throw new Error('搜索轮次过多');
}
/* 用通义千问/阿里云百炼的 enable_search 原生联网（OpenAI 兼容 chat/completions）。
   与 Kimi 不同：通义只需在请求体顶层加 enable_search:true，服务端自动搜索，返回 content
   即为最终回答，无需 tool_calls 循环 → 更快、更省。qwen 支持正常 temperature。
   timeoutMs 默认 45s（通义比 Kimi 快，但联网搜索仍需缓冲）。 */
async function qwenSearchFetch(url, cfg, messages, timeoutMs){
  const ctl=new AbortController();
  const t=(Number(timeoutMs)&&timeoutMs>0)?timeoutMs:45000;
  const timer=setTimeout(()=>ctl.abort(), t);
  try{
    const body={model:cfg.model, stream:false, temperature:0.5, max_tokens:Number(cfg.maxTokens)||4096,
      enable_search:true, messages};
    const r=await fetch(url,{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body:JSON.stringify(body), signal:ctl.signal});
    if(!r.ok) await throwRespError(r, 'HTTP '+r.status);
    const j=await r.json();
    const c=(j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'';
    return c;
  }finally{ clearTimeout(timer); }
}
/* 调用大模型实时检索某一分类的最新资讯，要求返回紧凑 JSON 数组。
   通义千问(DashScope) enable_search 原生联网（主推，快）；Kimi/Moonshot 用 $web_search；
   其余模型保持原逻辑（能力所限多基于模型知识）。 */
async function callLLMSearchNews(cfgCat, cfg, seeds){
  const base=normBaseUrl(cfg.baseUrl);
  const url=base+'/chat/completions';
  const sys='你是一个实时新闻聚合助手。请针对用户指定的资讯分类，联网检索并汇总当前（最近数小时内）真正新鲜的热点资讯。只输出有效的最新条目，避免过时或重复内容。必须严格输出 JSON 数组，格式：[{"t":"标题","d":"一句话摘要","tag":"简短领域标签","url":"来源链接(可空)"}]，6-10 条，按新鲜度/热度排序。不要输出 JSON 以外的任何文字。';
  const catDesc=`分类：${cfgCat.name}（来源平台：${cfgCat.label||''}）。当前榜单上的种子话题：${(seeds||[]).join('、')}。请基于这些方向检索更新鲜的条目；若你无法真实联网，则基于你的最新知识给出你认为此刻应关注的热点（请在摘要里克制、勿编造具体到分钟的细节）。`;
  let content;
  if(isQwenModel(cfg)){
    // 通义千问：enable_search 原生联网，单请求返回最终回答（主推，更快）
    content=await qwenSearchFetch(url, cfg,
      [{role:'system',content:sys},{role:'user',content:catDesc}], 50000);
  }else if(isKimiModel(cfg)){
    // Kimi：内置 $web_search 真联网，需跑 tool_calls 循环
    // 搜索+生成长 JSON 耗时高，给足 90s/轮，避免被中断（fetch is aborted）
    content=await kimiChatFetch(url, cfg,
      [{role:'system',content:sys},{role:'user',content:catDesc}], 4, 90000);
  }else{
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(), 25000);
    try{
      const r=await fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
        body:JSON.stringify({model:cfg.model, messages:[{role:'system',content:sys},{role:'user',content:catDesc}], temperature:0.5, stream:false}),
        signal:ctl.signal
      });
      if(!r.ok) await throwRespError(r, 'HTTP '+r.status);
      const j=await r.json();
      content=(j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    }finally{ clearTimeout(timer); }
  }
  const arr=extractJsonArray(content);
  if(!arr.length){
    const preview=String(content||'').trim().slice(0,60);
    throw new Error('AI 未返回可解析的资讯条目'+(preview?'（返回内容开头：'+preview+'…）':''));
  }
  return toAiNewsItems(arr, cfgCat);
}
/* 与当前已展示条目按标题去重，返回真正新增的条目 */
function mergeAiNews(catId, items){
  const st=newsState[catId];
  const seen=new Set((st&&st.items||[]).map(n=>normKey(n.t)));
  return (items||[]).filter(n=>{
    const k=normKey(n.t);
    if(!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0,12);
}
function normKey(s){
  return String(s||'').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g,'').toLowerCase().slice(0,40);
}

function initNews(){
  renderNewsTabs();
  renderNews();
  ensureCategory(State.newsCat);
  getNewsCats().forEach(c=>{ if(c.id!==State.newsCat) setTimeout(()=>ensureCategory(c.id), 500); });
  $('#newsRefreshBtn').onclick=()=>doNewsRefresh('top');
  $('#newsAiBtn').onclick=()=>doAiNewsRefresh();
  const fab=$('#newsFab');
  fab.onclick=()=>doNewsRefresh('fab');
  /* 滚动时显示/隐藏右下角浮动刷新 */
  const updateFab=()=>{
    const onNews=!$('#mod-news').classList.contains('hidden');
    const st=window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||0;
    if(onNews && st>120){ fab.classList.remove('hidden'); }
    else fab.classList.add('hidden');
  };
  window.addEventListener('scroll',updateFab,{passive:true});
  window.updateNewsFab=updateFab;
  $('#newsModalClose').onclick=closeNewsDetail;
  $('#newsModalClose2').onclick=closeNewsDetail;
  $('#newsModal').addEventListener('click',e=>{ if(e.target.id==='newsModal') closeNewsDetail(); });
  /* 资讯分类管理：开启/关闭 + 调整顺序 */
  $('#newsCatBtn').onclick=()=>{ renderNewsCatEditor(); $('#newsCatModal').classList.remove('hidden'); };
  $('#newsCatClose').onclick=()=>$('#newsCatModal').classList.add('hidden');
  $('#newsCatModal').addEventListener('click',e=>{ if(e.target.id==='newsCatModal') $('#newsCatModal').classList.add('hidden'); });
  $('#newsCatDone').onclick=()=>{ applyNewsCats(); $('#newsCatModal').classList.add('hidden'); toast('资讯分类已更新'); };
  $('#newsCatReset').onclick=()=>{ State.newsCats=defaultNewsCats(); renderNewsCatEditor(); toast('已恢复默认分类'); };
}

/* 渲染分类管理列表（开关 + 拖拽排序） */
function renderNewsCatEditor(){
  const list=$('#newsCatList'); if(!list) return; list.innerHTML='';
  let cfg = (State.newsCats && State.newsCats.length) ? State.newsCats : (State.newsCats=defaultNewsCats());
  const ids=cfg.map(x=>x.id);
  NEWS_MASTER.forEach(c=>{ if(!ids.includes(c.id)) cfg.push({id:c.id,enabled:true}); });
  cfg.forEach((row)=>{
    const m=findCat(row.id); if(!m) return;
    const el=document.createElement('div'); el.className='nc-row'; el.dataset.id=row.id;
    el.innerHTML=`
      <div class="nc-grip" title="按住拖拽排序">⠿</div>
      <div class="nc-icon">${m.icon}</div>
      <div class="nc-name"><b>${esc(m.name)}</b><span>${esc(m.label)}</span></div>
      <label class="switch nc-switch ${row.enabled?'on':''}"><input type="checkbox" ${row.enabled?'checked':''}><i></i></label>`;
    el.querySelector('input').onchange=e=>{ row.enabled=e.target.checked; el.querySelector('.nc-switch').classList.toggle('on', e.target.checked); };
    list.appendChild(el);
  });
  bindNewsCatSort();
}
/* 拖拽排序：基于 Pointer 事件，用 translateY 在原列表内拖拽，不会跑出屏幕 */
function bindNewsCatSort(){
  const list=$('#newsCatList'); if(!list) return;
  let dragRow=null, placeholder=null, startY=0, startTop=0, listRect=null;
  function onDown(e, row){
    e.preventDefault();
    dragRow=row;
    listRect=list.getBoundingClientRect();
    startY=e.clientY;
    startTop=row.getBoundingClientRect().top;
    // 占位符保持列表高度不变
    placeholder=document.createElement('div');
    placeholder.style.height=row.offsetHeight+'px';
    placeholder.style.marginBottom='8px';
    placeholder.style.borderRadius='0px';
    placeholder.style.background='var(--paper-2)';
    placeholder.style.border='2px dashed var(--accent-2)';
    placeholder.style.opacity='.5';
    row.parentNode.insertBefore(placeholder, row);
    row.classList.add('nc-dragging');
    document.body.style.userSelect='none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, {once:true});
  }
  function onMove(e){
    if(!dragRow) return;
    const delta=e.clientY-startY;
    dragRow.style.transform=`translateY(${delta}px)`;
    // 根据鼠标位置把占位符插到目标位置
    const sibs=[...list.querySelectorAll('.nc-row')].filter(x=>x!==dragRow);
    let target=null;
    for(const s of sibs){
      const rc=s.getBoundingClientRect();
      if(e.clientY < rc.top + rc.height/2){ target=s; break; }
    }
    if(target) list.insertBefore(placeholder, target);
    else list.appendChild(placeholder);
  }
  function onUp(){
    window.removeEventListener('pointermove', onMove);
    if(!dragRow) return;
    dragRow.classList.remove('nc-dragging');
    dragRow.style.transform='';
    document.body.style.userSelect='';
    // 把 dragRow 插回占位符位置
    if(placeholder && placeholder.parentNode){
      placeholder.parentNode.insertBefore(dragRow, placeholder);
      placeholder.remove();
    }
    placeholder=null;
    const order=[...list.querySelectorAll('.nc-row')].map(x=>x.dataset.id);
    if(State.newsCats && State.newsCats.length){
      State.newsCats.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
    }
    dragRow=null;
  }
  list.querySelectorAll('.nc-row').forEach(row=>{
    row.querySelector('.nc-grip').addEventListener('pointerdown', e=>onDown(e, row));
  });
}
/* 保存分类配置并刷新界面 */
function applyNewsCats(){
  const vis=getNewsCats();
  if(!vis.some(c=>c.id===State.newsCat)){ State.newsCat = vis.length? vis[0].id : 'daily'; }
  save();
  renderNewsTabs(); renderNews();
  vis.forEach((c,i)=>{ if(c.id!==State.newsCat) setTimeout(()=>ensureCategory(c.id), 300); });
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
  /* 联动工作总结：任务变为「已完成」时，自动写入一条日志（按天去重） */
  const today=todayStr();
  const isDone = t.period==='none' ? t.done : (t.doneDates||[]).includes(today);
  if(isDone && t.lastLoggedDoneDate!==today){
    t.lastLoggedDoneDate=today;
    const recur = t.period!=='none' ? `（${PERIOD_LABEL[t.period]}）` : '';
    addLogEntry(`完成「${t.title}」任务${recur}`, 'task');
    toast('已同步到工作总结 ✓');
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
  updateHello();
}

/* =============================================================
   模块三：工作总结
   ============================================================= */
function renderLogDate(){ $('#logDate').textContent = todayStr(); }
function renderLogHistory(){
  const wrap=$('#logHistory'); wrap.innerHTML='';
  // 历史 = 有条目标 或 有总结(含已确认归档、条目已清空) 的日期
  const dateSet=new Set();
  Object.keys(State.log).forEach(d=>{ if(getEntries(d).length) dateSet.add(d); });
  Object.keys(State.aiSummaries).forEach(d=>{ if(State.aiSummaries[d]) dateSet.add(d); });
  const dates=[...dateSet].sort().reverse();
  $('#logClearAllBtn').style.display = dates.length? 'inline-flex':'none';
  if(!dates.length){ wrap.innerHTML='<div style="color:var(--ink-3);font-size:12px;padding:6px 4px">还没有历史日志，记录第一天的内容吧</div>'; return; }
  dates.forEach(ds=>{
    const arr=getEntries(ds);
    const hasSum=State.aiSummaries[ds];
    const confirmed=hasSum && hasSum.confirmed;
    const isToday=ds===todayStr();
    const count=arr.length;
    // 预览：有总结用总结小结，否则用条目拼段
    let preview;
    if(hasSum && hasSum.summary){ preview=hasSum.summary; }
    else preview=arr.map(e=>e.text).join('。');
    preview=(preview||'').slice(0,80);
    const badge = confirmed?'<span class="sum-badge" style="background:var(--ok-bg,#e6f6ea);color:#2f9e44">✓ 已归档</span>'
      : (hasSum && isToday)?'<span class="sum-badge" style="background:#fff3d6;color:#c77a00">待确认</span>'
      : (hasSum)?'<span class="sum-badge">AI 总结</span>'
      : `<span class="sum-badge">${count} 条</span>`;
    const item=document.createElement('div'); item.className='log-item';
    item.innerHTML=`<div class="log-item-top">
        <div class="log-item-date"><span>${ds}</span>${badge}${(count&&!confirmed)?`<span class="sum-badge">${count} 条</span>`:''}</div>
        <button class="log-del" data-ds="${esc(ds)}" title="删除这一天">🗑</button>
      </div>
      <div class="log-item-text">${esc(preview)}${preview.length>=80?'…':''}</div>
      ${hasSum?'<div class="log-item-sum">点击查看/修改该日总结 →</div>':'<div class="log-item-sum">点「生成今日总结」做 AI 归纳</div>'}`;
    item.style.cursor='pointer';
    item.addEventListener('click',e=>{
      if(e.target.classList.contains('log-del')) return;
      if(hasSum) renderAiSummary(ds);
      else if(isToday){ $('#logInput').focus(); toast(ds+' 还没有生成总结，先点「▶ 生成今日总结」','warn'); }
      else toast(ds+' 还没有生成总结','warn');
    });
    item.querySelector('.log-del').onclick=(ev)=>{ ev.stopPropagation(); deleteOneLog(ds); };
    wrap.appendChild(item);
  });
}
/* 单独删除某天日志 */
function deleteOneLog(ds){
  const arr=getEntries(ds);
  const hasSum=!!State.aiSummaries[ds];
  if(!arr.length && !hasSum) return;
  const what=arr.length
    ? ('删除 '+ds+' 的 '+arr.length+' 条日志'+(hasSum?'与该日 AI 总结':'')+'？此操作不可恢复。')
    : ('删除 '+ds+' 的 AI 总结归档？此操作不可恢复。');
  if(!confirm(what)) return;
  State.log[ds]=[];
  delete State.aiSummaries[ds];
  if(ds===todayStr()){
    $('#logInput').value='';
    $('#reportOut').innerHTML='<div class="placeholder">录入条目后，点「生成今日总结」<br>这里会生成结构化的 AI 总结。</div>';
    renderTodayEntries();
  }
  save(); renderLogHistory();
  toast('已删除该日日志');
}
/* 全部清除历史日志 */
function clearAllLogs(){
  if(!Object.keys(State.log).filter(d=>getEntries(d).length).length){ toast('暂无历史日志','warn'); return; }
  if(!confirm('确定清除全部历史日志与AI总结？此操作不可恢复。')) return;
  State.log={}; State.aiSummaries={};
  $('#logInput').value='';
  $('#reportOut').innerHTML='<div class="placeholder">录入条目后，点「生成今日总结」<br>这里会生成结构化的 AI 总结。</div>';
  renderTodayEntries();
  save(); renderLogHistory();
  toast('已清除全部历史日志');
}
/* 把一条语音/手打内容切分为语义句，并去掉时间/口语前缀，返回 {clean,time,where} */
function cleanSent(s){
  let clean=s.trim();
  const tMat=clean.match(/^(凌晨|清晨|早上|上午|中午|下午|傍晚|晚上|昨晚|深夜|今日|今天|本日|白天|一整天)?\s*[，,、:：]?\s*/);
  let time=tMat?tMat[1]:'';
  clean=clean.replace(/^(凌晨|清晨|早上|上午|中午|下午|傍晚|晚上|昨晚|深夜|今日|今天|本日|白天|一整天)\s*[，,、:：]?\s*/,'');
  clean=clean.replace(/\s{2,}/g,' ').trim();
  return {clean,time};
}
const DONE_R=/完成|上线|交付|搞定|修复|解决|实现|发布|通过|落地|收尾|跑通|闭环|验收|发货|写完|改完|推完|部署|通过评审/;
const PROG_R=/推进|进行|开展|推进中|编写|开发|调研|整理|优化|测试|设计|对接|启动|开始|跟进|在写|在改|在做|初稿|原型|正在|打磨|迭代|搭建|调整|重构|梳理/;
const ISSUE_R=/问题|阻塞|风险|卡住|困难|待|遗留|未|异常|延期|遇到|卡点|阻碍|缺口|不足|等待|反复|报错|bug|宕机/;
const COMM_R=/会议|评审|对齐|沟通|汇报|讨论|协调|同步|周会|例会|需求会|评审会|汇报会|协作|对接人|向上汇报/;
const RESULT_R=/([\d一二三四五六七八九十百]+)\s*(个|项|次|条|篇|份|页|%|单|人|家|版本|bug|issue)/;
const NEG_R=/未|尚未|还没|没有|没能|无法|不能|难以|失败|受阻|卡在/;
/* 话题标签：把流水账改写为规范化日报条目 */
const TAG_MAP=[
  ['PRD|需求文档|需求初稿|产品方案|原型图','产品需求'],
  ['接口|联调|API|后端|服务端|数据库','接口联调'],
  ['前端|页面|UI|组件|样式|H5|小程序','前端开发'],
  ['评审会|周会|例会|晨会|站会|复盘会|需求会','会议对齐'],
  ['bug|缺陷|报错|异常|故障|崩溃|宕机','问题修复'],
  ['文档|报告|周报|汇报材料|方案稿|PPT','文档沉淀'],
  ['测试|用例|回归|压测|联测|自测','测试验证'],
  ['数据|指标|分析|报表|看板|埋点','数据分析'],
  ['设计|视觉|配色|海报|封面|排版','设计输出'],
  ['客户|甲方|用户|需求方|运营|商务','对外沟通'],
  ['招聘|面试|培训|带教|团队|分工','团队协作'],
];
function tagOf(s){ for(const [re,label] of TAG_MAP){ if(new RegExp(re,'i').test(s)) return label; } return ''; }
function stripTag(s){ return String(s||'').replace(/^【[^】]+】/,''); }
/* 否定判定：否定词出现在完成动词之前 → 其实并未完成，应归为问题 */
function isNegated(s){
  const dm=s.match(/完成|解决|修复|通过|上线|交付|跑通|闭环|搞定|改完|写完|推完|落地|验收|实现/);
  const nm=s.match(NEG_R);
  if(!dm||!nm) return false;
  return nm.index < dm.index;
}
/* 润色：去口语填充 → 补标签 → 规范标点，形成日报条目 */
function polishClause(s){
  let x=String(s||'').trim();
  if(!x) return '';
  x=x.replace(/^(嗯|啊|哦|呃|那个|这个|就是|然后|接着|后来|还有|另外|反正|大概|我觉得|我感觉|我想|我们|我)[，,、\s]*/,'');
  x=x.replace(/[，,、]\s*(然后|接着|还有|另外|就是)(?=[，,、\s])/g,'，');
  x=x.replace(/[，,、]\s*$/,'').replace(/\s{2,}/g,' ').trim();
  if(!x) return '';
  const tag=tagOf(x);
  if(!/[。！？]$/.test(x)) x+='。';
  return tag? `【${tag}】${x}` : x;
}
/* 切分语义单元：先按句末标点，长句再按逗号拆开，避免一句塞多件事 */
function splitClauses(text){
  const out=[];
  String(text||'').split(/[。；\n！？!?]/).map(s=>s.trim()).filter(s=>s.length>1).forEach(s=>{
    const c=cleanSent(s);
    const body=c.clean;
    if(body.length>=14 && /[，,、]/.test(body)){
      const parts=body.split(/[，,、]/).map(x=>x.trim()).filter(x=>x.length>1);
      if(parts.length>1){
        parts.forEach(p=>{ const pc=cleanSent(p); out.push({clean:pc.clean, time:pc.time||c.time}); });
        return;
      }
    }
    out.push(c);
  });
  return out;
}
/* AI 归纳为规范的工作报告结构 */
function aiSummarize(text){
  const clauses=splitClauses(text);
  const buckets={done:[],progress:[],issue:[],comm:[]};
  clauses.forEach(({clean})=>{
    if(!clean) return;
    if(DONE_R.test(clean) && !isNegated(clean)) buckets.done.push(clean);
    else if(ISSUE_R.test(clean) || isNegated(clean)) buckets.issue.push(clean);
    else if(COMM_R.test(clean)) buckets.comm.push(clean);
    else buckets.progress.push(clean);
  });
  const done=dedup(buckets.done).map(polishClause).filter(Boolean).slice(0,8);
  const progress=dedup(buckets.progress).map(polishClause).filter(Boolean).slice(0,8);
  const issue=dedup(buckets.issue).map(polishClause).filter(Boolean).slice(0,6);
  const comm=dedup(buckets.comm).map(polishClause).filter(Boolean).slice(0,6);
  // 统计成果数据
  const allClean=[...done,...progress,...issue,...comm];
  let numbers=0; const numList=[];
  allClean.forEach(c=>{ const mm=c.match(RESULT_R); if(mm){ numbers++; numList.push(mm[0]); } });
  const doneN=done.length, total=Math.max(1,clauses.length);
  const progressRate=Math.min(100,Math.round((doneN/total)*100));
  // 领域归类（用原句粗判重心）
  const catMap=[['开发|代码|接口|bug|模块|功能|上线|实现|部署|后端|前端','开发研发'],['会议|评审|对齐|沟通|协调|汇报|讨论|周会|需求','沟通协作'],['文档|方案|需求|设计|原型|PRD|写作|报告|PPT','文档方案'],['数据|分析|测试|优化|复盘|调研|整理|指标','分析优化']];
  let topCat='综合推进'; let topN=0;
  const catCount={};
  clauses.forEach(({clean})=>{ for(const [re,label] of catMap){ if(new RegExp(re).test(clean)){ catCount[label]=(catCount[label]||0)+1; break; } } });
  Object.keys(catCount).forEach(k=>{ if(catCount[k]>topN){topN=catCount[k];topCat=k;} });
  const kpis=[{l:'完成事项',v:doneN+'项'},{l:'今日工作量',v:total+'条'},{l:'成果完成率',v:progressRate+'%'}];
  const summary=`今日共梳理 ${total} 项工作，重心落在「${topCat}」方向，已闭环 ${doneN} 项${numbers?`，涉及「${numList.slice(0,4).join('、')}」等可量化产出`:''}。${issue.length?`当前存在 ${issue.length} 项待跟进问题（${stripTag(issue[0]).replace(/。$/,'')}），建议优先处理；`:'推进过程未出现明显阻塞；'}${progress.length?`另有 ${progress.length} 项工作处于进行中，建议保持连续性并在下一节点同步进展。`:'各项工作均已形成明确结果。'}整体产出${doneN>=3?'较为饱满':'仍有提升空间'}。`;
  return {kpis, done, progress, issue, comm, summary, raw:clauses.map(c=>c.clean)};
}
function dedup(arr){ return [...new Set(arr)]; }
function renderAiSummary(ds){
  const s=State.aiSummaries[ds];
  const out=$('#reportOut');
  if(!s){ out.innerHTML='<div class="placeholder">该日期暂无AI总结</div>'; return; }
  const isToday=ds===todayStr();
  const confirmed=!!s.confirmed;
  const draft=isToday&&!confirmed;           // 今天刚生成、未确认 → 待定稿草稿（可改/可确认）
  const block=(title,items)=>{ if(!items||!items.length) return ''; return `<div class="sum-head">${title}</div><ul>${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`; };
  const badge=confirmed
    ? '<span class="sum-badge" style="background:var(--ok-bg,#e6f6ea);color:#2f9e44">✓ 已归档</span>'
    : (isToday?'<span class="sum-badge" style="background:#fff3d6;color:#c77a00">待确认</span>':'<span class="sum-badge">AI 总结</span>');
  out.innerHTML=`
    <div class="ai-summary">
      <div class="sum-meta"><span style="font-family:var(--mono)">AI 工作日报 · ${ds}</span>${badge}</div>
      <div class="sum-kpi">${(s.kpis||[]).map(k=>`<div class="kpi"><b>${esc(k.v)}</b><span>${esc(k.l)}</span></div>`).join('')}</div>
      ${block('一、今日完成',s.done)}
      ${block('二、进行中 / 推进',s.progress)}
      ${block('三、问题与待办',s.issue)}
      ${block('四、沟通与协作',s.comm)}
      <div class="sum-head">总体小结</div>
      <div class="sum-text">${esc(s.summary||'')}</div>
    </div>
    <div class="sum-actions">
      <button class="btn mini ghost" data-sum-edit>✎ 修改</button>
      ${draft?'<button class="btn mini primary" data-sum-confirm>✓ 确认并归档</button>':''}
    </div>`;
  const bEdit=out.querySelector('[data-sum-edit]');
  if(bEdit) bEdit.onclick=()=>renderAiSummaryEdit(ds);
  const bConf=out.querySelector('[data-sum-confirm]');
  if(bConf) bConf.onclick=()=>confirmTodaySummary(ds);
}
/* 编辑态：把总结的四个分组 + 小结渲染为可编辑文本域，保存后写回 */
function renderAiSummaryEdit(ds){
  const s=State.aiSummaries[ds];
  const out=$('#reportOut');
  if(!s){ out.innerHTML='<div class="placeholder">该日期暂无AI总结</div>'; return; }
  const ta=(id,label,val)=>
    `<label class="sum-edit-field"><span>${label}</span>
       <textarea id="${id}" rows="${Math.max(2,Math.min(5,(val||[]).length+1))}">${esc((val||[]).join('\n'))}</textarea>
     </label>`;
  out.innerHTML=`
    <div class="ai-summary">
      <div class="sum-meta"><span style="font-family:var(--mono)">编辑日报 · ${ds}</span></div>
      ${ta('se_done','一、今日完成（每行一条）',s.done)}
      ${ta('se_progress','二、进行中 / 推进',s.progress)}
      ${ta('se_issue','三、问题与待办',s.issue)}
      ${ta('se_comm','四、沟通与协作',s.comm)}
      <label class="sum-edit-field"><span>总体小结</span>
        <textarea id="se_summary" rows="3">${esc(s.summary||'')}</textarea>
      </label>
    </div>
    <div class="sum-actions">
      <button class="btn mini ghost" data-sum-cancel>取消</button>
      <button class="btn mini primary" data-sum-save>保存修改</button>
    </div>`;
  out.querySelector('[data-sum-cancel]').onclick=()=>renderAiSummary(ds);
  out.querySelector('[data-sum-save]').onclick=()=>{
    const toArr=id=>$('#'+id).value.split('\n').map(x=>x.trim()).filter(Boolean);
    s.done=toArr('se_done'); s.progress=toArr('se_progress');
    s.issue=toArr('se_issue'); s.comm=toArr('se_comm');
    s.summary=$('#se_summary').value.trim();
    save(); renderAiSummary(ds); renderLogHistory();
    toast('总结已修改 ✓');
  };
}
/* 确认定稿（仅当天草稿态）：清空今日条目标，标记已归档 */
function confirmTodaySummary(ds){
  const s=State.aiSummaries[ds]; if(!s) return;
  const today=todayStr();
  if(ds===today){
    const arr=getEntries(ds);
    if(arr.length && !confirm('确认定稿后将清空今日日志条目（信息已浓缩进本次总结），并把该日总结归档到历史日志。确定继续？')) return;
    State.log[ds]=[];
    renderTodayEntries();
  }
  s.confirmed=true;
  s.confirmedAt=new Date().toLocaleString('zh-CN',{hour12:false});
  save();
  renderAiSummary(ds);
  renderLogHistory();
  toast('已确认定稿，今日条目已归档 ✓');
}
/* 取得某日条目数组（保证是数组） */
function getEntries(ds){
  if(!State.log[ds]) State.log[ds]=[];
  if(typeof State.log[ds]==='string'){
    const txt=State.log[ds];
    State.log[ds]= txt?[{id:uid(),text:txt,time:'00:00',source:'legacy'}]:[];
  }
  if(!Array.isArray(State.log[ds])) State.log[ds]=[];
  return State.log[ds];
}
/* 拼接某日所有条目为单个文本（用于 AI 总结） */
function concatEntries(ds){
  const arr=getEntries(ds);
  return arr.map(e=>e.text).join('。\n');
}
/* 当前时间字符串 HH:MM */
function nowHM(){
  const d=new Date();
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
/* 录入一条新条目（手动 / 语音） */
function addLogEntry(text, source){
  text=(text||'').trim(); if(!text) return false;
  const ds=todayStr();
  const arr=getEntries(ds);
  arr.push({id:uid(), text, time:nowHM(), source: source||'manual'});
  save();
  renderTodayEntries();
  renderLogHistory();
  return true;
}
/* 删除某一条目 */
function removeLogEntry(entryId){
  const ds=todayStr();
  const arr=getEntries(ds);
  const idx=arr.findIndex(e=>e.id===entryId);
  if(idx<0) return;
  arr.splice(idx,1);
  save();
  renderTodayEntries();
  renderLogHistory();
  toast('已删除该条目');
}
/* 渲染今日条目列表 */
function renderTodayEntries(){
  const ds=todayStr();
  const arr=getEntries(ds);
  const wrap=$('#logEntries'); if(!wrap) return;
  wrap.innerHTML='';
  arr.forEach(e=>{
    const item=document.createElement('div');
    item.className='entry-item';
    const srcLabel=e.source==='voice'?'🎤 语音':e.source==='legacy'?'旧日志':'✎ 手动';
    const srcCls=e.source==='voice'?'s-voice':e.source==='legacy'?'s-legacy':'s-manual';
    item.innerHTML=`<div class="entry-side">
        <span class="entry-time">${esc(e.time||'--:--')}</span>
        <span class="entry-src ${srcCls}">${srcLabel}</span>
      </div>
      <div class="entry-text">${esc(e.text)}</div>
      <button class="entry-del" data-id="${esc(e.id)}" title="删除本条">✕</button>`;
    item.querySelector('.entry-del').onclick=(ev)=>{ ev.stopPropagation(); removeLogEntry(e.id); };
    wrap.appendChild(item);
  });
  const c=$('#logEntriesCount'); if(c) c.textContent=arr.length;
}
/* 计算总结：优先大模型，失败回退内置启发式 */
async function computeSummary(text){
  const cfg=getActiveAiModel();
  if(cfg){
    try{
      const res=await callLLMSummarize(text, cfg);
      if(res && res.summary) return res;
    }catch(e){ console.warn('大模型总结失败，回退内置：', e&&e.message); }
  }
  return aiSummarize(text);
}
/* 调用 OpenAI 兼容大模型做工作总结 */
async function callLLMSummarize(text, cfg){
  const sys='你是一位资深职场日报助手。请根据用户提供的今日工作条目，生成结构化的工作日报，必须包含以下四个部分（不要出现明日计划）：\n一、今日完成：列出已完成的事项，每条带【话题标签】。\n二、进行中/推进：列出正在推进的工作。\n三、问题与待办：列出遇到的问题和待跟进事项。\n四、沟通与协作：列出会议、沟通、协作类事项。\n最后给一段100字左右的总体小结。\n输出格式为 JSON：{"done":["..."],"progress":["..."],"issue":["..."],"comm":["..."],"summary":"..."}';
  const base=normBaseUrl(cfg.baseUrl);
  const url=base+'/chat/completions';
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(), Number(cfg.timeout)||15000);
  try{
    const body={model:cfg.model, messages:[{role:'system',content:sys},{role:'user',content:text}], stream:false};
    if(!isKimiModel(cfg)) body.temperature=0.6;
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body:JSON.stringify(body),
      signal:ctl.signal
    });
    if(!r.ok) await throwRespError(r, 'HTTP '+r.status);
    const j=await r.json();
    const content=(j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    // 尝试提取 JSON
    let jsonStr=content;
    const m=content.match(/\{[\s\S]*\}/);
    if(m) jsonStr=m[0];
    const parsed=JSON.parse(jsonStr);
    const kpis=[{l:'完成事项',v:(parsed.done||[]).length+'项'},{l:'今日工作量',v:(parsed.done||[]).length+(parsed.progress||[]).length+(parsed.issue||[]).length+(parsed.comm||[]).length+'条'},{l:'成果完成率',v:'AI生成'}];
    return {kpis, done:parsed.done||[], progress:parsed.progress||[], issue:parsed.issue||[], comm:parsed.comm||[], summary:parsed.summary||'', raw:[]};
  }catch(e){ throw e; }
  finally{ clearTimeout(timer); }
}
/* 一键生成今日总结（先自动录入草稿，再调用 AI 总结） */
async function generateTodaySummary(){
  const ds=todayStr();
  const draft=$('#logInput').value.trim();
  if(draft){ addLogEntry(draft, 'manual'); $('#logInput').value=''; }
  const arr=getEntries(ds);
  if(!arr.length){ toast('请先录入今天的条目','warn'); return; }
  const text=concatEntries(ds);
  const out=$('#reportOut');
  out.innerHTML='<div class="placeholder">AI 正在总结中…</div>';
  try{
    const res=await computeSummary(text);
    res.confirmed=false;                       // 新生成 → 待确认草稿，需用户「确认并归档」定稿
    res.genAt=new Date().toLocaleString('zh-CN',{hour12:false});
    State.aiSummaries[ds]=res;
    save();
    renderAiSummary(ds);
    renderLogHistory();
    toast('已生成今日 AI 总结 ✓');
  }catch(e){
    toast('总结生成失败，请重试','err');
    renderAiSummary(ds);
  }
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
  let totalText=''; const allItems=[], doneItems=[];
  logs.forEach(d=>{ totalText+=concatEntries(d)+'。'; const s=State.aiSummaries[d]; if(s){ if(s.done) allItems.push(...s.done); else if(s.items) allItems.push(...s.items); if(s.progress) allItems.push(...s.progress); } });
  const uniq=[...new Set(allItems)].slice(0,12);
  const days=logs.length;
  const totalClauses=totalText.split(/[。；\n]/).filter(Boolean).length;
  const kpis=[{l:'记录天数',v:days+'天'},{l:'累计事项',v:Math.max(allItems.length,totalClauses)},{l:'关键产出',v:uniq.length+'项'}];
  $('#periodReportWrap').classList.add('show');
  $('#periodReportTitle').textContent=`周期总结 · ${label}`;
  const wd=period==='week'?'本周':period==='month'?'本月':'本季度';
  $('#periodReportBody').innerHTML=`<div class="period-kpis">${kpis.map(k=>`<div class="kpi"><b>${k.v}</b><span>${k.l}</span></div>`).join('')}</div>
    <div class="sum-head">${wd}主要成果与进展</div>
    <ul>${uniq.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>
    <div class="sum-head">总体评价</div>
    <div class="sum-text">${wd}共有 ${days} 天有内容沉淀，累计梳理约 ${totalClauses} 条工作事项。整体节奏${days>=5?'相对连贯':'存在断档'}，覆盖方向${allItems.length>8?'较饱满':'相对聚焦'}。建议下一${period==='week'?'周':period==='month'?'月':'季度'}优先沉淀可量化的成果数据，并持续跟进重复出现的遗留问题。</div>`;
}
function initReportModule(){
  $('#logDate').textContent=todayStr();
  /* 录入本条：把草稿追加为一条新条目 */
  $('#logSaveBtn').onclick=()=>{
    const ta=$('#logInput');
    if(!ta.value.trim()){ toast('请先在草稿里写点内容','warn'); return; }
    if(addLogEntry(ta.value,'manual')){
      ta.value='';
      toast('已录入一条 ✓');
    }
  };
  /* 生成今日总结：自动收录草稿，再合并所有条目一并总结 */
  $('#logSummarizeBtn').onclick=generateTodaySummary;
  $('#reportVoiceBtn').onclick=()=>startVoice('report');
  /* 清空草稿：仅清今日日志输入框内容，不动已录入条目与已生成总结 */
  $('#logClearBtn').onclick=()=>{
    const ta=$('#logInput');
    if(!ta.value.trim()){ toast('草稿本就是空的','warn'); return; }
    ta.value='';
    ta.focus();
    toast('已清空草稿（仅输入框，条目与总结不受影响）');
  };
  /* 键盘快捷：Ctrl+Enter 在草稿中直接生成总结 */
  $('#logInput').onkeydown=(e)=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); generateTodaySummary(); }
  };
  /* 启动渲染今日条目 */
  renderTodayEntries();
  $('#reportGenBtn').onclick=periodReport;
  $('#periodReportClose').onclick=()=>$('#periodReportWrap').classList.remove('show');
  $('#logClearAllBtn').onclick=clearAllLogs;
}

/* =============================================================
   模块四：灵感记录
   ============================================================= */
function aiDiverge(idea){
  const t=String(idea||'').trim();
  if(!t) return {kind:'idea',topic:'创意火花',lines:['请先输入一段灵感或场景描述。']};

  /* —— 判断是否为「场景/画面」类描述 —— */
  const placeHit=/海边|海岸|沙滩|江边|河边|湖畔|湖面|山顶|山脚|森林|树林|草原|田野|巷|街道|路口|弄堂|楼道|阳台|窗|房间|卧室|书房|客厅|厨房|老屋|庭院|咖啡馆|餐厅|酒吧|书店|教室|会议室|办公室|天台|广场|站台|列车|地铁|公交|公园|桥上|屋檐|路灯|街角|小店|走廊/.exec(t);
  const lightHit=/(清晨|早晨|拂晓|黎明|午后|正午|黄昏|傍晚|日落|夕阳|余晖|夜晚|深夜|凌晨|月色|月光|阳光|黄昏时|天亮前|日暮|雨后|雾|细雨|雨|雪|风里)/.exec(t);
  const sensorHit=/(看到|听见|闻到|闻到|触|坐|走|站|推开|抬头|低头|回头|望|听|看|笑|哭|沉默|发呆|放空|身影|侧脸|肩|背影|手|目光|声音|脚步声|灯光|影子|倒影)/.test(t);
  const isScene = !!placeHit || (!!lightHit && sensorHit) || (t.length>=16 && sensorHit && !/(app|产品|功能|需求|创业|项目|选题|变现|账号|课程|方案|用户)/.test(t));

  if(isScene){ return divergeScene(t, lightHit?lightHit[1]:null, placeHit?placeHit[1]:null); }

  /* —— 抽象创意类：沿用领域细分 —— */
  const kw=[
    {re:'app|产品|功能|用户|需求|界面|交互|工具|软件',topic:'产品构想',angles:['核心用户与痛点','MVP 最小可用','落地动作','衡量指标']},
    {re:'写作|文章|文案|公众号|内容|故事|选题|标题',topic:'内容创作',angles:['读者是谁','黄金开头','行文骨架','传播点']},
    {re:'视频|拍|账号|短视频|直播|脚本|分镜|剪辑',topic:'视频内容',angles:['爆款选题','三秒开场','分镜拆解','涨粉与变现']},
    {re:'设计|视觉|封面|UI|配色|风格|字体|海报',topic:'创意设计',angles:['气质关键词','风格参考','配色字体','落地载体']},
    {re:'项目|创业|方向|点子|商机|想法|生意',topic:'商业机会',angles:['痛点还是痒点','差异化','最小成本试错','规模化']},
    {re:'学习|读书|笔记|知识|课程|考试|方法',topic:'学习成长',angles:['已有认知挂钩','可迁移的点','今晚做的小事','输出检验']},
  ];
  const m=kw.find(k=>new RegExp(k.re).test(t))||null;
  const topic=m?m.topic:'创意火花';
  const angles=m?m.angles:['内核是什么','谁能受益','最小一步','长期价值'];
  const echo=`「${topic}」—— ${t.slice(0,30)}${t.length>30?'…':''}`;
  const lines=[echo,`· ${angles[0]}：${_q(angles[0],t)}`,`· ${angles[1]}：${_q(angles[1],t)}`,`· 若落地，先做 ${_q('step',t)}`];
  return {kind:'idea',topic,lines};
}
function _q(kind,t){
  const idea=t.slice(0,22);
  const prompts={
    '核心用户与痛点':`谁会最需要「${idea}」，ta现在在哪一步上卡住了`,
    'MVP 最小可用':`砍到只剩一个最核心动作，它就是「${idea}」的最小版本`,
    '落地动作':`把「${idea}」拆成一个今天就能发出的最小动作`,
    '衡量指标':`用一个数字判断「${idea}」到底有没有被真正用起来`,
    '读者是谁':`谁会愿意把「${idea}」转发，点开那一下的动机是什么`,
    '黄金开头':`用一句有反差或悬念的话，替「${idea}」开个头`,
    '行文骨架':`「${idea}」按 冲突→展开→落点 三段推进会更清楚`,
    '传播点':`给「${idea}」留一个让人想接话或截图的钩子`,
    '爆款选题':`第一个画面先制造反差，再抛出「${idea}」`,
    '三秒开场':`把「${idea}」的核心动作放到开场前三秒`,
    '分镜拆解':`把「${idea}」拆成 3-5 个有节奏的镜头`,
    '涨粉与变现':`哪类人会被「${idea}」持续留住，再自然衔接转化`,
    '气质关键词':`用一个词概括「${idea}」想给人的感觉`,
    '风格参考':`找 2 个气质相近的风格源，抽象成线条/色彩/材质`,
    '配色字体':`选一个主色＋一个强调色，字体决定冷感还是温度`,
    '落地载体':`给「${idea}」找一个今天就能出现的宿主场景`,
    '痛点还是痒点':`「${idea}」解决的是非做不可的痛，还是可做可不做的痒`,
    '差异化':`现有解法差在哪，让「${idea}」能站得住的那点是什么`,
    '最小成本试错':`不烧钱的第一步，用现有资源先跑通「${idea}」`,
    '规模化':`如果「${idea}」成了，复制的杠杆在哪里`,
    '已有认知挂钩':`「${idea}」能接到你已经会的哪件事上`,
    '可迁移的点':`把「${idea}」最核心的启发搬到另一个场景会怎样`,
    '今晚做的小事':`今晚花 20 分钟验证「${idea}」里最不确定的那一环`,
    '输出检验':`试着用教别人的方式，把「${idea}」讲成一段 100 字`,
    '内核是什么':`用一句话说出「${idea}」真正想表达的`,
    '谁能受益':`最会被「${idea}」打动的一类人是谁`,
    '最小一步':`从「${idea}」里抽出一个今天可执行的微小动作`,
    '长期价值':`三个月后，「${idea}」还会让你想回头看吗`,
    'step':`把「${idea}」变成一个今天就能启动的最小步骤`,
  };
  return prompts[kind]||`围绕「${t.slice(0,20)}」再想深一层`;
}
/* 场景类灵感：把一段简单描述补全成完整、有画面感的场景 */
function divergeScene(t,light,place){
  const tShort=t.slice(0,26)+(t.length>26?'…':'');
  const lightMap={清晨:'天色将亮未亮，薄雾还未散尽，一切都带着一种刚醒的安静',午后:'午后光线很亮很直，把影子压得又短又重',黄昏:'黄昏的暖光斜斜打下来，万物都镀上一层橘金',傍晚:'天光正在往暗里沉，蓝与橙混成一片',日落:'太阳正贴着地平线，光线又长又软',夜晚:'夜色已经铺开，灯光开始一点点亮起来',深夜:'深夜里只剩零星灯光，安静得能听见自己的心跳',月光:'月光很白，把轮廓都洗得清晰',雨后:'雨刚停，空气又湿又清，地面还泛着光',雾:'雾把远处都收了起来，近处反而格外清楚',细雨:'雨丝很细，落在耳边几乎听不见',冬:'风很冷，呼出的气都凝成一小团白',undefined:'光在这个时刻恰到好处地漫过来'};
  const lightTxt=light? (lightMap[light]||('光线是这一刻最抢眼的东西')) : lightMap[undefined];
  const placeTxt=place||'这个场景';
  const who=/([一二三四五六七八九十百]+个|一群|一个)?([他她它我你]|男人|女人|老人|孩子|少年|女孩|男孩|女孩|恋人|朋友|陌生人|身影|人)/.exec(t);
  const subject=who?who[0]:'有人';
  const act=/坐|站|走|望|看|听|等|回头|低头|抬头|发呆|放空|沉默/.exec(t);
  const action=act?act[0]:'静静待着';
  const wherePart = place ? placeTxt+'，' : '';
  const outline = place ? placeTxt+'的轮廓' : '眼前的一切';
  const lines=[
    `${light?light+'时分，':''}${wherePart}${subject}${action}着——${lightTxt}。`,
    `于是画面就这样在眼前铺开：${outline}在这光线下有了明暗与层次，远近各成一层。`,
    `风、声音与温度也在这一瞬被记了下来——${/海|江|河|湖/.test(place||'')?'水汽裹着风一阵阵扑到脸上，浪与水流的声音把时间拉得很慢':'空气里是此刻独有的气息，细微的声响让安静显得更具体'}。`,
    `那层${light?light+'的':'温柔的'}光线落在肩与侧脸上，情绪半明半暗，${/梦|等|想|忘|思念|遗憾|难过|孤独|心事/.test(t)?'好像藏着没说出口的心事':'画面因此有了可以被读懂的余味'}。`,
    `把它写成开篇/文案/分镜时，就从这个「${light||'此刻'}」切入，让氛围先于情节抵达读者。`,
  ];
  return {kind:'scene',topic:'场景补全 · '+ (light||'日常'),lines};
}
/* 取当前启用的第一个 AI 模型配置 */
function getActiveAiModel(){
  const arr=State.aiModels||[];
  return arr.find(m=>m.enabled && m.baseUrl && m.key && m.model) || null;
}
/* 计算灵感发散：开启大模型则用真实 LLM，否则用内置启发式 */
async function computeDiverge(text){
  const cfg=getActiveAiModel();
  if(cfg){
    try{
      const lines=await callLLMDiverge(text, cfg);
      if(lines && lines.length) return {kind:'llm', topic:'AI 发散', lines};
    }catch(e){
      console.warn('大模型发散失败，回退内置启发式：', e && e.message);
    }
  }
  return aiDiverge(text);
}
/* 调用 OpenAI 兼容的大模型接口做灵感发散 */
async function callLLMDiverge(text, cfg){
  const sys='你是一个灵感发散助手。针对用户给出的一句灵感、场景或想法，输出 4-6 条有启发、可探索的发散角度，每条一行，直接给要点，不要解释，不要编号外的多余文字。';
  const user='灵感：「'+text+'」\n请发散出几个值得探索的角度：';
  const base=normBaseUrl(cfg.baseUrl);
  const url=base+'/chat/completions';
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(), Number(cfg.timeout)||15000);
  try{
    const body={model:cfg.model, messages:[{role:'system',content:sys},{role:'user',content:user}], stream:false};
    if(!isKimiModel(cfg)) body.temperature=0.8;
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body:JSON.stringify(body),
      signal:ctl.signal
    });
    if(!r.ok) await throwRespError(r, 'HTTP '+r.status);
    const j=await r.json();
    const content=(j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    return content.split(/\n+/).map(s=>s.replace(/^\s*[-*•0-9．.、]\s*/,'').trim()).filter(Boolean).slice(0,8);
  }finally{ clearTimeout(timer); }
}
/* 连接测试：Kimi/Moonshot 用一个最小 $web_search 请求校验「接口+Key+模型+联网」全链路；
   其余模型用普通 chat 校验。抛出的错误带服务端真实消息与 status。 */
async function testConnection(c){
  const base=normBaseUrl(c.baseUrl);
  if(!base) throw new Error('接口地址为空');
  const url=base+'/chat/completions';
  // 校验问题：联网模型问时间（触发联网），普通模型问专注
  const usr=(isKimiModel(c)||isQwenModel(c))
    ? '用一句话说：现在是几点钟，请只回答你能确定的内容。'
    : '用一句话说说什么是专注';
  if(isQwenModel(c)){
    // 通义：enable_search 校验「接口+Key+模型+联网」全链路
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(), Number(c.timeout)||20000);
    try{
      const r=await fetch(url,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key},
        body:JSON.stringify({model:c.model, messages:[{role:'user',content:usr}],
          stream:false, temperature:0.5, enable_search:true}),
        signal:ctl.signal});
      if(!r.ok) await throwRespError(r, 'HTTP '+r.status);
    }finally{ clearTimeout(timer); }
  }else if(isKimiModel(c)){
    await kimiChatFetch(url, c,
      [{role:'user', content:usr}], 2);
  }else{
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(), Number(c.timeout)||15000);
    try{
      const r=await fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key},
        body:JSON.stringify({model:c.model, messages:[{role:'user',content:usr}], stream:false}),
        signal:ctl.signal
      });
      if(!r.ok) await throwRespError(r, 'HTTP '+r.status);
    }finally{ clearTimeout(timer); }
  }
}
/* 把连接错误翻译成对用户可操作的排查建议（兼容 Kimi / 通义千问 / 其它 OpenAI 兼容） */
function explainAiErr(e, vendor){
  const s=(e&&e.status)||0;
  const m=String((e&&e.message)||'').toLowerCase();
  const isQ=(vendor==='qwen');
  const isK=(vendor==='kimi');
  if(s===401||m.includes('invalid authentication')||m.includes('unauthorized')||m.includes('invalid api-key')||m.includes('api key')){
    return isQ?'Key 无效：请到阿里云百炼控制台 bailian.console.aliyun.com 创建/检查 API Key（DashScope Key），注意勿有多余空格或换行'
      :'Key 无效：请到 platform.moonshot.cn（或其他平台）检查/重新创建 API Key，注意 sk- 开头、勿有多余空格或换行';
  }
  if(m.includes('invalid temperature')||m.includes('only 1 is allowed')) return 'Kimi 只允许 temperature=1：已自动不传该参数，若仍出现请刷新页面后重试';
  if(s===404||m.includes('url.not_found')||m.includes('not found')){
    return isQ?'接口地址不对：通义千问应为 https://dashscope.aliyuncs.com/compatible-mode/v1（结尾带 /compatible-mode/v1）'
      :'接口地址不对：Kimi 应为 https://api.moonshot.cn/v1（结尾要带 /v1）；若你填了别的地址请核对';
  }
  if(s===400||m.includes('invalid')&&!m.includes('authentication')){
    return isQ?'参数有误，多半是模型名不对：通义千问联网模型请填 qwen-plus 或 qwen-flash（更快的入门档）'
      :(isK?'参数有误，多半是模型名不对：Kimi 模型名请填 kimi-k2.6 或 kimi-k3（k3 更贵）':'参数有误，请检查模型名是否正确');
  }
  if(m.includes('insufficient')||m.includes('balance')||m.includes('quota')){
    return isQ?'余额/额度不足：阿里云百炼需开通按量付费或有余量，去 bailian.console.aliyun.com 查看'
      :'余额/额度不足：Kimi 需充值或体验金不足，去 platform.moonshot.cn 查看';
  }
  if(m.includes('model_not_found')||m.includes('does not exist')||m.includes('not_allow')) {
    return isQ?'模型名不存在或未开通：通义千问请核对（qwen-plus / qwen-flash）是否在当前百炼控制台可用'
      :'模型名不存在，请核对（Kimi：kimi-k2.6 / kimi-k3）';
  }
  if(s===429||m.includes('rate limit')) return '请求过于频繁被限流，稍等几秒再试';
  if(!s&&(m.includes('failed to fetch')||m.includes('network')||m.includes('abort')||m.includes('timeout'))) return '无法连接服务器：请检查网络；海外端点(api.moonshot.ai 等)国内常不通，请改用国内端点';
  return null;
}
async function addIdea(text,src='text',doDiverge=true){
  const idea={id:uid(),text,date:new Date().toLocaleString('zh-CN',{hour12:false}),src,diverge:null};
  if(doDiverge&&State.ideaAi){
    idea.diverge=await computeDiverge(text);
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
let recognition=null;        // 当前活动实例
let voiceActive=false;       // 防止重复 start 导致 "already started"
let voiceCtx=null;
let voiceState='idle';       // idle | listening | result

/* 当前环境是否支持语音识别 */
function voiceSupported(){
  return !!(window.SpeechRecognition||window.webkitSpeechRecognition);
}
/* 是否以「添加到主屏幕」的独立 App 形态运行（iOS 独立模式没有 Web Speech） */
function isStandalonePWA(){
  return (window.navigator.standalone===true) ||
         (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}
/* 不支持时的引导文案 */
function voiceSupportHint(){
  if(voiceSupported()) return '';
  if(isStandalonePWA()){
    return '安装版(iOS)暂不支持语音识别，请点右上角「在浏览器中打开」，或直接用键盘输入。';
  }
  if(!window.isSecureContext){
    return '语音识别需要 HTTPS 安全连接，当前本地预览无法调用，部署后或改用键盘输入。';
  }
  return '当前浏览器不支持语音识别，请用键盘输入(Safari/Chrome/Edge 可用)。';
}
function getRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ toast(voiceSupportHint(),'err'); return null; }
  return new SR();
}
/* 开始语音输入 */
function startVoice(ctx){
  if(voiceActive) return;                         // 已在聆听中，避免重复触发
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ toast(voiceSupportHint(),'err'); return; }
  const rec=new SR();                            // 每次新建实例，规避 onend 不复活/重复 start 问题
  recognition=rec; voiceActive=true; voiceCtx=ctx; voiceState='listening';
  closeVoiceModal();
  const pill=$('#listenPill');
  pill.classList.remove('hidden');
  $('#pillStop').style.display='flex';
  const phrases={
    task:['说出要添加的任务…','正在聆听任务，说完请点 ■ 停止'],
    idea:['说出此刻的灵感…','正在聆听你的灵感…'],
    report:['口述今日工作内容…','正在聆听你的工作内容，说完请点 ■ 停止'],
  };
  const ph=phrases[ctx]||phrases.idea;
  $('#listenPillText').textContent=ph[0];
  rec.lang='zh-CN';
  // 开启 interimResults：既能实时回显，也能在手动停止/欠稳环境兜底拿到文本
  rec.interimResults=true; rec.continuous=false; rec.maxAlternatives=1;
  let finalText='';
  let lastInterim='';
  rec.onstart=()=>{ $('#listenPillText').textContent=ph[1]; };
  rec.onresult=e=>{
    let interim='';
    for(let i=0;i<e.results.length;i++){
      const r=e.results[i];
      if(r.isFinal) finalText+=r[0].transcript;
      else interim+=r[0].transcript;
    }
    if(interim){ lastInterim=interim; $('#listenPillText').textContent=interim; }   // 实时显示正在识别的内容
    if(finalText.trim()){
      voiceState='result';
      handleVoiceResult(ctx, finalText.trim());
      finalText=''; lastInterim=''; // 防止 onend 兜底重复处理
    }
  };
  rec.onerror=ev=>{
    pill.classList.add('hidden'); voiceActive=false;
    if(ev.error==='not-allowed') toast('麦克风权限被拒绝，请在浏览器设置中允许','err');
    else if(ev.error==='no-speech') toast('未检测到声音，请靠近麦克风再说一次','warn');
    else if(ev.error==='network') toast('语音服务连接失败，请检查网络或改用键盘','warn');
    else if(ev.error==='aborted'){ /* 手动停止，忽略 */ }
    else toast('语音识别出错：'+ev.error,'err');
    if(voiceState==='result') return; // 已成功处理，不再兜底
    voiceState='idle';
    const t=(finalText||lastInterim).trim();
    if(t){ finalText=''; lastInterim=''; handleVoiceResult(ctx,t); }
  };
  rec.onend=()=>{
    pill.classList.add('hidden'); voiceActive=false;
    // 结束但未拿到最终文本：用已累积文本兜底（手动停止常走这里）
    if(voiceState==='listening'){
      const t=(finalText||lastInterim).trim();
      if(t){
        finalText=''; lastInterim='';
        voiceState='result';
        handleVoiceResult(ctx, t);
      } else {
        voiceState='idle';
      }
    }
  };
  try{ rec.start(); }
  catch(e){
    toast('语音已占用，请稍后再试','warn');
    pill.classList.add('hidden'); voiceActive=false; voiceState='idle';
  }
}
/* 手动停止语音（也触发识别结束） */
function stopVoice(){
  const rec=recognition;
  if(rec){ try{ rec.stop(); }catch(e){} }
  // 不立即隐藏 pill：等待 onresult/onend 把识别内容弹出来再收起
}
/* 初始化时：若不支持语音识别，禁用按钮并给出引导，避免「点了没反应」 */
function refreshVoiceButtons(){
  if(voiceSupported()) return;
  const hint=voiceSupportHint();
  document.querySelectorAll('[data-voice-btn]').forEach(b=>{
    b.classList.add('voice-off');
    b.title=hint;
    b.onclick=()=>toast(hint,'err');
  });
}
function handleVoiceResult(ctx,text){
  if(ctx==='task') openTaskConfirm(parseTaskText(text));
  else if(ctx==='report') openReportConfirm(text);
  else openIdeaConfirm(text);
}
/* 工作总结语音：先把识别到的内容弹窗展示（可修改），确认后作为「语音」条目入库 */
function openReportConfirm(text){
  if(!text || !text.trim()){ toast('语音识别结果为空','warn'); return; }
  window.__voiceReport=text;
  $('#voiceModalTitle').textContent='确认今日工作';
  $('#voiceModalTag').textContent='🎤 语音识别结果';
  $('#voiceModalBody').innerHTML=`
    <div class="vm-label">识别到的内容（可修改）</div>
    <textarea class="vm-edit" id="voiceEditText">${esc(text)}</textarea>
    <div class="vm-hint">确认后作为一条「语音」条目记入今日日志${State.ideaAi?'，可继续点「生成今日总结」做 AI 归纳。':''}</div>`;
  const ok=$('#voiceModalOk');
  ok.textContent='✓ 记入今日日志';
  ok.onclick=()=>{
    const t=($('#voiceEditText').value||'').trim() || window.__voiceReport;
    if(t && addLogEntry(t,'voice')) toast('已录入一条语音内容 🎤');
    window.__voiceReport=null;
    closeVoiceModal();
  };
  $('#voiceModalCancel').onclick=()=>{ window.__voiceReport=null; closeVoiceModal(); };
  $('#voiceModal').classList.remove('hidden');
}
/* 解析语音：抽取标题/周期/子任务/优先级 */
function parseTaskText(text){
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
  return {title,subs,period,prio,date,raw:text};
}
/* 语音结束后弹出式确认任务：打开任务弹窗并预填解析结果 */
function openTaskConfirm(p){
  openTaskModal(p.title);
  $('#tmPeriod').value=p.period; $('#tmDate').value=p.date;
  if(p.subs.length) tmSubs=p.subs.slice(0,5);
  tmPrio=p.prio; renderPrioPick(); renderSubChips();
  toast('已识别任务，确认无误后点「保存任务」');
}
/* 语音结束后弹出式确认灵感 */
function openIdeaConfirm(text){
  window.__voiceIdea=text;
  $('#voiceModalTitle').textContent='确认灵感';
  $('#voiceModalTag').textContent='🎤 语音识别结果';
  $('#voiceModalBody').innerHTML=`
    <div class="vm-label">识别到的内容（可修改）</div>
    <textarea class="vm-edit" id="voiceEditIdea">${esc(text)}</textarea>
    <div class="vm-hint">确认后保存为一条灵感${State.ideaAi?'，并自动进行 AI 发散。':''}</div>`;
  const ok=$('#voiceModalOk');
  ok.textContent='✓ 保存灵感';
  ok.onclick=()=>{ saveVoiceIdea(($('#voiceEditIdea').value||'').trim() || window.__voiceIdea); };
  $('#voiceModalCancel').onclick=()=>{ window.__voiceIdea=null; closeVoiceModal(); };
  $('#voiceModal').classList.remove('hidden');
}
function saveVoiceIdea(text){
  text = text || window.__voiceIdea;
  if(!text) return;
  addIdea(text,'voice',State.ideaAi);
  window.__voiceIdea=null;
  closeVoiceModal();
  $('#ideaInput').value='';
  toast('灵感已保存 🎤');
}
function closeVoiceModal(){ $('#voiceModal').classList.add('hidden'); }

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
      localStorage.removeItem('wbapp_data_v1');
      localStorage.removeItem('wbapp_seeded');
      location.reload();
    }
  };
  /* 点击面板外部关闭 */
  document.addEventListener('click', e=>{
    const panel=$('#themePanel');
    if(!panel || panel.classList.contains('hidden')) return;
    if(panel.contains(e.target)) return;
    const btn=$('#themeBtn'), menu=$('#menuBtn');
    if(btn && (btn===e.target || btn.contains(e.target))) return;
    if(menu && (menu===e.target || menu.contains(e.target))) return;
    panel.classList.add('hidden');
  });
  applyTheme(State.theme);
}
/* 设置面板：AI 大模型多模型管理 + GitHub 更新 */
function initSettings(){
  const ui=id=>$(id);
  State.aiModels=State.aiModels||[];
  /* --- AI 模型列表渲染 --- */
  function renderAiModels(){
    const wrap=ui('#aiModelList'); if(!wrap) return; wrap.innerHTML='';
    const arr=State.aiModels;
    if(!arr.length){
      wrap.innerHTML='<div class="ai-empty">暂无模型，点击下方「添加模型」开始配置</div>';
      return;
    }
    arr.forEach((m,idx)=>{
      const el=document.createElement('div'); el.className='ai-model-card';
      el.innerHTML=`
        <div class="ai-model-head">
          <div class="ai-model-meta">
            <b>${esc(m.name||'未命名')}</b>
            <span>${esc(m.model||'—')}</span>
          </div>
          <label class="switch nc-switch ${m.enabled?'on':''}"><input type="checkbox" ${m.enabled?'checked':''}><i></i></label>
        </div>
        <div class="ai-model-url">${esc(m.baseUrl||'—')}</div>
        <div class="ai-model-actions">
          <button class="btn mini ghost" data-edit="${idx}">编辑</button>
          <button class="btn mini ghost" data-del="${idx}">删除</button>
        </div>`;
      el.querySelector('input').onchange=e=>{ m.enabled=e.target.checked; el.querySelector('.nc-switch').classList.toggle('on', m.enabled); save(); };
      el.querySelector('[data-edit]').onclick=()=>openAiEdit(idx);
      el.querySelector('[data-del]').onclick=()=>{
        if(!confirm('确定删除模型「'+(m.name||'未命名')+'」？')) return;
        State.aiModels.splice(idx,1); save(); renderAiModels();
      };
      wrap.appendChild(el);
    });
  }
  /* --- 编辑/添加模型弹窗 --- */
  function openAiEdit(idx){
    const isAdd=idx===-1;
    const m=isAdd?{id:uid(),name:'',baseUrl:'',key:'',model:'',enabled:true,timeout:15000}:State.aiModels[idx];
    ui('#aiEditModalTitle').textContent=isAdd?'添加模型':'编辑模型';
    ui('#aiEditName').value=m.name||'';
    ui('#aiEditBaseUrl').value=m.baseUrl||'';
    ui('#aiEditKey').value=m.key||'';
    ui('#aiEditModel').value=m.model||'';
    ui('#aiEditEnabled').classList.toggle('on', !!m.enabled);
    ui('#aiEditModal').classList.remove('hidden');
    const kp=ui('#aiKimiPreset');
    if(kp){
      kp.onclick=()=>{
        ui('#aiEditName').value='Kimi（联网备选）';
        ui('#aiEditBaseUrl').value='https://api.moonshot.cn/v1';
        ui('#aiEditModel').value='kimi-k2.6';
        ui('#aiEditEnabled').classList.add('on');
        toast('已填入 Kimi 预设，只差粘贴 API Key');
      };
    }
    const qp=ui('#aiQwenPreset');
    if(qp){
      qp.onclick=()=>{
        ui('#aiEditName').value='通义千问（联网推荐）';
        ui('#aiEditBaseUrl').value='https://dashscope.aliyuncs.com/compatible-mode/v1';
        ui('#aiEditModel').value='qwen-plus';
        ui('#aiEditEnabled').classList.add('on');
        toast('已填入通义千问预设，只差粘贴百炼 API Key');
      };
    }
    ui('#aiEditSave').onclick=()=>{
      const nm={
        id:m.id, name:(ui('#aiEditName').value||'').trim()||'未命名模型',
        baseUrl:normBaseUrl(ui('#aiEditBaseUrl').value),
        key:(ui('#aiEditKey').value||'').trim(),
        model:(ui('#aiEditModel').value||'').trim(),
        enabled:ui('#aiEditEnabled').classList.contains('on'),
        timeout:15000,
      };
      if(isAdd) State.aiModels.push(nm); else State.aiModels[idx]=nm;
      save(); renderAiModels(); ui('#aiEditModal').classList.add('hidden');
      toast(isAdd?'模型已添加':'模型已保存');
    };
    ui('#aiEditCancel').onclick=()=>ui('#aiEditModal').classList.add('hidden');
    ui('#aiEditModalClose').onclick=()=>ui('#aiEditModal').classList.add('hidden');
  }
  ui('#aiEditEnabled').onclick=()=>ui('#aiEditEnabled').classList.toggle('on');
  ui('#aiAddBtn').onclick=()=>openAiEdit(-1);
  ui('#aiEditTest').onclick=async()=>{
    const c={
      baseUrl:(ui('#aiEditBaseUrl').value||'').trim(),
      key:(ui('#aiEditKey').value||'').trim(),
      model:(ui('#aiEditModel').value||'').trim(),
      timeout:15000,
    };
    if(!c.baseUrl||!c.key||!c.model){ toast('请先填好接口地址、Key 和模型名','warn'); return; }
    const btn=ui('#aiEditTest'); btn.textContent='测试中…'; btn.disabled=true;
    try{
      await testConnection(c);
      toast('连接成功，大模型可用 ✓');
    }catch(e){
      const vendor=isQwenModel(c)?'qwen':(isKimiModel(c)?'kimi':'');
      const hint=explainAiErr(e, vendor);
      console.warn('AI 连接测试失败：', e&&e.message, 'status', e&&e.status);
      const shown=(e&&e.message)||'未知错误';
      toast('连接失败：'+shown+(hint?'（'+hint+'）':''),'err');
    }
    finally{ btn.textContent='测试连接'; btn.disabled=false; }
  };
  renderAiModels();
  /* --- 检查更新 --- */
  ui('#checkUpdateBtn').onclick=()=>checkForUpdate();
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
  // 滚动位置/浮动按钮
  try{ const el=document.querySelector('.app'); if(el&&el.scrollTo) el.scrollTo({top:0,behavior:'instant'}); }catch(e){}
  try{ if(window.scrollTo) window.scrollTo({top:0,behavior:'instant'}); }catch(e){}
  if(typeof window.updateNewsFab==='function') window.updateNewsFab();
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
    newsCats:State.newsCats, aiModels:State.aiModels,
  });
}
function load(){
  const d=Store.read(); if(!d) return;
  if(Array.isArray(d.tasks)) State.tasks=d.tasks;
  if(Array.isArray(d.newsCats) && d.newsCats.length) State.newsCats=d.newsCats;
  else State.newsCats=defaultNewsCats();
  if(d.log){
    State.log=d.log;
    /* 数据迁移：旧的 string → entries 数组 */
    Object.keys(State.log).forEach(ds=>{
      if(typeof State.log[ds]==='string'){
        const txt=State.log[ds];
        State.log[ds]= txt ? [{id:uid(),text:txt,time:'00:00',source:'legacy'}] : [];
      }
      if(!Array.isArray(State.log[ds])) State.log[ds]=[];
    });
  }
  if(d.aiSummaries) State.aiSummaries=d.aiSummaries;
  if(Array.isArray(d.ideas)) State.ideas=d.ideas;
  if(typeof d.ideaAi==='boolean') State.ideaAi=d.ideaAi;
  /* AI 模型：新格式 aiModels 数组，旧版 aiConfig 对象迁移为数组首项 */
  if(Array.isArray(d.aiModels) && d.aiModels.length){
    State.aiModels=d.aiModels.map(m=>({
      id:m.id||uid(), name:String(m.name||'').trim()||'未命名模型',
      baseUrl:String(m.baseUrl||'').trim(), key:String(m.key||'').trim(),
      model:String(m.model||'').trim(), enabled:!!m.enabled,
      timeout:Number(m.timeout)||15000,
    }));
  }else if(d.aiConfig && typeof d.aiConfig==='object' && (d.aiConfig.baseUrl||d.aiConfig.model)){
    State.aiModels=[{
      id:uid(), name:'默认模型',
      baseUrl:String(d.aiConfig.baseUrl||'').trim(),
      key:String(d.aiConfig.key||'').trim(),
      model:String(d.aiConfig.model||'').trim(),
      enabled:!!d.aiConfig.useLLM,
      timeout:Number(d.aiConfig.timeout)||15000,
    }];
  }else State.aiModels=State.aiModels||[];
  if(['warm','cold','night'].includes(d.theme)) State.theme=d.theme;
}
/* 首次使用：不预置任何示例任务/日志/灵感，保持干净 */
function seedDemo(){ save(); }

/* 检查更新：重新拉取最新 Service Worker + 缓存，本地数据完全不动 */
async function checkForUpdate(){
  if(!('serviceWorker' in navigator)){
    toast('当前环境不支持自动更新，请直接刷新页面','warn');
    return;
  }
  const btn=$('#checkUpdateBtn');
  const spin=btn.querySelector('.btn-spin');
  if(spin) spin.classList.add('spinning');
  btn.disabled=true;
  toast('正在检查更新…');
  try{
    const reg=await navigator.serviceWorker.getRegistration();
    if(!reg){ toast('未注册离线服务，刷新即可获取最新内容','warn'); return; }
    await reg.update();
    // 给 SW 一点时间去进入 installing
    await new Promise(r=>setTimeout(r,600));
    if(reg.installing){
      toast('发现新版本，正在下载…');
      reg.installing.addEventListener('statechange',function(){
        if(this.state==='activated'){
          toast('更新完成，刷新中…');
          setTimeout(()=>location.reload(),800);
        }
      });
    }else if(reg.waiting){
      toast('发现新版本，正在应用…');
      reg.waiting.postMessage({type:'SKIP_WAITING'});
    }else{
      toast('当前已是最新版本');
    }
  }catch(e){ toast('检查更新失败：'+(e&&e.message||e),'err'); }
  finally{
    if(spin) spin.classList.remove('spinning');
    btn.disabled=false;
  }
}

/* PWA 安装 + service worker */
let deferredPrompt=null;
function setupPWA(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      toast('已更新到最新版本，刷新中…');
      setTimeout(()=>location.reload(),800);
    });
  }
  /* 应用成功安装后关闭 install 弹层并标记 */
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    $('#installTip').classList.add('hidden');
    localStorage.setItem('wbapp_install_dismissed','1');
    toast('安装成功 ✓ 现在可以从主屏幕启动');
  });
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredPrompt=e;
    setTimeout(()=>{
      // 已安装（standalone / minimal-ui）就不再提示安装
      if(isStandalonePWA()) return;
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

  /* 网络状态指示：离线时给出轻提示（不阻塞操作） */
  function setNetBar(online){
    let bar=document.getElementById('netBar');
    if(online){ if(bar) bar.remove(); return; }
    if(bar) return;
    bar=document.createElement('div');
    bar.id='netBar';
    bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:200;background:var(--ink);color:var(--paper);font-size:11.5px;text-align:center;padding:4px 8px;letter-spacing:.3px';
    bar.textContent='当前处于离线模式 · 已显示缓存内容';
    document.body.appendChild(bar);
  }
  if(!navigator.onLine) setNetBar(false);
  window.addEventListener('online',()=>{ setNetBar(true); toast('已恢复联网','ok'); });
  window.addEventListener('offline',()=>{ setNetBar(false); toast('已切换到离线模式','warn'); });
}

function init(){
  load();
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
  initSettings();
  // 语音控制
  $('#pillStop').onclick=()=>stopVoice();
  $('#voiceModalClose').onclick=closeVoiceModal;
  $('#voiceModal').addEventListener('click',e=>{ if(e.target.id==='voiceModal') closeVoiceModal(); });
  // 助手 banner 语音快速按钮
  $('#quickVoice').onclick=()=>startVoice('task');
  // 根据环境能力禁用/提示语音按钮（iOS 独立模式、HTTP 预览等）
  refreshVoiceButtons();
  // 默认模块（按 #hash 或 news）
  const hash=(location.hash||'').replace('#','');
  const target=['news','task','report','idea'].includes(hash)?hash:'news';
  switchModule(target);
  /* 渲染今日条目列表（用于工作总结分次录入视图） */
  renderTodayEntries();
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