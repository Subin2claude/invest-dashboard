// ════════════════════════════════════════════════════
// 투자 인텔리전스 대시보드 — 메인 스크립트
// 백엔드 API: /api/stocks, /api/news
// ════════════════════════════════════════════════════

// ───────── 1. 시세 가져올 심볼 정의 ─────────
const INDICES_SYMBOLS = [
  { yf: '^KS11',  label: 'KOSPI',   sub: '코스피' },
  { yf: '^KQ11',  label: 'KOSDAQ',  sub: '코스닥' },
  { yf: '^GSPC',  label: 'S&P 500', sub: 'NYSE' },
  { yf: '^IXIC',  label: 'NASDAQ',  sub: 'NASDAQ' },
  { yf: '^DJI',   label: 'DOW',     sub: 'NYSE' },
  { yf: '^N225',  label: 'NIKKEI',  sub: '일본' },
];

const FX_SYMBOLS = [
  { yf: 'KRW=X',  label: 'USD/KRW', sub: '달러원' },
  { yf: 'JPY=X',  label: 'USD/JPY', sub: '달러엔' },
  { yf: 'GC=F',   label: '금',       sub: '$/oz' },
  { yf: 'CL=F',   label: 'WTI 원유', sub: '$/bbl' },
];

// ───────── 2. 기본 포트폴리오 ─────────
const DEFAULT_PORTFOLIO = {
  intl: [
    { sym:'TSLA', name:'Tesla', yf:'TSLA', pct:50, color:'#ff4560', action:'sell', actionLabel:'30% 익절' },
    { sym:'TQQQ', name:'ProShares UltraPro QQQ', yf:'TQQQ', pct:27, color:'#f5c842', action:'sell', actionLabel:'50% 익절' },
    { sym:'AMD',  name:'Advanced Micro Devices', yf:'AMD', pct:11, color:'#00d4aa', action:'hold', actionLabel:'홀드' },
    { sym:'AMZN', name:'Amazon', yf:'AMZN', pct:7, color:'#0099ff', action:'hold', actionLabel:'홀드' },
    { sym:'T',    name:'AT&T', yf:'T', pct:6, color:'#8b95a8', action:'hold', actionLabel:'홀드' },
  ],
  dom: [
    { sym:'삼성전자', name:'005930', yf:'005930.KS', pct:33, action:'hold', actionLabel:'홀드' },
    { sym:'한미반도체', name:'042700', yf:'042700.KQ', pct:6, action:'buy', actionLabel:'추가 매수' },
    { sym:'SK하이닉스', name:'000660', yf:'000660.KS', pct:3, action:'hold', actionLabel:'홀드' },
    { sym:'삼성SDI', name:'006400', yf:'006400.KS', pct:0, action:'hold', actionLabel:'홀드' },
    { sym:'POSCO홀딩스', name:'005490', yf:'005490.KS', pct:0, action:'hold', actionLabel:'홀드' },
    { sym:'성일하이텍', name:'365340', yf:'365340.KQ', pct:0, action:'cut', actionLabel:'손절 검토' },
    { sym:'코스모화학', name:'079720', yf:'079720.KQ', pct:0, action:'cut', actionLabel:'손절 검토' },
  ],
  watch: [
    { sym:'NVDA', name:'NVIDIA', yf:'NVDA', note:'조정 시 분할매수 — 차트 보고 진입가 결정', action:'watch', actionLabel:'분할매수 준비' },
    { sym:'HD현대중공업', name:'329180', yf:'329180.KS', note:'조선 슈퍼사이클 — 조정 시 분할 진입', action:'watch', actionLabel:'분할매수 준비' },
    { sym:'한미반도체', name:'042700', yf:'042700.KQ', note:'HBM 공급망 모멘텀 지속', action:'buy', actionLabel:'추가 분할매수' },
  ],
  strategy: {
    cut: [
      { sym:'코스모화학', detail:'2차전지 업황 회복 지연. 반등 시 분할 손절 후 수익 섹터 재배치.', target:'반등 5% 시 분할 손절', prog:0 },
      { sym:'성일하이텍', detail:'폐배터리 재활용 수요 둔화. 손절 후 조선·AI 반도체 섹터로 전환.', target:'현 가격대 분할 손절', prog:0 },
    ],
    sell: [
      { sym:'TQQQ', detail:'나스닥 3배 레버리지 변동성 누적. 50% 익절 후 NVDA 현물 전환 권장.', target:'반등 시 50% 익절', prog:0 },
      { sym:'TSLA', detail:'관세·경쟁 리스크 누적. 30% 부분 익절로 헤지.', target:'반등 시 30% 익절', prog:0 },
    ],
    buy: [
      { sym:'NVDA', detail:'Blackwell GPU 수요 폭발. AI 데이터센터 수혜 지속.', target:'조정 구간 분할매수', prog:0 },
      { sym:'HD현대중공업', detail:'LNG선 수주 잔고 사상 최대 + 방산 모멘텀.', target:'조정 시 분할 진입', prog:0 },
      { sym:'한미반도체', detail:'HBM4 공급망 핵심. TSMC 레퍼런스 진입 가시화.', target:'단계적 추가 매수', prog:30 },
    ],
  }
};

