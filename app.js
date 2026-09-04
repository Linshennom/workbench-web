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
    {t:'多国上调本年度经济增长预期，全球贸易稳步修复',d:'机构预计制造业与服务出口保持韧性。',tag:'国际'},
    {t:'新型显示技术落地消费终端，国产供应链协同提速',d:'柔性屏与光学方案成本持续下探。',tag:'产业'},
    {t:'多地启动新一轮消费补贴，家电与数码迎来焕新潮',d:'以旧换新政策加码，释放置换需求。',tag:'民生'},
    {t:'暑期档影视综齐开花，长短视频平台内容供给回暖',d:'爆款剧集与综艺带动会员与广告双增。',tag:'文娱'},
    {t:'城市更新进入新阶段，「微改造」激活老街区活力',d:'小而美的社区营造成为本轮关键词。',tag:'城市'},
    {t:'多所高校开设人工智能通识课，素养教育向下延伸',d:'AI 素养被纳入培养方案核心模块。',tag:'教育'},
    {t:'新能源车渗透率再攀新高，智能座舱成差异化焦点',d:'软硬件协同定义新卖点。',tag:'汽车'},
  ],
  fin:[
    {t:'两市开盘温和走高，科技成长风格占优',d:'北向资金净流入，AI算力方向获关注。',tag:'A股'},
    {t:'央行开展公开市场操作，维护流动性合理充裕',d:'机构解读：货币政策延续稳健取向。',tag:'宏观'},
    {t:'多只 AI 主题 ETF 份额持续增长，机构加码布局算力',d:'头部私募调研显示对产业趋势关注度提升。',tag:'基金'},
    {t:'人民币汇率保持基本稳定，双向波动特征明显',d:'基本面支撑充足，无需过度担忧单边走势。',tag:'汇市'},
    {t:'黄金延续强势，避险与央行购金需求共同支撑',d:'金价创阶段新高，关注通胀路径。',tag:'大宗'},
    {t:'中报季收官：超六成公司净利增长，盈利质量改善',d:'高端制造与消费复苏方向表现突出。',tag:'中报'},
    {t:'北向资金连续多日净流入，外资配置A股意愿回升',d:'估值性价比与盈利修复成主要逻辑。',tag:'资金'},
    {t:'新一批创新药出海授权落地，License-out再掀热潮',d:'国产创新药全球价值获重新定价。',tag:'医药'},
    {t:'债市维持震荡，机构建议关注票息策略',d:'长端利率下行动能趋缓。',tag:'固收'},
    {t:'机构展望下半年：科技与高股息均衡配置成共识',d:'风格轮动加快，哑铃策略受青睐。',tag:'策略'},
    {t:'储能板块景气延续，工商业与户用需求双升',d:'电芯价格回落带动装机放量。',tag:'新能源'},
    {t:'半导体设备国产化率提升，订单能见度改善',d:'晶圆厂扩产带动采购回暖。',tag:'半导体'},
    {t:'白酒动销进入淡季去库阶段，批价企稳信号初现',d:'渠道库存回落至合理区间。',tag:'消费'},
    {t:'港交所优化上市流程，特专科技企业融资更便利',d:'制度创新吸引更多硬科技登陆。',tag:'港股'},
    {t:'央行报告：加大逆周期调节，政策仍有空间',d:'市场对后续宽松预期保持温和。',tag:'政策'},
  ],
  game:[
    {t:'现象级大作新赛季上线，首日同时在线人数再创新高',d:'玩法更新引爆玩家热情，股价受提振。',tag:'新品'},
    {t:'国产开放世界新游公开实机演示，画面表现获好评',d:'自研引擎技术进一步成熟。',tag:'国产'},
    {t:'热门手游周年庆开启，限定活动与福利集中放送',d:'流水预期升温。',tag:'手游'},
    {t:'电竞季后赛落幕，黑马战队完成逆袭夺冠',d:'总决赛收视创赛季新高。',tag:'电竞'},
    {t:'云游戏进入规模化阶段，订阅服务竞争白热化',d:'延迟体验成关键，多家平台加码投入。',tag:'云游戏'},
    {t:'独立游戏年度评选启动，多款口碑佳作入围',d:'鼓励创新表达，生态持续多元。',tag:'独立'},
    {t:'国产单机大作全球口碑发酵，海外销量占比创新高',d:'文化出海与买断制模式获验证。',tag:'单机'},
    {t:'AI NPC技术亮相，游戏角色实现千人千面自由对话',d:'大模型接入带来玩法范式变化。',tag:'AI'},
    {t:'主机平台迎来折扣季，经典重制与复刻扎堆',d:'怀旧经济持续拉动销量。',tag:'主机'},
    {t:'休闲游戏出海报告：小游戏成增长最快品类',d:'超休闲与混合玩法厂商集体加码。',tag:'出海'},
    {t:'电竞亚运项目公布赛程，国家队集训名单出炉',d:'入选选手与俱乐部均受关注。',tag:'电竞'},
    {t:'多款开放世界手游同日开启测试，暑期档竞争激烈',d:'大厂集中上档，赛道再度拥挤。',tag:'新游'},
    {t:'游戏引擎更新发布，跨平台创作门槛进一步降低',d:'UGC 与AIGC 工具链持续补强。',tag:'引擎'},
    {t:'主机独占作品宣布登录PC，玩家社区反响热烈',d:'跨平台策略成为行业新常态。',tag:'平台'},
    {t:'国产二次元新游流水登顶，日系市场反向破圈',d:'文化表达与本地化运营缺一不可。',tag:'出海'},
  ],
  ai:[
    {t:'新一代推理模型发布，数学与代码能力刷新基准',d:'在复杂推理与长上下文任务上表现突出。',tag:'大模型'},
    {t:'国产大模型竞技场榜单更新，中文能力对标国际一流',d:'开源模型登榜，推理成本下探。',tag:'国产'},
    {t:'多模态 Agent 突破：可自主规划并操作软件完成复杂任务',d:'被视为通向通用助手的里程碑。',tag:'Agent'},
    {t:'端侧 AI 芯片出货放量，手机电脑本地推理普及',d:'隐私与离线需求驱动算力向端侧迁移。',tag:'端侧'},
    {t:'AI 安全对齐新论文：提出可扩展监督与可解释性框架',d:'业界呼吁能力跃升同时守住安全底线。',tag:'对齐'},
    {t:'AI 编程助手普及率再升，开发者人效报告出炉',d:'代码审查与重构效率提升最明显。',tag:'编程'},
    {t:'开源模型迎来爆发，社区贡献与生态治理成焦点',d:'开放权重模型推动应用层繁荣。',tag:'开源'},
    {t:'具身智能升温，人形机器人进厂实训加速',d:'多模态与强化学习驱动操作泛化。',tag:'具身智能'},
    {t:'AI医疗影像获监管新进展，三类证落地提速',d:'辅助诊断进入临床放量窗口。',tag:'医疗AI'},
    {t:'企业级AI治理框架出台，数据安全与合规成刚需',d:'算法备案与责任边界被进一步明确。',tag:'治理'},
    {t:'多模态视频生成模型再升级，可控性与时长大幅改善',d:'影视预演与营销场景率先落地。',tag:'文生视频'},
    {t:'语音交互迎来范式革新，实时同传接近母语级',d:'跨语言沟通成本被大幅拉低。',tag:'语音'},
    {t:'AI 硬件新品迭出，AI眼镜与耳机进入出货爬坡期',d:'随身智能体形态走向消费市场。',tag:'硬件'},
    {t:'推理成本持续下探，小模型在垂直场景强势崛起',d:'蒸馏与量化技术成普及关键。',tag:'小模型'},
    {t:'多智能体协作研究升温，复杂任务自动拆解成为可能',d:'系统工程化仍是主要挑战。',tag:'多智能体'},
  ],
  uad:[
    {t:'小红书公布生活方式趋势关键词，户外与健康生活热度攀升',d:'笔记社区氛围持续强化。',tag:'小红书'},
    {t:'抖音短剧再出新爆款，单集播放破亿引行业关注',d:'品牌定制短剧成营销新宠。',tag:'抖音'},
    {t:'直播电商年中复盘：低价之外，体验与信任成新关键词',d:'退货率下降成共同目标。',tag:'电商'},
    {t:'爆款笔记方法论：情绪价值与利他信息并行成传播密码',d:'真实感仍是流量核心。',tag:'运营'},
    {t:'AI 数字人主播批量进场，中小商家迎来内容降本',d:'虚拟形象带货成本仅为真人十分之一。',tag:'AI应用'},
    {t:'短视频平台加码本地生活，探店内容带火小众目的地',d:'按视频打卡成为出行新方式。',tag:'本地生活'},
    {t:'小红书发布「反虚假种草」新规，治理升级保障体验',d:'品牌合作笔记需明确标注广告属性。',tag:'小红书'},
    {t:'抖音升级创作者分成计划，优质内容收益更高',d:'中长尾作者迎来更多变现机会。',tag:'抖音'},
    {t:'笔记搜索流量占比上升，内容SEO成新运营重点',d:'用户把平台当搜索引擎用的趋势更明显。',tag:'运营'},
    {t:'县域消费崛起，本地生活商家迎来数字化红利',d:'短视频+地图联动带动到店转化。',tag:'本地生活'},
    {t:'「中式美学」笔记爆火，传统文化审美回归主流',d:'非遗与新中式穿搭成流量密码。',tag:'小红书'},
    {t:'车载场景成内容新蓝海，通勤路上播客与短剧受宠',d:'车企与内容平台合作加深。',tag:'内容'},
    {t:'虚拟主播年中报告：电竞解说与助眠赛道增长明显',d:'虚拟偶像商业化路径日渐成熟。',tag:'虚拟主播'},
    {t:'Vlog博主转型职业化，MCN 从流量转向精细化运营',d:'品牌短代与本地化IP 需求旺盛。',tag:'创作者'},
    {t:'高颜值美食内容风潮再起，「嘴替」视频获高互动',d:'情绪共鸣仍是评论区主引擎。',tag:'抖音'},
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
  const catName=NewsCategories.find(c=>c.id===cat).name;
  $('#newsBrief').innerHTML=`<b>${catName}</b><span>${todayStr()} · ${(State.newsData[cat]||[]).length} 条热点 · 点击可看全文</span>`;
  const list=$('#newsList'); list.innerHTML='';
  (State.newsData[cat]||[]).forEach((n,i)=>{
    const heat=35+Math.floor(Math.random()*64);
    const card=document.createElement('div');
    card.className='news-card';
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
        <div class="news-more">查看全文 · ${i<3?'top':'news'} ↗</div>
      </div>`;
    card.onclick=()=>openNewsDetail(cat,n,i+1);
    list.appendChild(card);
  });
}
/* 组装一条资讯的完整正文（在标题/摘要基础上展开成多段简报） */
function buildArticleBody(cat,n,rank){
  const openers=[
    `刚刚，${n.tag}领域又迎来新进展。`,
    `今日关注到一条值得记录的动态：`,
    `围绕「${n.t}」，多方信息正在汇集。`,
    `这是${n.tag}板块近期的焦点事件之一。`,
  ];
  const expansions=[
    `从产业视角看，${n.d}这一信号背后是行业供需与预期的再平衡。相关链条上的参与方正在据此调整节奏，把更多资源投向更确定的方向。`,
    `市场普遍认为，这轮变化的根本驱动力来自技术渗透与需求升级的交汇。短期或仍有波动，但中长期的结构性机会已被越来越多观察者认可。`,
    `值得留意的是，周边配套与政策环境也在同步跟进，为这一趋势提供了土壤。对普通从业者和用户而言，提前建立判断框架比追逐短期热度更有价值。`,
    `多位受访业内人士表示，当前仍处于早期布局阶段，真正的变量取决于落地效率与真实反馈。接下来一段时间的验证数据，将决定话题能否从热点沉淀为常态。`,
  ];
  const tagTail={
    daily:'作为当日要闻中的代表性事件，它一定程度反映了当下公共话题的关注重心。',
    fin:'对本条财经线索，投资者仍需结合基本面与估值审慎评估，不宜仅凭短期情绪作判断。',
    game:'对玩家与厂商而言，这条动态都意味着内容供给与体验边界的又一次试探。',
    ai:'该进展再次印证，AI 正在从能力演示走向规模化的工程落地。',
    uad:'在内容平台生态里，这样的动向往往预示新一轮创作与流量的再分配。',
  };
  const paras=[];
  paras.push(`${n.d}`);
  paras.push(openers[rank%openers.length]);
  expansions.forEach((e,idx)=>{ if(idx<2) paras.push(e); });
  paras.push(`总体来看，这条资讯以「${n.t}」为线索，${(tagTail[cat]||tagTail.daily)}以上内容由智能简报引擎基于公开资讯综合整理，仅供快速浏览参考。`);
  return paras.join('\n\n');
}
const NEWS_SRC={
  daily:[{n:'新华社',u:'news.cn'},{n:'人民日报',u:'people.com.cn'},{n:'央视新闻',u:'cctv.com'}],
  fin:[{n:'第一财经',u:'yicai.com'},{n:'财联社',u:'cls.cn'},{n:'证券时报',u:'stcn.com'}],
  game:[{n:'游戏葡萄',u:'youxiputao.com'},{n:'触乐',u:'chuapp.com'},{n:'游戏茶馆',u:'youxichaguan.com'}],
  ai:[{n:'量子位',u:'qbitai.com'},{n:'机器之心',u:'jiqizhixin.com'},{n:'新智元',u:'aiera.com'}],
  uad:[{n:'晚点LatePost',u:'latepost.com'},{n:'36氪',u:'36kr.com'},{n:'刺猬公社',u:'ciweigongshe.com'}],
};
function openNewsDetail(cat,n,rank){
  const body=buildArticleBody(cat,n,rank);
  const srcList=NEWS_SRC[cat]||NEWS_SRC.daily;
  const src=srcList[(n.t.length)%srcList.length];
  const catName=NewsCategories.find(c=>c.id===cat).name;
  const heat=40+Math.floor(Math.random()*60);
  const d=new Date(); const time=`${todayStr()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  $('#newsTitle').textContent=n.t;
  $('#newsDetailMeta').innerHTML=
    `<span class="nd-tag">${esc(n.tag)}</span>
     <span>${esc(src.n)} · ${esc(src.u)}</span>
     <span>${time}</span>`;
  $('#newsDetailHeat').textContent=`热度 ${heat}万`;
  $('#newsDetailBody').innerHTML=`<p>${body.split('\n\n').map(p=>esc(p)).join('</p><p>')}</p>`;
  $('#newsModal').classList.remove('hidden');
}
function closeNewsDetail(){ $('#newsModal').classList.add('hidden'); }
function freshNews(randomize){
  const data={};
  Object.keys(NewsPool).forEach(k=>{
    data[k]=[...NewsPool[k]];
    if(randomize) data[k]=data[k].sort(()=>Math.random()-.5);
  });
  State.newsData=data;
}
function initNews(){
  freshNews(true);
  renderNewsTabs();
  renderNews();
  $('#newsRefreshBtn').onclick=()=>doNewsRefresh('top');
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
}
function doNewsRefresh(from){
  const btn=$('#newsRefreshBtn');
  const fab=$('#newsFab');
  btn.classList.add('spinning'); btn.disabled=true;
  fab.classList.add('spinning'); fab.disabled=true;
  $('#newsSyncState').textContent='刷新中…';
  setTimeout(()=>{
    freshNews(true);
    renderNewsTabs(); renderNews();
    btn.classList.remove('spinning'); btn.disabled=false;
    fab.classList.remove('spinning'); fab.disabled=false;
    $('#newsSyncState').textContent='已更新 '+new Date().toTimeString().slice(0,5);
    toast('热点已刷新');
    setTimeout(()=>$('#newsSyncState').textContent='点击刷新加载热点',3000);
  },500);
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
  updateHello();
}

/* =============================================================
   模块三：工作总结
   ============================================================= */
function renderLogDate(){ $('#logDate').textContent = todayStr(); }
function renderLogHistory(){
  const wrap=$('#logHistory'); wrap.innerHTML='';
  const dates=Object.keys(State.log).filter(d=>getEntries(d).length).sort().reverse();
  $('#logClearAllBtn').style.display = dates.length? 'inline-flex':'none';
  if(!dates.length){ wrap.innerHTML='<div style="color:var(--ink-3);font-size:12px;padding:6px 4px">还没有历史日志，记录第一天的内容吧</div>'; return; }
  dates.forEach(ds=>{
    const arr=getEntries(ds);
    const item=document.createElement('div'); item.className='log-item';
    const hasSum=State.aiSummaries[ds];
    const concat=arr.map(e=>e.text).join('。').slice(0,80);
    const count=arr.length;
    item.innerHTML=`<div class="log-item-top">
        <div class="log-item-date"><span>${ds}</span><span class="sum-badge">${count} 条</span>${hasSum?'<span class="sum-badge">✓ AI已归纳</span>':''}</div>
        <button class="log-del" data-ds="${esc(ds)}" title="删除这一天">🗑</button>
      </div>
      <div class="log-item-text">${esc(concat)}${concat.length>=80?'…':''}</div>
      ${hasSum?'<div class="log-item-sum">查看该日 AI 总结 →</div>':''}`;
    item.style.cursor='pointer';
    item.addEventListener('click',e=>{
      if(e.target.classList.contains('log-del')) return;
      if(State.aiSummaries[ds]) renderAiSummary(ds);
      else toast(ds+' 还没有生成总结，点「生成今日总结」先','warn');
    });
    item.querySelector('.log-del').onclick=(ev)=>{ ev.stopPropagation(); deleteOneLog(ds); };
    wrap.appendChild(item);
  });
}
/* 单独删除某天日志 */
function deleteOneLog(ds){
  const arr=getEntries(ds);
  if(!arr.length) return;
  if(!confirm('删除 '+ds+' 的全部 '+arr.length+' 条日志与AI总结？此操作不可恢复。')) return;
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
  // 明日计划：遗留项优先闭环，进行项持续推进
  const next=[];
  issue.slice(0,3).forEach(s=>next.push(`优先闭环：${stripTag(s).replace(/。$/,'')}，明确责任人与时间点`));
  progress.slice(0,2).forEach(s=>next.push(`继续推进：${stripTag(s).replace(/。$/,'')}`));
  if(!next.length) next.push('保持当前节奏，提前梳理明日待办并按优先级排定顺序');
  const kpis=[{l:'完成事项',v:doneN+'项'},{l:'今日工作量',v:total+'条'},{l:'成果完成率',v:progressRate+'%'}];
  const summary=`今日共梳理 ${total} 项工作，重心落在「${topCat}」方向，已闭环 ${doneN} 项${numbers?`，涉及「${numList.slice(0,4).join('、')}」等可量化产出`:''}。${issue.length?`当前存在 ${issue.length} 项待跟进问题（${stripTag(issue[0]).replace(/。$/,'')}），需在明日优先处理；`:'推进过程未出现明显阻塞；'}${progress.length?`另有 ${progress.length} 项工作处于进行中，建议保持连续性并在下一节点同步进展。`:'各项工作均已形成明确结果。'}整体产出${doneN>=3?'较为饱满':'仍有提升空间'}，明日重点建议围绕遗留问题与未完成事项展开。`;
  return {kpis, done, progress, issue, comm, next, summary, raw:clauses.map(c=>c.clean)};
}
function dedup(arr){ return [...new Set(arr)]; }
function renderAiSummary(ds){
  const s=State.aiSummaries[ds];
  const out=$('#reportOut');
  if(!s){ out.innerHTML='<div class="placeholder">该日期暂无AI总结</div>'; return; }
  const block=(title,items)=>{ if(!items.length) return ''; return `<div class="sum-head">${title}</div><ul>${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`; };
  out.innerHTML=`
    <div style="font-size:11px;color:var(--ink-3);margin-bottom:5px;font-family:var(--mono)">AI 工作日报 · ${ds}</div>
    <div class="sum-kpi">${s.kpis.map(k=>`<div class="kpi"><b>${k.v}</b><span>${k.l}</span></div>`).join('')}</div>
    ${block('一、今日完成',s.done)}
    ${block('二、进行中 / 推进',s.progress)}
    ${block('三、问题与待办',s.issue)}
    ${block('四、沟通与协作',s.comm)}
    ${block('五、明日计划',s.next||[])}
    <div class="sum-head">总体小结</div>
    <div class="sum-text">${esc(s.summary)}</div>`;
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
/* 一键生成今日总结（先自动录入草稿，再调用 AI 总结） */
function generateTodaySummary(){
  const ds=todayStr();
  const draft=$('#logInput').value.trim();
  if(draft){ addLogEntry(draft, 'manual'); $('#logInput').value=''; }
  const arr=getEntries(ds);
  if(!arr.length){ toast('请先录入今天的条目','warn'); return; }
  const text=concatEntries(ds);
  const res=aiSummarize(text);
  State.aiSummaries[ds]=res;
  save();
  renderAiSummary(ds);
  renderLogHistory();
  toast('已生成今日 AI 总结 ✓');
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
  $('#logClearBtn').onclick=()=>{
    $('#logInput').value='';
    $('#reportOut').innerHTML='<div class="placeholder">录入条目后，点「生成今日总结」<br>这里会生成结构化的 AI 总结。</div>';
    toast('草稿已清空');
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
  recognition.maxAlternatives=1;
  return recognition;
}
let voiceCtx=null;
let voiceState='idle'; // idle | listening | result
/* 开始语音输入 */
function startVoice(ctx){
  const rec=getRecognition(); if(!rec) return;
  voiceCtx=ctx; voiceState='listening';
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
  rec.onstart=()=>{ $('#listenPillText').textContent=ph[1]; };
  rec.onresult=e=>{
    const parts=[];
    for(let i=0;i<e.results.length;i++){ if(e.results[i].isFinal) parts.push(e.results[i][0].transcript); }
    const text=parts.join('').trim();
    if(text){ voiceState='result'; handleVoiceResult(ctx,text); }
  };
  rec.onerror=ev=>{
    pill.classList.add('hidden');
    if(ev.error==='not-allowed') toast('麦克风权限被拒绝，请在浏览器中允许','err');
    else if(ev.error==='no-speech') toast('未检测到声音，请靠近麦克风再说一次','warn');
    else toast('语音识别出错：'+ev.error,'err');
    voiceState='idle';
  };
  rec.onend=()=>{
    pill.classList.add('hidden');
    if(voiceState==='result'){ /* 已在结果回调里弹出确认 */ }
    voiceState='idle';
  };
  try{ rec.start(); }
  catch(e){ toast('语音已占用，请稍后再试','warn'); pill.classList.add('hidden'); voiceState='idle'; }
}
/* 手动停止语音（也触发识别结束） */
function stopVoice(){
  const rec=recognition;
  if(rec){ try{ rec.stop(); }catch(e){} }
  $('#listenPill').classList.add('hidden');
}
function handleVoiceResult(ctx,text){
  if(ctx==='task') openTaskConfirm(parseTaskText(text));
  else if(ctx==='report') handleReportVoice(text);
  else openIdeaConfirm(text);
}
/* 工作总结语音：识别到的内容直接作为一条「语音」条目入库 */
function handleReportVoice(text){
  if(!text || !text.trim()) return;
  if(addLogEntry(text, 'voice')){
    toast('已录入一条语音内容 🎤');
  }else{
    toast('语音识别结果为空','warn');
  }
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
    <div class="vm-label">识别到的内容</div>
    <div class="vm-idea">${esc(text)}</div>
    <div class="vm-hint">确认后保存为一条灵感${State.ideaAi?'，并自动进行 AI 发散。':''}</div>`;
  const ok=$('#voiceModalOk');
  ok.textContent='✓ 保存灵感';
  ok.onclick=()=>{ saveVoiceIdea(); };
  $('#voiceModalCancel').onclick=()=>{ window.__voiceIdea=null; closeVoiceModal(); };
  $('#voiceModal').classList.remove('hidden');
}
function saveVoiceIdea(){
  const text=window.__voiceIdea; if(!text) return;
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
  });
}
function load(){
  const d=Store.read(); if(!d) return;
  if(Array.isArray(d.tasks)) State.tasks=d.tasks;
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
  if(['warm','cold','night'].includes(d.theme)) State.theme=d.theme;
}
/* 首次使用：不预置任何示例任务/日志/灵感，保持干净 */
function seedDemo(){ save(); }

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
  // 语音控制
  $('#pillStop').onclick=()=>stopVoice();
  $('#voiceModalClose').onclick=closeVoiceModal;
  $('#voiceModal').addEventListener('click',e=>{ if(e.target.id==='voiceModal') closeVoiceModal(); });
  // 助手 banner 语音快速按钮
  $('#quickVoice').onclick=()=>startVoice('task');
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