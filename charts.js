/* ==========================================================================
   Chart engine - dependency-free SVG.
   Charts are declared during render() as lightweight placeholders, then
   measured and drawn in mountCharts() so text stays crisp at any width.
   ========================================================================== */
'use strict';

const CHARTS = new Map();
let chartSeq = 0;

/** Declare a chart. Returns the placeholder HTML to drop into a template. */
function chart(spec) {
  const id = 'c' + (++chartSeq);
  CHARTS.set(id, spec);
  const h = spec.h || 200;
  return `<div class="chartbox" data-chart="${id}" style="min-height:${h}px">
    <div class="tip" data-tip></div></div>`;
}

/** Measure every declared chart and draw it. Safe to call repeatedly. */
function mountCharts() {
  for (const box of $$('[data-chart]')) {
    const spec = CHARTS.get(box.dataset.chart);
    if (!spec) continue;
    const w = Math.max(240, box.clientWidth || 300);
    const tip = box.querySelector('[data-tip]');
    const svg = drawChart(spec, w);
    box.querySelectorAll('svg').forEach(n => n.remove());
    box.insertAdjacentHTML('afterbegin', svg);
    wireHover(box, spec, tip, w);
  }
}

let _rz;
window.addEventListener('resize', () => {
  clearTimeout(_rz);
  _rz = setTimeout(mountCharts, 140);
});

/* ------------------------------------------------------------------- scales */

function niceTicks(min, max, want = 4) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const raw = span / want;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 1e6; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
const axisFmt = v => {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (a >= 1000) return (v / 1000).toFixed(a >= 10000 ? 0 : 1).replace('.0', '') + 'k';
  return String(Math.round(v));
};

/* -------------------------------------------------------------- dispatchers */

function drawChart(spec, w) {
  switch (spec.type) {
    case 'line':  return drawLine(spec, w);
    case 'barh':  return drawBarH(spec, w);
    case 'barv':  return drawBarV(spec, w);
    case 'stack': return drawStack(spec, w);
    case 'spark': return drawSpark(spec, w);
    case 'gauge': return drawGauge(spec, w);
    default: return '';
  }
}

/* --------------------------------------------------------------- line chart */
/* Multi-series time chart. One y-axis always - never a second scale. */

