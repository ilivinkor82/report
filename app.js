'use strict';

const STORAGE_KEY = 'my-assets-v1';
const HIDE_KEY = 'my-assets-hide';

const CATEGORIES = [
  { id: 'cash', name: '현금·예적금', color: '#4f8cff' },
  { id: 'stock', name: '주식', color: '#f25f5c' },
  { id: 'fund', name: '펀드·ETF', color: '#ffb547' },
  { id: 'crypto', name: '가상자산', color: '#9b6bff' },
  { id: 'realestate', name: '부동산', color: '#2bb673' },
  { id: 'pension', name: '연금·보험', color: '#1fb5c9' },
  { id: 'etc', name: '기타 자산', color: '#8d99ae' },
  { id: 'debt', name: '부채', color: '#e5484d', liability: true },
];
const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// ---------- 상태 ----------
let state = load();
let editingId = null;
// 저장된 데이터가 없으면 예시 데이터를 보여 주고, 사용자가 처음 입력할 때 비운다.
let sampleMode = state === null;
if (sampleMode) state = sampleData();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { assets: data.assets || [], history: data.history || [] };
    }
  } catch (e) {
    console.warn('저장된 데이터를 불러오지 못했습니다.', e);
  }
  return null;
}

function sampleData() {
  const d = (monthsAgo) => {
    const t = new Date();
    t.setMonth(t.getMonth() - monthsAgo, 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
  };
  return {
    assets: [
      { id: 's1', category: 'cash', name: '주택청약종합저축', institution: '국민은행', value: 12400000, cost: 0, memo: '월 10만원 납입' },
      { id: 's2', category: 'cash', name: '파킹통장', institution: '토스뱅크', value: 3850000, cost: 0, memo: '' },
      { id: 's3', category: 'stock', name: '삼성전자', institution: '키움증권', value: 7120000, cost: 6300000, memo: '100주' },
      { id: 's4', category: 'fund', name: 'TIGER 미국S&P500', institution: '미래에셋증권', value: 9860000, cost: 8000000, memo: '' },
      { id: 's5', category: 'crypto', name: '비트코인', institution: '업비트', value: 2310000, cost: 3000000, memo: '' },
      { id: 's6', category: 'pension', name: '연금저축펀드', institution: '삼성증권', value: 6540000, cost: 6000000, memo: '' },
      { id: 's7', category: 'debt', name: '학자금 대출', institution: '한국장학재단', value: 4200000, cost: 0, memo: '' },
    ],
    history: [
      { date: d(5), net: 30100000 },
      { date: d(4), net: 31250000 },
      { date: d(3), net: 30800000 },
      { date: d(2), net: 33400000 },
      { date: d(1), net: 35900000 },
    ],
  };
}

function leaveSample() {
  if (!sampleMode) return;
  sampleMode = false;
  state = { assets: [], history: [] };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('브라우저에 저장하지 못했습니다. "백업 · 복원"에서 내용을 복사해 두세요.');
  }
}

// ---------- 유틸 ----------
const $ = (sel) => document.querySelector(sel);