const STORAGE_KEY = 'invest_intel_portfolio_v3';
function loadPortfolio() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch(e) {}
  return JSON.parse(JSON.stringify(DEFAULT_PORTFOLIO));
}
function saveToStorage(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(e) {} }
let PORTFOLIO = loadPortfolio();

// ───────── 3. 시세 데이터 캐시 ─────────
const PRICE_CACHE = {};

// ───────── 4. 백엔드 API 호출 ─────────
async function fetchStocks(symbols) {
  if (!symbols.length) return {};
  const url = `/api/stocks?symbols=${encodeURIComponent(symbols.join(','))}`;
  try {
    const r = await fetch(url);
    const json = await r.json();
    return json.data || {};
  } catch (e) {
    console.error('fetchStocks error:', e);
    return {};
  }
}

async function fetchNews(category) {
  const url = `/api/news?category=${category}`;
  try {
    const r = await fetch(url);
    const json = await r.json();
    return json.items || [];
  } catch (e) {
    console.error('fetchNews error:', e);
    return [];
  }
}

// ───────── 5. 시세 가져와서 캐시 + 렌더 ─────────
async function refreshAllPrices() {
  // 모든 심볼 모으기
  const allSymbols = new Set();
  INDICES_SYMBOLS.forEach(s => allSymbols.add(s.yf));
  FX_SYMBOLS.forEach(s => allSymbols.add(s.yf));
  PORTFOLIO.intl.forEach(p => p.yf && allSymbols.add(p.yf));
  PORTFOLIO.dom.forEach(p => p.yf && allSymbols.add(p.yf));
  PORTFOLIO.watch.forEach(p => p.yf && allSymbols.add(p.yf));

  const data = await fetchStocks([...allSymbols]);
  Object.assign(PRICE_CACHE, data);

  renderIndices();
  renderHoldings();
  renderFx();
  renderPortfolio();

  document.getElementById('upd-indices').textContent = new Date().toLocaleTimeString('ko-KR') + ' 기준';
}

// ───────── 6. 가격 포맷 ─────────
function fmtPrice(p, sym) {
  if (p === undefined || p === null) return '--';
  if (sym && (sym.endsWith('.KS') || sym.endsWith('.KQ') || sym === '^KS11' || sym === '^KQ11')) {
    return p.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '원';
  }
  if (sym === 'KRW=X') return p.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  if (p > 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p > 10) return p.toFixed(2);
  return p.toFixed(4);
}

function fmtChange(c) {
  if (c === undefined || c === null) return '--';
  const sign = c >= 0 ? '+' : '';
  return sign + c.toFixed(2) + '%';
}

// ───────── 7. 카드 렌더 ─────────
function makeCard(yf, label, sub) {
  const d = PRICE_CACHE[yf];
  if (!d || d.error || d.price === undefined) {
    return `<div class="q-card flat">
      <div class="q-lbl">${label}</div>
      <div class="q-val loading">--</div>
      <div class="q-sub">${sub || ''}</div>
    </div>`;
  }
  const cp = d.changePercent || 0;
  const dir = cp > 0.01 ? 'up' : cp < -0.01 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '▬';
  return `<div class="q-card ${dir}">
    <div class="q-lbl">${label}</div>
    <div class="q-val">${fmtPrice(d.price, yf)}</div>
    <div class="q-chg ${dir}">${arrow} ${fmtChange(cp)}</div>
    <div class="q-sub">${sub || ''}</div>
  </div>`;
}

function renderIndices() {
  const el = document.getElementById('indices-cards');
  if (!el) return;
  el.innerHTML = INDICES_SYMBOLS.map(s => makeCard(s.yf, s.label, s.sub)).join('');
}