function drawLine(spec, w) {
  const h = spec.h || 220;
  const padT = 14, padB = 26, padL = 42, padR = spec.direct ? 56 : 12;
  const iw = w - padL - padR, ih = h - padT - padB;
  const xs = spec.x, n = xs.length;
  const all = spec.series.flatMap(s => s.values.filter(v => v != null));
  const lo = Math.min(0, ...all), hi = Math.max(...all, 1);
  const ticks = niceTicks(lo, hi, 4);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const X = i => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const Y = v => padT + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;

  let g = '';
  for (const t of ticks) {
    g += `<line class="gridline" x1="${padL}" x2="${padL + iw}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/>
          <text class="tick" x="${padL - 7}" y="${(Y(t) + 3.5).toFixed(1)}" text-anchor="end">${axisFmt(t)}</text>`;
  }
  // x labels: thin out so they never collide
  const every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 52))));
  for (let i = 0; i < n; i++) {
    if (i % every && i !== n - 1) continue;
    g += `<text class="tick" x="${X(i).toFixed(1)}" y="${h - 8}" text-anchor="middle">${esc(xs[i])}</text>`;
  }

  let paths = '', ends = '';
  spec.series.forEach(s => {
    const pts = s.values.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
    if (!pts.length) return;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    if (s.area) {
      paths += `<path d="${d} L ${pts[pts.length - 1][0].toFixed(1)} ${Y(yMin).toFixed(1)} L ${pts[0][0].toFixed(1)} ${Y(yMin).toFixed(1)} Z"
                 fill="${s.color}" opacity=".10"/>`;
    }
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"
               stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="5 4"' : ''}/>`;
    const last = pts[pts.length - 1];
    ends += `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5" fill="${s.color}"
              stroke="var(--surface)" stroke-width="2"/>`;
    if (spec.direct) {
      ends += `<text class="dlabel" x="${(last[0] + 9).toFixed(1)}" y="${(last[1] + 4).toFixed(1)}">${esc(s.endLabel || axisFmt(s.values[s.values.length - 1]))}</text>`;
    }
  });

  const zero = (yMin < 0 && yMax > 0)
    ? `<line class="baseline" x1="${padL}" x2="${padL + iw}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>` : '';

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"
            aria-label="${esc(spec.aria || 'line chart')}">
    ${g}${zero}${paths}${ends}
    <line data-cross class="baseline" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" opacity="0"/>
    <g data-dots></g>
    <rect class="hit" data-hit x="${padL}" y="${padT}" width="${iw}" height="${ih}"/>
  </svg>`;
}

/* --------------------------------------------------- horizontal ranked bars */
/* One series -> one colour. Value labelled at the tip; never inside the bar. */

function drawBarH(spec, w) {
  const items = spec.items;
  if (!items.length) return `<div class="sub" style="padding:20px 0">No data for this period.</div>`;
  const rowH = spec.rowH || 30, barH = Math.min(18, rowH - 12);
  const h = items.length * rowH + 6;
  const labelW = Math.min(172, Math.max(88, Math.round(w * 0.34)));
  const valW = 74;
  const iw = Math.max(20, w - labelW - valW - 8);
  const max = Math.max(...items.map(i => Math.abs(i.value)), 1);
  const fmt = spec.fmt || (v => money(v));

  let out = '';
  items.forEach((it, i) => {
    const y = i * rowH + 4;
    const bw = Math.max(2, (Math.abs(it.value) / max) * iw);
    const c = it.color || 'var(--s1)';
    out += `<text class="dlabel-2" x="0" y="${y + barH / 2 + 4}" >${esc(clip(it.label, labelW))}</text>`;
    out += `<g data-i="${i}" style="cursor:default">
      <rect x="${labelW}" y="${y}" width="${bw.toFixed(1)}" height="${barH}" rx="4" fill="${c}"/>
      <rect x="${labelW}" y="${y}" width="${Math.min(bw, 4).toFixed(1)}" height="${barH}" fill="${c}"/>
      <rect class="hit" x="0" y="${y - 5}" width="${w}" height="${rowH}"/>
    </g>`;
    out += `<text class="dlabel" x="${w}" y="${y + barH / 2 + 4}" text-anchor="end">${esc(fmt(it.value))}</text>`;
    if (it.sub) out += `<text class="tick" x="${labelW + bw + 7}" y="${y + barH / 2 + 4}">${esc(it.sub)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"
    aria-label="${esc(spec.aria || 'ranked bar chart')}">${out}</svg>`;
}
function clip(s, px) {
  const max = Math.floor(px / 6.4);
  s = String(s);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/* ---------------------------------------------------- vertical / diverging  */

function drawBarV(spec, w) {
  const h = spec.h || 190, padT = 14, padB = 24, padL = 42, padR = 8;
  const items = spec.items, n = items.length;
  const iw = w - padL - padR, ih = h - padT - padB;
  const vals = items.map(i => i.value);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals, 1), 4);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const Y = v => padT + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
  const band = iw / n;
  const bw = Math.min(24, band - 6);

  let g = '';
  for (const t of ticks) {
    g += `<line class="gridline" x1="${padL}" x2="${padL + iw}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/>
          <text class="tick" x="${padL - 7}" y="${(Y(t) + 3.5).toFixed(1)}" text-anchor="end">${axisFmt(t)}</text>`;
  }
  const y0 = Y(0);
  g += `<line class="baseline" x1="${padL}" x2="${padL + iw}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}"/>`;

  let bars = '';
  items.forEach((it, i) => {
    const cx = padL + band * i + band / 2;
    const x = cx - bw / 2;
    const yv = Y(it.value);
    const top = Math.min(yv, y0), hgt = Math.max(1.5, Math.abs(yv - y0));
    const pos = it.value >= 0;
    const c = it.color || (pos ? 'var(--s1)' : 'var(--s8)');
    // rounded at the data end, square at the baseline
    bars += `<g data-i="${i}">
      <path d="${roundedEnd(x, top, bw, hgt, pos)}" fill="${c}"/>
      <rect class="hit" x="${(cx - band / 2).toFixed(1)}" y="${padT}" width="${band.toFixed(1)}" height="${ih}"/>
    </g>`;
    const every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 46))));
    if (i % every === 0 || i === n - 1)
      bars += `<text class="tick" x="${cx.toFixed(1)}" y="${h - 7}" text-anchor="middle">${esc(it.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"
    aria-label="${esc(spec.aria || 'column chart')}">${g}${bars}</svg>`;
}
/** Bar path with a 4px rounded data-end and a square baseline end. */
function roundedEnd(x, y, w, h, up) {
  const r = Math.min(4, w / 2, h);
  return up
    ? `M${x} ${y + h} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h} Z`
    : `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} Z`;
}

/* ------------------------------------------------- stacked composition bar  */
/* 2px surface gaps do the separating - never a stroke around a segment.      */

function drawStack(spec, w) {
  const h = spec.h || 54, barH = 26, gap = 2;
  const segs = spec.segs.filter(s => s.value > 0);
  const tot = sum(segs.map(s => s.value)) || 1;
  const avail = w - gap * Math.max(0, segs.length - 1);
  let x = 0, out = '';
  segs.forEach((s, i) => {
    const sw = (s.value / tot) * avail;
    const r = 4;
    out += `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(1, sw).toFixed(1)}" height="${barH}"
             rx="${sw > 10 ? r : 1}" fill="${s.color}"/>`;
    // label inside only when it comfortably fits, otherwise it lives in the legend
    const txt = Math.round((s.value / tot) * 100) + '%';
    if (sw > 42) out += `<text x="${(x + sw / 2).toFixed(1)}" y="${barH / 2 + 4}" text-anchor="middle"
        style="font-size:11px;font-weight:640;fill:#fff">${txt}</text>`;
    x += sw + gap;
  });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"
    aria-label="${esc(spec.aria || 'composition bar')}">${out}</svg>`;
}