function won(n) {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

function shortWon(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(abs >= 1e10 ? 0 : 1)}억`;
  if (abs >= 1e4) return `${sign}${Math.round(abs / 1e4).toLocaleString('ko-KR')}만`;
  return `${sign}${Math.round(abs)}`;
}

function pct(n) {
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function parseNum(str) {
  const n = Number(String(str ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 3000);
}

// confirm() 대신 페이지 안 대화상자로 확인을 받는다.
function askConfirm(message, okLabel = '확인') {
  const dlg = $('#confirm-dialog');
  $('#confirm-message').textContent = message;
  $('#confirm-yes').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'yes'), { once: true });
  });
}

// ---------- 계산 ----------
function totals() {
  let assets = 0;
  let debts = 0;
  let invested = 0;
  let investedValue = 0;
  const byCat = {};
  for (const a of state.assets) {
    const cat = catById[a.category] || catById.etc;
    if (cat.liability) {
      debts += a.value;
    } else {
      assets += a.value;
      byCat[cat.id] = (byCat[cat.id] || 0) + a.value;
      if (a.cost > 0) {
        invested += a.cost;
        investedValue += a.value;
      }
    }
  }
  return {
    assets,
    debts,
    net: assets - debts,
    byCat,
    profit: investedValue - invested,
    returnRate: invested > 0 ? ((investedValue - invested) / invested) * 100 : null,
  };
}

// ---------- 렌더링 ----------
function render() {
  $('#sample-banner').hidden = !sampleMode;
  const t = totals();
  renderSummary(t);
  renderDonut(t);
  renderHistory();
  renderTable(t);
}

function renderSummary(t) {
  $('#net-worth').textContent = won(t.net);
  $('#total-assets').textContent = won(t.assets);
  $('#total-debts').textContent = won(t.debts);

  const profitEl = $('#total-profit');
  profitEl.textContent = won(t.profit);
  profitEl.className = `money ${t.profit > 0 ? 'up' : t.profit < 0 ? 'down' : ''}`;
  $('#total-return').textContent =
    t.returnRate === null ? '매입금액을 입력하면 계산됩니다' : `수익률 ${pct(t.returnRate)}`;

  // 직전 기록 대비 변화
  const prev = [...state.history].reverse().find((h) => h.date !== today());
  $('#net-change').textContent = prev
    ? `${prev.date} 대비 ${t.net - prev.net >= 0 ? '+' : ''}${won(t.net - prev.net)}`
    : '';
}

function renderDonut(t) {
  const svg = $('#donut');
  const legend = $('#legend');
  const entries = CATEGORIES.filter((c) => !c.liability && t.byCat[c.id] > 0)
    .map((c) => ({ ...c, value: t.byCat[c.id] }));

  const r = 46;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  let paths = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--border)" stroke-width="18"/>`;
  for (const e of entries) {
    const len = (e.value / t.assets) * circ;
    paths += `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${e.color}" stroke-width="18"
      stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset}"
      transform="rotate(-90 60 60)"><title>${e.name} ${won(e.value)}</title></circle>`;
    offset += len;
  }
  paths += `<text x="60" y="57" text-anchor="middle" font-size="8" fill="var(--muted)">총자산</text>
    <text x="60" y="70" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)" class="money">${shortWon(t.assets)}</text>`;
  svg.innerHTML = paths;

  legend.innerHTML = entries.length
    ? entries.map((e) => `
      <li>
        <span class="swatch" style="background:${e.color}"></span>
        <span>${e.name}</span>
        <span class="pct">${((e.value / t.assets) * 100).toFixed(1)}%</span>
      </li>`).join('')
    : '<li class="pct">자산을 추가하면 구성이 표시됩니다</li>';
}