function renderHoldings() {
  const el = document.getElementById('holdings-cards');
  if (!el) return;
  // 보유 비중 있는 종목만 (해외 + 국내 중 비중 있는 것)
  const holdings = [
    ...PORTFOLIO.intl.filter(p => p.pct > 0),
    ...PORTFOLIO.dom.filter(p => p.pct > 0),
  ].slice(0, 8); // 최대 8개
  el.innerHTML = holdings.map(p => makeCard(p.yf, p.sym, p.name)).join('');
}

function renderFx() {
  const el = document.getElementById('fx-cards');
  if (!el) return;
  el.innerHTML = FX_SYMBOLS.map(s => makeCard(s.yf, s.label, s.sub)).join('');
}

// ───────── 8. 포트폴리오 렌더 ─────────
function renderPortfolio() {
  // 해외
  const intl = document.getElementById('intl-port');
  if (intl) intl.innerHTML = PORTFOLIO.intl.map(p => {
    const d = PRICE_CACHE[p.yf];
    const priceHtml = d && !d.error && d.price !== undefined
      ? `<span class="tr-price">$${fmtPrice(d.price)}</span><span class="tr-chg-inline ${d.changePercent>=0?'up':'down'}">${fmtChange(d.changePercent)}</span>`
      : '';
    return `
    <div class="tr">
      <div><div class="tr-sym">${p.sym}</div><div class="tr-name">${p.name}</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="tr-r">
          ${priceHtml}
          <span class="ab ab-${p.action}">${p.actionLabel}</span>
        </div>
        ${p.pct ? `<div class="pb-wrap" style="width:140px"><div class="pb-bg"><div class="pb-fill" style="width:${p.pct}%;background:${p.color}"></div></div><span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${p.pct}%</span></div>` : ''}
      </div>
    </div>`;
  }).join('');

  // 국내
  const dom = document.getElementById('dom-port');
  if (dom) dom.innerHTML = PORTFOLIO.dom.map(p => {
    const d = PRICE_CACHE[p.yf];
    const priceHtml = d && !d.error && d.price !== undefined
      ? `<span class="tr-price">${fmtPrice(d.price, p.yf)}</span><span class="tr-chg-inline ${d.changePercent>=0?'up':'down'}">${fmtChange(d.changePercent)}</span>`
      : '';
    return `
    <div class="tr">
      <div><div class="tr-sym">${p.sym}</div><div class="tr-name">${p.name}</div></div>
      <div class="tr-r">
        ${priceHtml}
        ${p.pct ? `<span style="font-family:var(--mono);font-size:10px;color:var(--text3)">${p.pct}%</span>` : ''}
        <span class="ab ab-${p.action}">${p.actionLabel}</span>
      </div>
    </div>`;
  }).join('');

  // 관심
  const wl = document.getElementById('watchlist');
  if (wl) wl.innerHTML = PORTFOLIO.watch.map(w => {
    const d = PRICE_CACHE[w.yf];
    const priceHtml = d && !d.error && d.price !== undefined
      ? `<span class="tr-price">${w.yf && (w.yf.endsWith('.KS') || w.yf.endsWith('.KQ')) ? fmtPrice(d.price, w.yf) : '$'+fmtPrice(d.price)}</span><span class="tr-chg-inline ${d.changePercent>=0?'up':'down'}">${fmtChange(d.changePercent)}</span>`
      : '';
    return `
    <div class="tr">
      <div>
        <div class="tr-sym">${w.sym}</div>
        <div class="tr-name">${w.name}</div>
        <div style="font-size:10px;color:var(--accent);margin-top:2px">${w.note}</div>
      </div>
      <div class="tr-r">
        ${priceHtml}
        <span class="ab ab-${w.action}">${w.actionLabel}</span>
      </div>
    </div>`;
  }).join('');

  renderStrategy();
}