/* ------------------------------------------------------------- sparkline    */

function drawSpark(spec, w) {
  const h = spec.h || 34, v = spec.values;
  if (v.length < 2) return `<svg class="chart" height="${h}"></svg>`;
  const lo = Math.min(...v), hi = Math.max(...v);
  const X = i => (i / (v.length - 1)) * (w - 6) + 3;
  const Y = n => h - 4 - ((n - lo) / ((hi - lo) || 1)) * (h - 8);
  const d = v.map((n, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(n).toFixed(1)).join(' ');
  const c = spec.color || 'var(--s1)';
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <path d="${d} L${X(v.length - 1).toFixed(1)} ${h} L${X(0).toFixed(1)} ${h} Z" fill="${c}" opacity=".10"/>
    <path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(v.length - 1).toFixed(1)}" cy="${Y(v[v.length - 1]).toFixed(1)}" r="3.2"
      fill="${c}" stroke="var(--surface)" stroke-width="2"/>
  </svg>`;
}

/* ------------------------------------------------------- score gauge (meter) */

function drawGauge(spec, w) {
  const size = Math.min(w, 150), r = size / 2 - 9, cx = size / 2, cy = size / 2;
  const val = clamp(spec.value, 0, 100);
  const C = 2 * Math.PI * r;
  const col = spec.color || (val >= 75 ? 'var(--good)' : val >= 50 ? 'var(--warn)' : val >= 30 ? 'var(--serious)' : 'var(--crit)');
  return `<svg class="chart" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"
      aria-label="Financial health score ${Math.round(val)} out of 100">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="10"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${(C * val / 100).toFixed(1)} ${C.toFixed(1)}"
      transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy + 2}" text-anchor="middle"
      style="font-size:${spec.display && String(spec.display).length > 3 ? 26 : 30}px;font-weight:640;fill:var(--ink)"
      >${esc(spec.display != null ? spec.display : Math.round(val))}</text>
    <text x="${cx}" y="${cy + 20}" text-anchor="middle"
      style="font-size:10.5px;fill:var(--muted)">${esc(spec.sub != null ? spec.sub : 'out of 100')}</text>
  </svg>`;
}

/* ------------------------------------------------------------------- hover  */
/* Tooltips enhance; every value is also in a table view or a direct label.    */

function wireHover(box, spec, tip, w) {
  const svg = box.querySelector('svg');
  if (!svg || !tip) return;

  if (spec.type === 'line') {
    const hit = svg.querySelector('[data-hit]');
    const cross = svg.querySelector('[data-cross]');
    const dots = svg.querySelector('[data-dots]');
    if (!hit) return;
    const padL = 42, padR = spec.direct ? 56 : 12;
    const iw = w - padL - padR, n = spec.x.length;
    const h = spec.h || 220, padT = 14, padB = 26, ih = h - padT - padB;
    const all = spec.series.flatMap(s => s.values.filter(v => v != null));
    const ticks = niceTicks(Math.min(0, ...all), Math.max(...all, 1), 4);
    const yMin = ticks[0], yMax = ticks[ticks.length - 1];
    const Y = v => padT + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
    const X = i => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);

    const move = ev => {
      const r = svg.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const sx = px * (w / r.width);
      const i = clamp(Math.round(((sx - padL) / (iw || 1)) * (n - 1)), 0, n - 1);
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i));
      cross.setAttribute('opacity', '.5');
      dots.innerHTML = spec.series.map(s => s.values[i] == null ? '' :
        `<circle cx="${X(i).toFixed(1)}" cy="${Y(s.values[i]).toFixed(1)}" r="4.5" fill="${s.color}"
          stroke="var(--surface)" stroke-width="2"/>`).join('');
      tip.innerHTML = `<div class="t">${esc(spec.tipTitle ? spec.tipTitle(i) : spec.x[i])}</div>` +
        spec.series.map(s => s.values[i] == null ? '' :
          `<div class="r"><span>${esc(s.name)}</span><b>${esc((spec.fmt || money)(s.values[i]))}</b></div>`).join('');
      tip.classList.add('on');
      tip.style.left = (X(i) / w * 100) + '%';
      tip.style.top = (Y(Math.max(...spec.series.map(s => s.values[i] || 0))) * (r.height / h)) + 'px';
    };
    const leave = () => { tip.classList.remove('on'); cross.setAttribute('opacity', '0'); dots.innerHTML = ''; };
    hit.addEventListener('mousemove', move);
    hit.addEventListener('touchmove', move, { passive: true });
    hit.addEventListener('mouseleave', leave);
    hit.addEventListener('touchend', leave);
  }

  if (spec.type === 'barh' || spec.type === 'barv') {
    const fmt = spec.fmt || money;
    svg.querySelectorAll('[data-i]').forEach(g => {
      const it = spec.items[+g.dataset.i];
      g.addEventListener('mousemove', ev => {
        const r = svg.getBoundingClientRect();
        tip.innerHTML = `<div class="t">${esc(it.label)}</div>
          <div class="r"><span>${esc(spec.tipLabel || 'Amount')}</span><b>${esc(fmt(it.value))}</b></div>` +
          (it.tip ? `<div class="r"><span>${esc(it.tip[0])}</span><b>${esc(it.tip[1])}</b></div>` : '');
        tip.classList.add('on');
        tip.style.left = (ev.clientX - r.left) + 'px';
        tip.style.top = (ev.clientY - r.top - 6) + 'px';
      });
      g.addEventListener('mouseleave', () => tip.classList.remove('on'));
    });
  }
}

/** Legend markup - always present when a chart carries two or more series. */
function legend(items, kind = 'sw') {
  return `<div class="legend">` + items.map(i =>
    `<span class="li"><span class="${kind}" style="background:${i.color}"></span>${esc(i.name)}</span>`
  ).join('') + `</div>`;
}