function renderHistory() {
  const box = $('#history-chart');
  const h = state.history;
  if (h.length < 2) {
    box.innerHTML = `<p class="placeholder">"오늘 기록하기"로 순자산을 기록해 두면<br>날짜별 추이를 볼 수 있어요. (기록 ${h.length}개)</p>`;
    return;
  }
  const W = 600, H = 200, padL = 50, padR = 12, padT = 12, padB = 26;
  const vals = h.map((p) => p.net);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const x = (i) => padL + (i / (h.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const line = h.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.net).toFixed(1)}`).join(' ');
  const area = `${line} L${x(h.length - 1).toFixed(1)},${H - padB} L${x(0).toFixed(1)},${H - padB} Z`;

  const ticks = [max, (max + min) / 2, min].map((v) => `
    <line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)"/>
    <text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" class="money">${shortWon(v)}</text>`).join('');

  const labelIdx = [...new Set([0, Math.floor((h.length - 1) / 2), h.length - 1])];
  const xLabels = labelIdx.map((i) => `
    <text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === h.length - 1 ? 'end' : 'middle'}"
      font-size="11" fill="var(--muted)">${h[i].date.slice(2)}</text>`).join('');

  const dots = h.map((p, i) => `
    <circle cx="${x(i)}" cy="${y(p.net)}" r="3.5" fill="var(--accent)">
      <title>${p.date} · ${won(p.net)}</title>
    </circle>`).join('');

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}">
    ${ticks}
    <path d="${area}" fill="var(--accent)" opacity="0.12"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    ${dots}${xLabels}
  </svg>`;
}

function renderTable(t) {
  const filter = $('#filter').value;
  const rows = state.assets
    .filter((a) => filter === 'all' || a.category === filter)
    .sort((a, b) => {
      const ca = CATEGORIES.findIndex((c) => c.id === a.category);
      const cb = CATEGORIES.findIndex((c) => c.id === b.category);
      return ca - cb || b.value - a.value;
    });

  $('#asset-rows').innerHTML = rows.map((a) => {
    const cat = catById[a.category] || catById.etc;
    const share = cat.liability || !t.assets ? '' : `${((a.value / t.assets) * 100).toFixed(1)}%`;
    let ret = '-';
    if (!cat.liability && a.cost > 0) {
      const r = ((a.value - a.cost) / a.cost) * 100;
      ret = `<span class="${r > 0 ? 'up' : r < 0 ? 'down' : ''}">${pct(r)}</span>`;
    }
    return `
      <tr class="${cat.liability ? 'debt' : ''}">
        <td><span class="badge"><span class="dot" style="background:${cat.color}"></span>${cat.name}</span></td>
        <td>${escapeHtml(a.name)}${a.memo ? `<span class="memo">${escapeHtml(a.memo)}</span>` : ''}</td>
        <td>${escapeHtml(a.institution) || '-'}</td>
        <td class="num value">${cat.liability ? '-' : ''}${won(a.value)}</td>
        <td class="num">${ret}</td>
        <td class="num">${share}</td>
        <td>
          <div class="row-actions" ${sampleMode ? 'hidden' : ''}>
            <button class="btn icon" data-edit="${a.id}" title="수정">수정</button>
            <button class="btn icon" data-del="${a.id}" title="삭제">삭제</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  $('#empty').hidden = rows.length > 0;
}

// ---------- 입력 폼 ----------
const dialog = $('#asset-dialog');
const form = $('#asset-form');

function openDialog(asset) {
  editingId = asset ? asset.id : null;
  $('#dialog-title').textContent = asset ? '자산 수정' : '자산 추가';
  form.reset();
  const f = form.elements;
  f.category.value = asset ? asset.category : ($('#filter').value !== 'all' ? $('#filter').value : 'cash');
  if (asset) {
    f.name.value = asset.name;
    f.institution.value = asset.institution || '';
    f.value.value = asset.value.toLocaleString('ko-KR');
    f.cost.value = asset.cost ? asset.cost.toLocaleString('ko-KR') : '';
    f.memo.value = asset.memo || '';
  }
  dialog.showModal();
  f.name.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = form.elements;
  const data = {
    category: f.category.value,
    name: f.name.value.trim(),
    institution: f.institution.value.trim(),
    value: parseNum(f.value.value),
    cost: parseNum(f.cost.value),
    memo: f.memo.value.trim(),
  };
  if (!data.name) return;
  leaveSample();
  if (editingId) {
    Object.assign(state.assets.find((a) => a.id === editingId), data);
  } else {
    state.assets.push({ id: uid(), ...data });
  }
  save();
  dialog.close();
  render();
});

// 금액 입력 시 천 단위 콤마 표시
for (const name of ['value', 'cost']) {
  form.elements[name].addEventListener('input', (e) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    e.target.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
  });
}

$('#cancel-btn').addEventListener('click', () => dialog.close());
$('#add-btn').addEventListener('click', () => openDialog(null));