function renderStrategy() {
  const s = PORTFOLIO.strategy;
  const card = (x, badge, badgeLbl, color) => `
    <div class="strat-item">
      <div class="strat-top"><span class="strat-sym">${x.sym}</span><span class="ab ${badge}">${badgeLbl}</span></div>
      <div class="strat-body">${x.detail}</div>
      ${x.target ? `<div class="strat-target">🎯 ${x.target}</div>` : ''}
      <div class="strat-prog"><span class="prog-lbl">진행도</span><div class="prog-bar"><div class="prog-fill" style="width:${x.prog||0}%;background:${color}"></div></div><span style="font-family:var(--mono);font-size:9px;color:${color}">${x.prog||0}%</span></div>
    </div>`;
  const cutEl = document.getElementById('strat-cut');
  if (cutEl) cutEl.innerHTML = (s.cut||[]).map(x => card(x,'ab-cut','손절 검토','var(--red)')).join('');
  const sellEl = document.getElementById('strat-sell');
  if (sellEl) sellEl.innerHTML = (s.sell||[]).map(x => card(x,'ab-sell','부분 익절','var(--gold)')).join('');
  const buyEl = document.getElementById('strat-buy');
  if (buyEl) buyEl.innerHTML = (s.buy||[]).map(x => card(x,'ab-buy','분할매수','var(--green)')).join('');
}

// ───────── 9. 뉴스 렌더 ─────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr); if (isNaN(d)) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return Math.floor(diff/60) + '분 전';
  if (diff < 86400) return Math.floor(diff/3600) + '시간 전';
  if (diff < 604800) return Math.floor(diff/86400) + '일 전';
  return d.toLocaleDateString('ko-KR', {month:'short',day:'numeric'});
}

async function loadNewsCategory(category, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.innerHTML = '<div class="news-loading">📰 뉴스 가져오는 중...</div>';
  const items = await fetchNews(category);
  if (!items.length) {
    el.innerHTML = '<div class="news-loading">⚠️ 뉴스를 가져오지 못했습니다.</div>';
    return;
  }
  el.innerHTML = items.map(it => `
    <a class="news-item" href="${it.link}" target="_blank" rel="noopener" style="display:block;text-decoration:none;color:inherit">
      <div class="news-meta">
        <span class="news-src">${it.source || '뉴스'}</span>
        <span style="color:var(--border2)">·</span>
        <span>${timeAgo(it.pubDate)}</span>
        <span style="margin-left:auto;color:var(--accent);font-size:10px">↗</span>
      </div>
      <div class="news-title">${it.title}</div>
    </a>
  `).join('');
}

// ───────── 10. 정적 데이터 (이벤트, 부동산) ─────────
const EVENTS = [
  {date:'04/30',title:'PCE 물가지수 발표',desc:'미 연준 선호 인플레 지표',tag:'econ'},
  {date:'05/01',title:'FOMC 회의 시작',desc:'5월 금리 결정 (5/1~2)',tag:'fomc'},
  {date:'05/02',title:'FOMC 결과 + 파월 기자회견',desc:'동결 vs 인하 주목',tag:'fomc'},
  {date:'05/02',title:'Apple 1Q 실적 발표',desc:'EPS $1.62 예상',tag:'earn'},
  {date:'05/08',title:'한국 1분기 GDP 확정',desc:'성장률 전망 2.1%',tag:'kr'},
  {date:'05/15',title:'미국 CPI 발표',desc:'4월 소비자물가 전망 2.9%',tag:'econ'},
];

function renderEvents() {
  const el = document.getElementById('ev-cal'); if (!el) return;
  const tagMap = {fomc:'tag-fomc',econ:'tag-econ',earn:'tag-earn',kr:'tag-kr'};
  const tagLbl = {fomc:'FOMC',econ:'지표',earn:'실적',kr:'국내'};
  el.innerHTML = EVENTS.map(e=>`
    <div class="ev-item">
      <span class="ev-date">${e.date}</span>
      <div>
        <div class="ev-title">${e.title}<span class="ev-tag ${tagMap[e.tag]}">${tagLbl[e.tag]}</span></div>
        <div class="ev-desc">${e.desc}</div>
      </div>
    </div>`).join('');
}

