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
  return { assets: [], history: [] };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    alert('브라우저에 저장하지 못했습니다. 백업 내보내기를 이용해 주세요.');
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
          <div class="row-actions">
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
    if (a && confirm(`"${a.name}" 항목을 삭제할까요?`)) {
      state.assets = state.assets.filter((x) => x.id !== delId);
      save();
      render();
    }
  }
});

$('#filter').addEventListener('change', render);

// ---------- 순자산 기록 ----------
$('#snapshot-btn').addEventListener('click', () => {
  const t = totals();
  const entry = { date: today(), net: t.net, assets: t.assets, debts: t.debts };
  const idx = state.history.findIndex((h) => h.date === entry.date);
  if (idx >= 0) state.history[idx] = entry;
  else state.history.push(entry);
  state.history.sort((a, b) => a.date.localeCompare(b.date));
  save();
  render();
});

// ---------- 백업 ----------
$('#export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `my-assets-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

$('#import-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.assets)) throw new Error('형식 오류');
    if (!confirm('현재 데이터를 백업 파일 내용으로 바꿀까요?')) return;
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
      history: Array.isArray(data.history) ? data.history : [],
    };
    save();
    render();
  } catch (err) {
    alert('백업 파일을 읽지 못했습니다.');
  } finally {
    e.target.value = '';
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