$('#asset-rows').addEventListener('click', (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.del;
  if (editId) openDialog(state.assets.find((a) => a.id === editId));
  if (delId) {
    const a = state.assets.find((x) => x.id === delId);
    if (!a) return;
    askConfirm(`"${a.name}" 항목을 삭제할까요?`, '삭제').then((ok) => {
      if (!ok) return;
      state.assets = state.assets.filter((x) => x.id !== delId);
      save();
      render();
      toast('삭제했습니다.');
    });
  }
});

$('#filter').addEventListener('change', render);

// ---------- 순자산 기록 ----------
$('#snapshot-btn').addEventListener('click', () => {
  if (sampleMode) {
    toast('내 자산을 먼저 입력한 뒤 기록해 주세요.');
    return;
  }
  const t = totals();
  const entry = { date: today(), net: t.net, assets: t.assets, debts: t.debts };
  const idx = state.history.findIndex((h) => h.date === entry.date);
  if (idx >= 0) state.history[idx] = entry;
  else state.history.push(entry);
  state.history.sort((a, b) => a.date.localeCompare(b.date));
  save();
  render();
  toast(`${entry.date} 순자산 ${won(entry.net)}을 기록했습니다.`);
});

$('#clear-sample-btn').addEventListener('click', () => {
  leaveSample();
  render();
});

// ---------- 백업 ----------
const backupDialog = $('#backup-dialog');
const backupText = $('#backup-text');

$('#backup-btn').addEventListener('click', () => {
  backupText.value = sampleMode ? '' : JSON.stringify(state, null, 2);
  backupDialog.showModal();
});
$('#close-backup-btn').addEventListener('click', () => backupDialog.close());

$('#copy-backup-btn').addEventListener('click', () => {
  const done = () => toast('백업 내용을 복사했습니다.');
  const fallback = () => {
    backupText.focus();
    backupText.select();
    toast('내용을 선택했습니다. Ctrl+C(⌘+C)로 복사하세요.');
  };
  try {
    navigator.clipboard.writeText(backupText.value).then(done, fallback);
  } catch (e) {
    fallback();
  }
});