const RE_DATA = {
  seoul: {title:'서울 전체 동향', stats:[
    {label:'매매가 변동',val:'+0.04%',dir:'up',sub:'주간'},
    {label:'전세가 변동',val:'+0.02%',dir:'up',sub:'주간'},
    {label:'KB선도아파트 50지수',val:'216.3',dir:'up',sub:'+0.3pt'},
    {label:'주담대 금리',val:'3.62%',dir:'down',sub:'5대은행 평균'},
  ]},
  gangnam: {title:'강남·서초·송파 동향', stats:[
    {label:'강남 3구 매매가',val:'+0.09%',dir:'up',sub:'주간'},
    {label:'강남 3구 전세가',val:'+0.05%',dir:'up',sub:'주간'},
    {label:'강남구 평균 매매가',val:'29.4억',dir:'up',sub:'84㎡'},
    {label:'월간 거래량',val:'312건',dir:'up',sub:'강남 3구'},
  ]},
  pangyo: {title:'경기 판교 동향', stats:[
    {label:'판교 매매가',val:'+0.06%',dir:'up',sub:'주간'},
    {label:'판교 전세가',val:'+0.03%',dir:'up',sub:'주간'},
    {label:'평균 매매가 (84㎡)',val:'14.8억',dir:'up',sub:'분당구 일부'},
    {label:'IT 수요 동향',val:'강보합',dir:'flat',sub:'재택 해제 후 회복'},
  ]},
  bundang: {title:'경기 분당 동향', stats:[
    {label:'분당 매매가',val:'+0.05%',dir:'up',sub:'주간'},
    {label:'분당 전세가',val:'+0.02%',dir:'up',sub:'주간'},
    {label:'평균 매매가 (84㎡)',val:'12.1억',dir:'up',sub:'재건축 기대'},
    {label:'선도지구 기대감',val:'높음',dir:'up',sub:'착공 일정 주목'},
  ]},
};