// 일반 브라우저에서는 파일로 저장된다. (Claude 아티팩트 안에서는 다운로드가 막혀 있어 복사를 사용)
$('#download-backup-btn')?.addEventListener('click', () => {
  const blob = new Blob([backupText.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `my-assets-${today()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('#import-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) backupText.value = await file.text();
  e.target.value = '';
});

$('#restore-btn').addEventListener('click', async () => {
  let data;
  try {
    data = JSON.parse(backupText.value);
    if (!Array.isArray(data.assets)) throw new Error('형식 오류');
  } catch (err) {
    toast('백업 내용을 읽지 못했습니다. 복사해 둔 내용 전체를 그대로 붙여넣었는지 확인하세요.');
    return;
  }
  if (!sampleMode && !(await askConfirm('현재 데이터를 백업 내용으로 바꿀까요?', '바꾸기'))) return;
  sampleMode = false;
  state = {
    assets: data.assets.map((a) => ({
      id: a.id || uid(),
      category: catById[a.category] ? a.category : 'etc',
      name: String(a.name ?? ''),
      institution: String(a.institution ?? ''),
      value: parseNum(a.value),
      cost: parseNum(a.cost),
      memo: String(a.memo ?? ''),
    })),
    history: Array.isArray(data.history)
      ? data.history.filter((h) => h && typeof h.date === 'string').map((h) => ({ ...h, net: parseNum(h.net) }))
      : [],
  };
  save();
  backupDialog.close();
  render();
  toast(`자산 ${state.assets.length}개를 복원했습니다.`);
});

// ---------- 스크린샷으로 추가 ----------
// Claude 아티팩트 안에서만 동작한다. (window.claude가 없으면 버튼이 숨겨진 채로 남는다)
const scanDialog = $('#scan-dialog');
let askClaude = null;
let imageLimits = null;
let scanFiles = [];
let scanItems = [];
let scanCtl = null;

(async () => {
  if (!window.claude?.use) return;
  const s = await window.claude.use('sample');
  if (!s) return;
  const lim = await s.limits().catch(() => null);
  if (!lim?.images) return;
  askClaude = s;
  imageLimits = lim.images;
  $('#scan-input').accept = imageLimits.mediaTypes.join(',');
  $('#scan-btn').hidden = false;
})();

function normalize(str) {
  return String(str ?? '').replace(/\s+/g, '').toLowerCase();
}

function findMatch(item) {
  if (sampleMode) return null;
  return state.assets.find((a) => normalize(a.name) === normalize(item.name)
    && (!item.institution || !a.institution || normalize(a.institution) === normalize(item.institution))) || null;
}

function setScanStatus(msg) {
  $('#scan-status').textContent = msg;
}

function resetScan() {
  scanCtl?.abort();
  for (const img of document.querySelectorAll('#scan-previews img')) URL.revokeObjectURL(img.src);
  scanFiles = [];
  scanItems = [];
  $('#scan-previews').innerHTML = '';
  $('#scan-results').innerHTML = '';
  setScanStatus('');
  $('#scan-run').disabled = true;
  $('#scan-run').hidden = false;
  $('#scan-apply').hidden = true;
  $('#scan-stop').hidden = true;
}

function setScanFiles(fileList) {
  const files = [...fileList].filter((f) => imageLimits.mediaTypes.includes(f.type));
  if (!files.length) {
    setScanStatus('JPG, PNG 같은 이미지 파일을 올려 주세요.');
    return;
  }
  resetScan();
  scanFiles = files.slice(0, imageLimits.maxCount);
  $('#scan-previews').innerHTML = '';
  for (const f of scanFiles) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    img.alt = f.name || '캡처 이미지';
    $('#scan-previews').append(img);
  }
  setScanStatus(files.length > scanFiles.length
    ? `한 번에 ${imageLimits.maxCount}장까지 읽을 수 있어 앞의 ${scanFiles.length}장만 사용합니다.`
    : `이미지 ${scanFiles.length}장을 준비했습니다. "읽어 오기"를 누르세요.`);
  $('#scan-run').disabled = false;
}

function scanPrompt() {
  const known = state.assets.slice(0, 80).map((a) => `- ${a.name} / ${a.institution || '-'}`).join('\n');
  return `첨부한 이미지는 사용자의 은행·증권·가상자산·연금·대출 앱 화면 캡처입니다.
화면에 보이는 개별 자산과 부채 항목을 모두 찾아 JSON 배열로만 답하세요.

각 원소의 형식:
{"category": 분류 id, "name": 상품명 또는 종목명, "institution": 금융기관 이름(화면에서 알 수 없으면 ""), "value": 현재 평가금액 또는 잔액(원 단위 숫자), "cost": 매입금액 또는 원금(원 단위 숫자, 없으면 0), "memo": 보유 수량 같은 짧은 참고(없으면 "")}

분류 id:
- cash: 입출금·예금·적금·CMA·파킹통장·청약
- stock: 개별 주식
- fund: 펀드·ETF
- crypto: 가상자산
- realestate: 부동산·전월세 보증금
- pension: 연금저축·IRP·퇴직연금·보험
- etc: 기타 자산
- debt: 대출·카드 결제 예정액 등 부채 (value는 남은 금액을 양수로)

규칙:
- "총자산", "합계" 같은 합계 줄은 빼고 개별 항목만 적으세요.
- 외화 자산은 화면에 원화 환산액이 있으면 그 금액을 쓰고, 없으면 value를 0으로 두고 memo에 통화와 금액을 적으세요.
- 숫자에는 쉼표나 단위를 넣지 마세요.
- 잘 안 보여서 확실하지 않은 숫자는 추측하지 말고 그 항목을 빼세요.
- 자산 항목이 없으면 []로 답하세요.
${known ? `\n이미 등록된 항목입니다. 같은 항목이면 이름과 기관을 아래와 똑같이 쓰세요.\n${known}\n` : ''}
예시: [{"category":"stock","name":"삼성전자","institution":"키움증권","value":7120000,"cost":6300000,"memo":"100주"}]`;
}

function scanErrorText(code) {
  switch (code) {
    case 'cancelled': return '중지했습니다.';
    case 'rate_limited': return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    case 'image_rejected': return '이 이미지는 읽을 수 없습니다. JPG나 PNG 캡처로 다시 올려 주세요.';
    case 'invalid_json':
    case 'empty_completion':
    case 'refused': return '화면에서 자산 항목을 찾지 못했습니다. 잔고가 보이는 화면으로 다시 시도해 주세요.';
    case 'session_expired': return 'Claude 로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.';
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
    case 'capability_removed':
    case 'images_unavailable': return '이 화면에서는 Claude가 이미지를 읽을 수 없습니다. 직접 입력해 주세요.';
    default: return '읽어 오지 못했습니다. 다시 시도해 주세요.';
  }
}

async function runScan() {
  if (!askClaude || !scanFiles.length) return;
  scanCtl = new AbortController();
  $('#scan-run').disabled = true;
  $('#scan-stop').hidden = false;
  $('#scan-results').innerHTML = '';
  $('#scan-apply').hidden = true;
  setScanStatus('Claude가 화면을 읽고 있습니다. 보통 30초 안팎 걸려요…');
  try {
    const data = await askClaude.json(scanPrompt(), { images: scanFiles, signal: scanCtl.signal });
    const list = Array.isArray(data) ? data : [];
    scanItems = list
      .filter((x) => x && typeof x === 'object' && String(x.name ?? '').trim())
      .map((x) => {
        const item = {
          category: catById[x.category] ? x.category : 'etc',
          name: String(x.name).trim(),
          institution: String(x.institution ?? '').trim(),
          value: Math.abs(parseNum(x.value)),
          cost: Math.abs(parseNum(x.cost)),
          memo: String(x.memo ?? '').trim(),
        };
        item.match = findMatch(item);
        item.checked = item.value > 0;
        return item;
      });
    if (!scanItems.length) {
      setScanStatus(scanErrorText('empty_completion'));
    } else {
      renderScanItems();
      setScanStatus(`${scanItems.length}개 항목을 찾았습니다. 숫자가 맞는지 확인하고, 저장할 항목만 체크하세요.`);
      $('#scan-run').hidden = true;
      $('#scan-apply').hidden = false;
    }
  } catch (e) {
    setScanStatus(scanErrorText(e?.code));
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'images_unavailable'].includes(e?.code)) {
      askClaude = null;
      $('#scan-btn').hidden = true;
    }
  } finally {
    $('#scan-stop').hidden = true;
    $('#scan-run').disabled = !scanFiles.length;
    scanCtl = null;
  }
}

function renderScanItems() {
  const catOptions = (sel) => CATEGORIES.map((c) =>
    `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.name}</option>`).join('');
  $('#scan-results').innerHTML = scanItems.map((it, i) => `
    <div class="scan-row ${it.checked ? '' : 'off'}" data-i="${i}">
      <input type="checkbox" id="scan-check-${i}" data-f="checked" ${it.checked ? 'checked' : ''} aria-label="저장할 항목으로 선택">
      <select id="scan-cat-${i}" data-f="category" aria-label="분류">${catOptions(it.category)}</select>
      <input id="scan-name-${i}" class="name-input" data-f="name" value="${escapeHtml(it.name)}" aria-label="이름">
      <input id="scan-inst-${i}" class="inst-input" data-f="institution" value="${escapeHtml(it.institution)}" placeholder="기관" aria-label="기관">
      <input id="scan-value-${i}" class="value-input" data-f="value" inputmode="numeric" value="${it.value.toLocaleString('ko-KR')}" aria-label="평가금액(원)">
      <span class="chip ${it.match ? 'update' : ''}">${it.match ? `기존 항목 갱신 · 이전 ${won(it.match.value)}` : '새 항목'}${it.memo ? ` · ${escapeHtml(it.memo)}` : ''}</span>
    </div>`).join('');
}

$('#scan-results').addEventListener('input', (e) => {
  const row = e.target.closest('.scan-row');
  if (!row) return;
  const it = scanItems[Number(row.dataset.i)];
  const f = e.target.dataset.f;
  if (f === 'checked') {
    it.checked = e.target.checked;
    row.classList.toggle('off', !it.checked);
  } else if (f === 'value') {
    const digits = e.target.value.replace(/[^\d]/g, '');
    e.target.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
    it.value = parseNum(digits);
  } else if (f) {
    it[f] = e.target.value.trim();
    if (f === 'name' || f === 'institution') {
      it.match = findMatch(it);
      const chip = row.querySelector('.chip');
      chip.classList.toggle('update', !!it.match);
      chip.textContent = (it.match ? `기존 항목 갱신 · 이전 ${won(it.match.value)}` : '새 항목') + (it.memo ? ` · ${it.memo}` : '');
    }
  }
});

$('#scan-apply').addEventListener('click', () => {
  const picked = scanItems.filter((it) => it.checked && it.name);
  if (!picked.length) {
    setScanStatus('저장할 항목을 하나 이상 체크하세요.');
    return;
  }
  leaveSample();
  let added = 0;
  let updated = 0;
  for (const it of picked) {
    const existing = state.assets.find((a) => a === it.match);
    if (existing) {
      existing.value = it.value;
      if (it.cost > 0) existing.cost = it.cost;
      if (it.memo) existing.memo = it.memo;
      updated += 1;
    } else {
      const { category, name, institution, value, cost, memo } = it;
      state.assets.push({ id: uid(), category, name, institution, value, cost, memo });
      added += 1;
    }
  }
  save();
  render();
  scanDialog.close();
  toast([added && `${added}개 추가`, updated && `${updated}개 갱신`].filter(Boolean).join(', ') + '했습니다.');
});

$('#scan-btn').addEventListener('click', () => {
  resetScan();
  scanDialog.showModal();
});
$('#scan-close').addEventListener('click', () => scanDialog.close());
scanDialog.addEventListener('close', () => scanCtl?.abort());
$('#scan-run').addEventListener('click', runScan);
$('#scan-stop').addEventListener('click', () => scanCtl?.abort());
$('#scan-input').addEventListener('change', (e) => {
  if (e.target.files.length) setScanFiles(e.target.files);
  e.target.value = '';
});

const drop = $('#scan-drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  if (e.dataTransfer?.files.length) setScanFiles(e.dataTransfer.files);
});
document.addEventListener('paste', (e) => {
  if (!scanDialog.open || !imageLimits) return;
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) {
    e.preventDefault();
    setScanFiles(files);
  }
});

// ---------- 금액 숨기기 ----------
function applyHide(hide) {
  document.body.classList.toggle('hide-money', hide);
  $('#toggle-hide').textContent = hide ? '금액 보이기' : '금액 숨기기';
}
$('#toggle-hide').addEventListener('click', () => {
  const hide = !document.body.classList.contains('hide-money');
  try { localStorage.setItem(HIDE_KEY, hide ? '1' : ''); } catch (e) { /* 무시 */ }
  applyHide(hide);
});

// ---------- 초기화 ----------
function init() {
  const options = CATEGORIES.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  $('#category-select').innerHTML = options;
  $('#filter').insertAdjacentHTML('beforeend', options);
  let hide = false;
  try { hide = localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { /* 무시 */ }
  applyHide(hide);
  render();
}

init();