function switchRegion(r, btn) {
  document.querySelectorAll('.re-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('re-region-title').textContent = RE_DATA[r].title;
  document.getElementById('re-stats').innerHTML = RE_DATA[r].stats.map(s=>`
    <div class="re-card">
      <div class="re-lbl">${s.label}</div>
      <div class="re-val ${s.dir}">${s.val}</div>
      <div class="re-sub">${s.sub}</div>
    </div>`).join('');
}

function renderRealEstate() {
  switchRegion('seoul', document.querySelector('.re-tab'));
  const pol = document.getElementById('re-policy');
  if (pol) pol.innerHTML = [
    {badge:'HOT',bc:'pol-hot',title:'스트레스 DSR 2단계 시행 임박',desc:'금융당국 6월 시행 검토. 대출 한도 추가 축소 예상.'},
    {badge:'INFO',bc:'pol-info',title:'1기 신도시 선도지구 지정 완료',desc:'분당·일산·평촌·산본·중동 지정 완료. 분당 착공 가장 빠를 전망.'},
    {badge:'WARN',bc:'pol-warn',title:'취득세 중과 완화 논의',desc:'다주택자 취득세 중과 일부 완화 입법 예고.'},
    {badge:'INFO',bc:'pol-info',title:'특례보금자리론 금리 인하',desc:'주금공, 0.1%p 인하 시행.'},
  ].map(p=>`<div class="policy-item"><span class="pol-badge ${p.bc}">${p.badge}</span><div><div class="pol-title">${p.title}</div><div class="pol-desc">${p.desc}</div></div></div>`).join('');

  const apt = document.getElementById('apt-cal');
  if (apt) apt.innerHTML = [
    {name:'래미안 원펜타스',loc:'서울 서초구 반포동',date:'5/12',units:'292세대',rt:'apt-seoul',rl:'서울'},
    {name:'디에이치 방배 아크로',loc:'서울 서초구 방배동',date:'5/18',units:'3,065세대',rt:'apt-seoul',rl:'서울'},
    {name:'힐스테이트 판교 모비우스',loc:'경기 성남시 판교',date:'5/21',units:'384세대',rt:'apt-gyeonggi',rl:'판교'},
    {name:'e편한세상 분당 어반파크',loc:'경기 성남시 분당구',date:'5/26',units:'612세대',rt:'apt-gyeonggi',rl:'분당'},
    {name:'힐스테이트 동탄레이크파크',loc:'경기 화성시 동탄2',date:'5/28',units:'484세대',rt:'apt-gyeonggi',rl:'경기'},
    {name:'검단신도시 푸르지오',loc:'인천 서구 원당동',date:'6/03',units:'1,124세대',rt:'apt-incheon',rl:'인천'},
  ].map(a=>`<div class="apt-row"><div><div class="apt-name"><span class="apt-rtag ${a.rt}">${a.rl}</span>${a.name}</div><div class="apt-loc">${a.loc}</div></div><div style="text-align:right"><div class="apt-date">청약 ${a.date}</div><div class="apt-units">${a.units}</div></div></div>`).join('');
}

// ───────── 11. 모달 (포트폴리오 편집) ─────────
let editData = null;
const COLORS = ['#ff4560','#f5c842','#00d4aa','#0099ff','#8b95a8','#ff6b35','#a78bfa','#34d399','#fb923c','#60a5fa'];
const ACTION_OPTS = { hold:'홀드', buy:'매수', sell:'익절', cut:'손절 검토', watch:'관심' };

function openModal() { editData = JSON.parse(JSON.stringify(PORTFOLIO)); switchModalTab('intl'); document.getElementById('modal-overlay').classList.add('open'); document.getElementById('save-ok').classList.remove('show'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

function switchModalTab(tab) {
  ['intl','dom','watch','strat'].forEach(t => { document.getElementById('medit-'+t).style.display = t===tab?'block':'none'; });
  document.querySelectorAll('.modal-tab').forEach((b,i) => b.classList.toggle('active', ['intl','dom','watch','strat'][i]===tab));
  renderModalRows();
}

function actSel(val, onChange) {
  return `<select class="edit-select" onchange="${onChange}">
    ${Object.entries(ACTION_OPTS).map(([k,v])=>`<option value="${k}" ${val===k?'selected':''}>${v}</option>`).join('')}
  </select>`;
}

function renderModalRows() {
  const intl = document.getElementById('intl-edit-rows');
  if (intl) intl.innerHTML = editData.intl.map((p,i)=>`
    <tr>
      <td><input class="edit-input" value="${p.sym}" onchange="editData.intl[${i}].sym=this.value;editData.intl[${i}].yf=this.value" style="width:70px"></td>
      <td><input class="edit-input" value="${p.name}" onchange="editData.intl[${i}].name=this.value"></td>
      <td><input class="edit-input" type="number" value="${p.pct||0}" onchange="editData.intl[${i}].pct=+this.value" style="width:55px"></td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">${COLORS.map(c=>`<span class="color-dot${p.color===c?' selected':''}" style="background:${c}" onclick="editData.intl[${i}].color='${c}';renderModalRows()"></span>`).join('')}</div></td>
      <td>${actSel(p.action,`editData.intl[${i}].action=this.value;editData.intl[${i}].actionLabel=({hold:'홀드',buy:'매수',sell:'익절',cut:'손절 검토',watch:'관심'})[this.value]`)}</td>
      <td><button class="edit-del" onclick="editData.intl.splice(${i},1);renderModalRows()">✕</button></td>
    </tr>`).join('');

  const dom = document.getElementById('dom-edit-rows');
  if (dom) dom.innerHTML = editData.dom.map((p,i)=>`
    <tr>
      <td><input class="edit-input" value="${p.sym}" onchange="editData.dom[${i}].sym=this.value"></td>
      <td><input class="edit-input" value="${p.name}" onchange="editData.dom[${i}].name=this.value;editData.dom[${i}].yf=this.value+(editData.dom[${i}].yf&&editData.dom[${i}].yf.endsWith('.KQ')?'.KQ':'.KS')" style="width:90px" placeholder="005930.KS"></td>
      <td><input class="edit-input" type="number" value="${p.pct||0}" onchange="editData.dom[${i}].pct=+this.value" style="width:55px"></td>
      <td>${actSel(p.action,`editData.dom[${i}].action=this.value;editData.dom[${i}].actionLabel=({hold:'홀드',buy:'매수',sell:'익절',cut:'손절 검토',watch:'관심'})[this.value]`)}</td>
      <td><button class="edit-del" onclick="editData.dom.splice(${i},1);renderModalRows()">✕</button></td>
    </tr>`).join('');

  const wat = document.getElementById('watch-edit-rows');
  if (wat) wat.innerHTML = editData.watch.map((w,i)=>`
    <tr>
      <td><input class="edit-input" value="${w.sym}" onchange="editData.watch[${i}].sym=this.value" style="width:80px"></td>
      <td><input class="edit-input" value="${w.name}" onchange="editData.watch[${i}].name=this.value" style="width:70px"></td>
      <td><input class="edit-input" value="${w.note||''}" onchange="editData.watch[${i}].note=this.value"></td>
      <td>${actSel(w.action,`editData.watch[${i}].action=this.value;editData.watch[${i}].actionLabel=({hold:'홀드',buy:'매수',sell:'익절',cut:'손절 검토',watch:'관심'})[this.value]`)}</td>
      <td><button class="edit-del" onclick="editData.watch.splice(${i},1);renderModalRows()">✕</button></td>
    </tr>`).join('');

  ['cut','sell','buy'].forEach(type=>{
    const el = document.getElementById(`strat-${type}-rows`);
    if (!el) return;
    const color = type==='cut'?'var(--red)':type==='sell'?'var(--gold)':'var(--green)';
    el.innerHTML = (editData.strategy[type]||[]).map((x,i)=>`
      <div style="border:1px solid var(--border);border-radius:7px;padding:10px;margin-bottom:7px;background:var(--bg4)">
        <div style="display:flex;gap:8px;margin-bottom:7px;align-items:center">
          <input class="edit-input" value="${x.sym}" placeholder="종목명" onchange="editData.strategy.${type}[${i}].sym=this.value" style="width:100px">
          <input class="edit-input" type="number" value="${x.prog||0}" min="0" max="100" placeholder="%" onchange="editData.strategy.${type}[${i}].prog=+this.value" style="width:60px">
          <span style="font-size:9px;color:var(--text3)">%</span>
          <button class="edit-del" onclick="editData.strategy.${type}.splice(${i},1);renderModalRows()" style="margin-left:auto">✕</button>
        </div>
        <textarea class="edit-input" rows="2" placeholder="전략 설명" onchange="editData.strategy.${type}[${i}].detail=this.value" style="resize:none;font-family:'Noto Sans KR',sans-serif;margin-bottom:6px">${x.detail||''}</textarea>
        <input class="edit-input" value="${x.target||''}" placeholder="실행 기준" onchange="editData.strategy.${type}[${i}].target=this.value">
      </div>`).join('');
  });
}

function addRow(type) {
  if (type==='intl') editData.intl.push({sym:'NEW',name:'종목명',yf:'NEW',pct:0,color:'#00d4aa',action:'hold',actionLabel:'홀드'});
  else if (type==='dom') editData.dom.push({sym:'새종목',name:'005930.KS',yf:'005930.KS',pct:0,action:'hold',actionLabel:'홀드'});
  else if (type==='watch') editData.watch.push({sym:'NEW',name:'설명',yf:'NEW',note:'메모',action:'watch',actionLabel:'관심'});
  renderModalRows();
}

function addStratRow(type) {
  if (!editData.strategy[type]) editData.strategy[type] = [];
  editData.strategy[type].push({sym:'종목명',detail:'전략 설명',target:'실행 기준',prog:0});
  renderModalRows();
}

function savePortfolio() {
  PORTFOLIO = JSON.parse(JSON.stringify(editData));
  saveToStorage(PORTFOLIO);
  refreshAllPrices();
  const ok = document.getElementById('save-ok');
  ok.classList.add('show');
  setTimeout(()=>ok.classList.remove('show'), 2500);
}

// ───────── 12. 탭 전환 + 시계 ─────────
const TAB_NAMES = ['overview','portfolio','market','realestate','strategy'];
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.mt').forEach(e=>e.classList.remove('active'));
  document.getElementById('tab-'+name)?.classList.add('active');
  const i = TAB_NAMES.indexOf(name);
  document.querySelectorAll('.tab-btn')[i]?.classList.add('active');
  document.querySelectorAll('.mt')[i]?.classList.add('active');
}

setInterval(()=>{ document.getElementById('live-time').textContent = new Date().toLocaleTimeString('ko-KR'); }, 1000);
document.getElementById('live-time').textContent = new Date().toLocaleTimeString('ko-KR');

// ───────── 13. 새로고침 + 자동 갱신 ─────────
async function refreshAll() {
  const btn = document.getElementById('refresh-btn');
  btn.style.opacity = '0.5';
  await Promise.all([
    refreshAllPrices(),
    loadNewsCategory('global', 'news-global'),
    loadNewsCategory('domestic', 'news-domestic'),
    loadNewsCategory('realestate', 'news-realestate'),
  ]);
  btn.style.opacity = '1';
}

window.addEventListener('DOMContentLoaded', () => {
  renderEvents();
  renderPortfolio();
  renderRealEstate();
  refreshAll();
});

// 자동 갱신
setInterval(refreshAllPrices, 3 * 60 * 1000);  // 시세 3분
setInterval(() => {
  loadNewsCategory('global', 'news-global');
  loadNewsCategory('domestic', 'news-domestic');
  loadNewsCategory('realestate', 'news-realestate');
}, 10 * 60 * 1000);  // 뉴스 10분
