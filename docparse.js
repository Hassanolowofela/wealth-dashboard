/* ==========================================================================
   Document text extraction: PDF, DOCX and legacy DOC.

   Everything here runs in the browser with no libraries. PDF FlateDecode is
   zlib, and a DOCX is a ZIP of raw-deflate entries, both of which the browser
   can already decompress natively via DecompressionStream. That is what makes
   this possible without shipping a megabyte of parser.

   The goal is honest text extraction. Where a file cannot be read (a scan with
   no text layer, a password-protected PDF, an old binary .doc), this reports
   why instead of returning plausible-looking nonsense.
   ========================================================================== */
'use strict';

/* ------------------------------------------------------------------ helpers */

/** Byte-preserving string, so ASCII pattern scanning works on binary data. */
function latin1(bytes, from, to) {
  const a = from || 0, b = to === undefined ? bytes.length : to;
  let out = '';
  const CH = 8192;
  for (let i = a; i < b; i += CH) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CH, b)));
  }
  return out;
}

function bytesFromLatin1(s) {
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff;
  return u;
}

/** Native inflate. `raw` selects ZIP-style raw deflate over zlib-wrapped. */
async function inflate(bytes, raw) {
  const fmt = raw ? 'deflate-raw' : 'deflate';
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(fmt));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function decompressionSupported() {
  return typeof DecompressionStream !== 'undefined';
}

/* ============================================================== PDF ======= */

/** Every `N G obj` position in the file, so references can be resolved. */
function pdfIndexObjects(s) {
  const idx = {};
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) idx[+m[1]] = m.index + m[0].length;
  return idx;
}

/** The dictionary text of an object, plus its stream bounds if it has one. */
function pdfObjectAt(s, start) {
  if (start == null) return null;
  const endObj = s.indexOf('endobj', start);
  const stop = endObj < 0 ? s.length : endObj;
  const sm = s.indexOf('stream', start);
  let dictEnd = (sm >= 0 && sm < stop) ? sm : stop;
  const dict = s.slice(start, dictEnd);
  let data = null;
  if (sm >= 0 && sm < stop) {
    let p = sm + 6;
    if (s[p] === '\r') p++;
    if (s[p] === '\n') p++;
    let e = s.indexOf('endstream', p);
    if (e < 0) e = stop;
    // trim the EOL that precedes endstream
    let end = e;
    if (s[end - 1] === '\n') end--;
    if (s[end - 1] === '\r') end--;
    data = [p, end];
  }
  return { dict, data };
}

const pdfRef = (dict, key) => {
  const m = new RegExp('\\/' + key + '\\s+(\\d+)\\s+\\d+\\s+R').exec(dict);
  return m ? +m[1] : null;
};

/** Filters can be chained, e.g. /Filter [ /ASCII85Decode /FlateDecode ]. */
function parseFilters(dict) {
  const m = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(dict);
  if (!m) return [];
  return (m[1].match(/\/([A-Za-z0-9]+)/g) || []).map(x => x.slice(1));
}

/** ASCII85, the text-safe wrapper some writers put around compressed data. */
function ascii85Decode(bytes) {
  const out = [];
  let tuple = 0, count = 0;
  let i = 0;
  // optional <~ prefix
  if (bytes.length > 1 && bytes[0] === 0x3c && bytes[1] === 0x7e) i = 2;
  for (; i < bytes.length; i++) {
    const c = bytes[i];
    if (c === 0x7e) break;                       // ~> terminator
    if (c <= 0x20 || c === 0x0a || c === 0x0d) continue;
    if (c === 0x7a && count === 0) { out.push(0, 0, 0, 0); continue; }   // 'z'
    if (c < 0x21 || c > 0x75) continue;
    tuple = tuple * 85 + (c - 0x21);
    if (++count === 5) {
      out.push((tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255, tuple & 255);
      tuple = 0; count = 0;
    }
  }
  if (count > 0) {
    for (let k = count; k < 5; k++) tuple = tuple * 85 + 84;
    const full = [(tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255, tuple & 255];
    for (let k = 0; k < count - 1; k++) out.push(full[k]);
  }
  return new Uint8Array(out);
}

function asciiHexDecode(bytes) {
  const hex = latin1(bytes).replace(/[^0-9A-Fa-f]/g, '');
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

/** LZW as PDFs use it. Uncommon now, but old bank exports still contain it. */
function lzwDecode(bytes) {
  const out = [];
  let dict = [], bitBuf = 0, bitCount = 0, codeLen = 9, prev = null;
  const reset = () => {
    dict = [];
    for (let i = 0; i < 256; i++) dict[i] = [i];
    dict.length = 258;
    codeLen = 9; prev = null;
  };
  reset();
  for (let i = 0; i < bytes.length; i++) {
    bitBuf = (bitBuf << 8) | bytes[i];
    bitCount += 8;
    while (bitCount >= codeLen) {
      const code = (bitBuf >> (bitCount - codeLen)) & ((1 << codeLen) - 1);
      bitCount -= codeLen;
      if (code === 256) { reset(); continue; }
      if (code === 257) { bitCount = 0; i = bytes.length; break; }
      let entry;
      if (code < dict.length && dict[code]) entry = dict[code];
      else if (prev) entry = prev.concat(prev[0]);
      else return new Uint8Array(out);
      out.push.apply(out, entry);
      if (prev) dict.push(prev.concat(entry[0]));
      prev = entry;
      if (dict.length + 1 >= (1 << codeLen) && codeLen < 12) codeLen++;
    }
  }
  return new Uint8Array(out);
}

/** Decoded bytes of an object's stream, applying each filter in order. */
async function pdfStreamBytes(s, bytes, obj) {
  if (!obj || !obj.data) return null;
  let data = bytes.subarray(obj.data[0], obj.data[1]);
  for (const f of parseFilters(obj.dict)) {
    try {
      if (f === 'FlateDecode' || f === 'Fl') {
        try { data = await inflate(data, false); }
        catch (e) { data = await inflate(data.subarray(1), true); }
      } else if (f === 'ASCII85Decode' || f === 'A85') data = ascii85Decode(data);
      else if (f === 'ASCIIHexDecode' || f === 'AHx') data = asciiHexDecode(data);
      else if (f === 'LZWDecode' || f === 'LZW') data = lzwDecode(data);
      else if (f === 'RunLengthDecode' || f === 'RL') return null;
      else return null;                       // image codecs: nothing to read
    } catch (e) { return null; }
    if (!data || !data.length) return null;
  }
  return data;
}

/**
 * Parses a /ToUnicode CMap into a code -> string map. This is what turns
 * font-internal glyph codes back into readable characters.
 */
function parseCMap(text) {
  const map = new Map();
  const hex = h => {
    let out = '';
    for (let i = 0; i + 3 < h.length + 1; i += 4) {
      const cp = parseInt(h.substr(i, 4), 16);
      if (!isNaN(cp)) out += String.fromCharCode(cp);
    }
    return out;
  };
  let m;
  const charRe = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((m = charRe.exec(text))) {
    const pairs = m[1].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || [];
    for (const p of pairs) {
      const q = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(p);
      map.set(parseInt(q[1], 16), hex(q[2]));
    }
  }
  const rangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = rangeRe.exec(text))) {
    const body = m[1];
    // <lo> <hi> <dst>
    const simple = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let r;
    while ((r = simple.exec(body))) {
      const lo = parseInt(r[1], 16), hi = parseInt(r[2], 16), dst = parseInt(r[3], 16);
      if (hi - lo > 65535) continue;
      for (let c = lo; c <= hi; c++) map.set(c, String.fromCharCode(dst + (c - lo)));
    }
    // <lo> <hi> [ <d1> <d2> ... ]
    const arr = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g;
    while ((r = arr.exec(body))) {
      const lo = parseInt(r[1], 16);
      const items = r[3].match(/<([0-9A-Fa-f]+)>/g) || [];
      items.forEach((it, i) => map.set(lo + i, hex(it.replace(/[<>]/g, ''))));
    }
  }
  return map;
}

/** Splits a PDF content stream into tokens we care about. */
function pdfTokens(src) {
  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '%') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '(') {
      let depth = 1, j = i + 1, out = '';
      while (j < n && depth > 0) {
        const ch = src[j];
        if (ch === '\\') {
          const nx = src[j + 1];
          const oct = /[0-7]/.test(nx) ? src.substr(j + 1, 3).match(/^[0-7]{1,3}/) : null;
          if (oct) { out += String.fromCharCode(parseInt(oct[0], 8)); j += 1 + oct[0].length; continue; }
          const esc = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[nx];
          if (esc !== undefined) { out += esc; j += 2; continue; }
          if (nx === '\n') { j += 2; continue; }
          j += 2; continue;
        }
        if (ch === '(') { depth++; out += ch; j++; continue; }
        if (ch === ')') { depth--; if (depth > 0) out += ch; j++; continue; }
        out += ch; j++;
      }
      toks.push({ t: 'str', v: out }); i = j; continue;
    }
    if (c === '<' && src[i + 1] !== '<') {
      const e = src.indexOf('>', i);
      const h = src.slice(i + 1, e < 0 ? n : e).replace(/[^0-9A-Fa-f]/g, '');
      let out = '';
      for (let k = 0; k + 1 < h.length; k += 2) out += String.fromCharCode(parseInt(h.substr(k, 2), 16));
      if (h.length % 2) out += String.fromCharCode(parseInt(h[h.length - 1] + '0', 16));
      toks.push({ t: 'str', v: out }); i = (e < 0 ? n : e + 1); continue;
    }
    if (c === '<' && src[i + 1] === '<') { toks.push({ t: 'op', v: '<<' }); i += 2; continue; }
    if (c === '>' && src[i + 1] === '>') { toks.push({ t: 'op', v: '>>' }); i += 2; continue; }
    if (c === '[') { toks.push({ t: 'op', v: '[' }); i++; continue; }
    if (c === ']') { toks.push({ t: 'op', v: ']' }); i++; continue; }
    if (c === '/') {
      let j = i + 1;
      while (j < n && !/[\s\/\[\]<>()]/.test(src[j])) j++;
      toks.push({ t: 'name', v: src.slice(i + 1, j) }); i = j; continue;
    }
    if (/[-+.\d]/.test(c)) {
      let j = i;
      while (j < n && /[-+.\d]/.test(src[j])) j++;
      const num = parseFloat(src.slice(i, j));
      toks.push({ t: 'num', v: isNaN(num) ? 0 : num }); i = j; continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    let j = i;
    while (j < n && !/[\s\/\[\]<>()%]/.test(src[j])) j++;
    if (j === i) j++;
    toks.push({ t: 'op', v: src.slice(i, j) }); i = j;
  }
  return toks;
}

/**
 * Walks a content stream and returns positioned text fragments. Position is
 * what lets rows and columns be reassembled, which a bank statement needs.
 */
function pdfTextItems(content, fonts) {
  const toks = pdfTokens(content);
  const items = [];
  let tm = [1, 0, 0, 1, 0, 0], tlm = tm.slice();
  let leading = 0, font = null, fsize = 10;
  const stack = [];

  const setTm = v => { tm = v.slice(); tlm = v.slice(); };
  const nextLine = (tx, ty) => {
    tlm = [tlm[0], tlm[1], tlm[2], tlm[3], tlm[0] * tx + tlm[2] * ty + tlm[4],
           tlm[1] * tx + tlm[3] * ty + tlm[5]];
    tm = tlm.slice();
  };
  const decode = raw => {
    if (!font) return raw;
    if (font.two) {
      let out = '';
      for (let i = 0; i + 1 < raw.length; i += 2) {
        const code = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
        out += font.map && font.map.has(code) ? font.map.get(code) : '';
      }
      return out;
    }
    if (font.map && font.map.size) {
      let out = '';
      for (let i = 0; i < raw.length; i++) {
        const c = raw.charCodeAt(i);
        out += font.map.has(c) ? font.map.get(c) : raw[i];
      }
      return out;
    }
    return raw;
  };
  const show = txt => {
    if (!txt) return;
    items.push({ x: tm[4], y: tm[5], size: Math.abs(tm[3] || fsize), text: txt });
    // advance roughly, so consecutive shows on one line do not stack
    tm[4] += txt.length * Math.abs(tm[0] || 1) * fsize * 0.5;
  };

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t !== 'op') { stack.push(t); continue; }
    const nums = () => stack.filter(x => x.t === 'num').map(x => x.v);
    switch (t.v) {
      case 'Tf': {
        const nm = stack.filter(x => x.t === 'name').pop();
        const sz = nums().pop();
        if (nm && fonts) font = fonts[nm.v] || null;
        if (sz) fsize = sz;
        break;
      }
      case 'Tm': { const a = nums(); if (a.length >= 6) setTm(a.slice(-6)); break; }
      case 'Td': { const a = nums(); if (a.length >= 2) nextLine(a[a.length - 2], a[a.length - 1]); break; }
      case 'TD': { const a = nums(); if (a.length >= 2) { leading = -a[a.length - 1]; nextLine(a[a.length - 2], a[a.length - 1]); } break; }
      case 'TL': { const a = nums(); if (a.length) leading = a[a.length - 1]; break; }
      case 'T*': nextLine(0, -leading); break;
      case 'BT': setTm([1, 0, 0, 1, 0, 0]); break;
      case 'Tj': { const s = stack.filter(x => x.t === 'str').pop(); if (s) show(decode(s.v)); break; }
      case "'": { nextLine(0, -leading); const s = stack.filter(x => x.t === 'str').pop(); if (s) show(decode(s.v)); break; }
      case '"': { nextLine(0, -leading); const s = stack.filter(x => x.t === 'str').pop(); if (s) show(decode(s.v)); break; }
      case 'TJ': {
        let out = '';
        for (const it of stack) {
          if (it.t === 'str') out += decode(it.v);
          // a large negative kern is how PDFs draw a space
          else if (it.t === 'num' && it.v < -120) out += ' ';
        }
        show(out);
        break;
      }
      default: break;
    }
    stack.length = 0;
  }
  return items;
}

/** Groups positioned fragments back into visual lines. */
function itemsToLines(items) {
  if (!items.length) return '';
  const rows = [];
  for (const it of items) {
    if (!it.text || !it.text.trim()) continue;
    const tol = Math.max(2, (it.size || 10) * 0.4);
    let row = rows.find(r => Math.abs(r.y - it.y) <= tol);
    if (!row) { row = { y: it.y, items: [] }; rows.push(row); }
    row.items.push(it);
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map(r => {
    r.items.sort((a, b) => a.x - b.x);
    let line = '', prevEnd = null;
    for (const it of r.items) {
      if (prevEnd !== null && it.x - prevEnd > (it.size || 10) * 0.28 && !/\s$/.test(line)) line += '  ';
      line += it.text;
      prevEnd = it.x + it.text.length * (it.size || 10) * 0.5;
    }
    return line.replace(/\s+$/, '');
  }).join('\n');
}

/** Reads a text-based PDF. Returns text plus why it failed, if it did. */
async function readPdf(buf) {
  const bytes = new Uint8Array(buf);
  const s = latin1(bytes);
  const warnings = [];

  if (/\/Encrypt\b/.test(s)) {
    return { text: '', pages: 0, warnings: ['encrypted'],
      error: 'This PDF is password protected or encrypted, so its text cannot be read. ' +
             'Open it in your PDF reader, print it to a new PDF without the password, then import that.' };
  }

  const idx = pdfIndexObjects(s);
  const objAt = n => pdfObjectAt(s, idx[n]);

  // ---- fonts: map resource names to their ToUnicode maps, per page
  const fontCache = new Map();
  async function loadFont(num) {
    if (fontCache.has(num)) return fontCache.get(num);
    const o = objAt(num);
    let f = { two: false, map: null };
    if (o) {
      f.two = /\/Subtype\s*\/Type0/.test(o.dict) || /Identity-[HV]/.test(o.dict);
      const tu = pdfRef(o.dict, 'ToUnicode');
      if (tu != null) {
        const b = await pdfStreamBytes(s, bytes, objAt(tu));
        if (b) f.map = parseCMap(latin1(b));
      }
    }
    fontCache.set(num, f);
    return f;
  }
  async function fontsFor(resDict) {
    const out = {};
    if (!resDict) return out;
    const fm = /\/Font\s*<<([\s\S]*?)>>/.exec(resDict);
    let body = fm ? fm[1] : null;
    if (!body) {
      const ref = pdfRef(resDict, 'Font');
      if (ref != null) { const fo = objAt(ref); if (fo) body = fo.dict; }
    }
    if (!body) return out;
    const re = /\/([^\s\/]+)\s+(\d+)\s+\d+\s+R/g;
    let m;
    while ((m = re.exec(body))) out[m[1]] = await loadFont(+m[2]);
    return out;
  }

  // ---- pages, in document order
  const pageStarts = [];
  const pre = /\/Type\s*\/Page[^s]/g;
  let pm;
  while ((pm = pre.exec(s))) {
    const objStart = s.lastIndexOf(' obj', pm.index);
    if (objStart < 0) continue;
    pageStarts.push(objStart + 4);
  }

  const chunks = [];
  for (const start of pageStarts) {
    const o = pdfObjectAt(s, start);
    if (!o) continue;
    let res = null;
    const rm = /\/Resources\s*<<([\s\S]*?)>>\s*(?:\/|>>)/.exec(o.dict);
    if (rm) res = rm[0];
    else {
      const rr = pdfRef(o.dict, 'Resources');
      if (rr != null) { const ro = objAt(rr); if (ro) res = ro.dict; }
    }
    const fonts = await fontsFor(res);

    // /Contents may be one reference or an array of them
    let refs = [];
    const cr = pdfRef(o.dict, 'Contents');
    if (cr != null) refs = [cr];
    else {
      const am = /\/Contents\s*\[([^\]]*)\]/.exec(o.dict);
      if (am) refs = (am[1].match(/(\d+)\s+\d+\s+R/g) || []).map(x => parseInt(x, 10));
    }
    let content = '';
    for (const r of refs) {
      const b = await pdfStreamBytes(s, bytes, objAt(r));
      if (b) content += latin1(b) + '\n';
    }
    if (content) chunks.push(itemsToLines(pdfTextItems(content, fonts)));
  }

  // ---- fallback: no /Type /Page found, so decode every stream we can
  if (!chunks.length) {
    const seen = new Set();
    for (const num of Object.keys(idx)) {
      const o = objAt(+num);
      if (!o || !o.data) continue;
      if (/\/Subtype\s*\/Image|\/Type\s*\/XObject/.test(o.dict) && !/\/Type\s*\/Page/.test(o.dict)) continue;
      const b = await pdfStreamBytes(s, bytes, o);
      if (!b) continue;
      const txt = latin1(b);
      if (!/BT[\s\S]*?ET|\bTJ\b|\bTj\b/.test(txt)) continue;
      const line = itemsToLines(pdfTextItems(txt, {}));
      if (line && !seen.has(line)) { seen.add(line); chunks.push(line); }
    }
    if (chunks.length) warnings.push('fallback');
  }

  // drop control bytes some PDF producers leave in the stream
  const text = chunks.join('\n\n')
    .split('').filter(c => c === '\n' || c === '\t' || c.charCodeAt(0) >= 32).join('');
  const printable = text.replace(/[^\x20-\x7e]/g, '').length;
  const pages = Math.max(pageStarts.length, chunks.length);

  if (!text.trim()) {
    return { text: '', pages, warnings,
      error: 'No text layer was found in this PDF. It is most likely a scan or a photo of a ' +
             'statement, which is an image rather than text. Download the statement again ' +
             'choosing CSV, or a PDF that you can select text in.' };
  }
  if (printable < text.length * 0.55) {
    return { text, pages, warnings,
      error: 'This PDF uses an embedded font this reader cannot map back to readable characters. ' +
             'Try downloading the statement as CSV instead.' };
  }
  return { text, pages, warnings, error: null };
}

/* ============================================================= DOCX ======= */

/** Minimal ZIP reader: locates an entry by name and inflates it. */
async function zipEntry(bytes, wanted) {
  const s = latin1(bytes);
  // End of Central Directory, searched from the tail
  let eocd = s.lastIndexOf('PK\x05\x06');
  if (eocd < 0) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);

  for (let i = 0; i < count; i++) {
    if (s.substr(off, 4) !== 'PK\x01\x02') break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const cmtLen = dv.getUint16(off + 32, true);
    const local = dv.getUint32(off + 42, true);
    const name = s.substr(off + 46, nameLen);
    if (name === wanted) {
      const lNameLen = dv.getUint16(local + 26, true);
      const lExtraLen = dv.getUint16(local + 28, true);
      const dataStart = local + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(dataStart, dataStart + compSize);
      if (method === 0) return raw;
      if (method === 8) return await inflate(raw, true);
      return null;
    }
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return null;
}

function xmlEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x([0-9A-Fa-f]+);/g, (x, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (x, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&');
}

/** All the text inside one fragment, with runs joined and tabs preserved. */
function docxRunText(frag) {
  const parts = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(frag))) parts.push(m[1] !== undefined ? xmlEntities(m[1]) : ' ');
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/**
 * Turns WordprocessingML into plain lines. Table rows have to be handled
 * first and whole: every cell contains its own paragraph, so treating
 * paragraph ends as line breaks would put each cell on a separate line and
 * destroy the row structure a statement depends on.
 */
function docxXmlToText(xml) {
  // sentinels that cannot occur in document text, so later passes cannot eat them
  const NL = String.fromCharCode(1), TAB = String.fromCharCode(2);
  let s = xml;

  s = s.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, tr => {
    const cells = (tr.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || []).map(docxRunText);
    return NL + cells.join(TAB) + NL;
  });
  s = s.replace(/<w:p\b(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, p =>
    NL + docxRunText(p.replace(/<w:br\b[^>]*\/>/g, '</w:t>' + NL + '<w:t>')) + NL);
  s = s.replace(/<[^>]+>/g, '');

  const lines = s.split(NL).map(l => l.split(TAB).join('\t').replace(/[ \t]+$/, ''));
  const out = [];
  for (const l of lines) {
    const t = l.replace(/^\s+/, '');
    if (!t.trim() && (!out.length || !out[out.length - 1].trim())) continue;
    out.push(t);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function readDocx(buf) {
  const bytes = new Uint8Array(buf);
  const doc = await zipEntry(bytes, 'word/document.xml');
  if (!doc) {
    return { text: '', warnings: [],
      error: 'This does not look like a Word .docx file. If it is an older .doc, open it in Word ' +
             'and use Save As to make a .docx, then try again.' };
  }
  const xml = new TextDecoder('utf-8').decode(doc);
  const text = docxXmlToText(xml);
  if (!text.trim()) {
    return { text: '', warnings: [], error: 'This Word file has no readable text in it.' };
  }
  return { text, warnings: [], error: null };
}

/* ============================================================== DOC ======= */

/**
 * Legacy binary .doc. A full reader means implementing the OLE compound file
 * format and Word's piece table, which is out of proportion here. This pulls
 * readable runs out of the raw bytes instead: usually enough to find dates and
 * amounts, sometimes messy. The UI says as much rather than pretending.
 */
async function readDoc(buf) {
  const bytes = new Uint8Array(buf);
  const head = latin1(bytes, 0, 8);
  if (head !== '\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1') {
    return { text: '', warnings: [],
      error: 'This does not look like a Word .doc file.' };
  }
  const runs = [];
  // UTF-16LE runs (how modern Word stores text inside .doc)
  let cur = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const c = bytes[i] | (bytes[i + 1] << 8);
    if ((c >= 32 && c < 127) || c === 9) cur += String.fromCharCode(c);
    else if (c === 13 || c === 10) { cur += '\n'; }
    else { if (cur.replace(/\s/g, '').length >= 6) runs.push(cur); cur = ''; }
  }
  if (cur.replace(/\s/g, '').length >= 6) runs.push(cur);
  // single-byte runs, for older documents
  cur = '';
  const single = [];
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if ((c >= 32 && c < 127) || c === 9) cur += String.fromCharCode(c);
    else if (c === 13 || c === 10) cur += '\n';
    else { if (cur.replace(/\s/g, '').length >= 12) single.push(cur); cur = ''; }
  }
  if (cur.replace(/\s/g, '').length >= 12) single.push(cur);

  const pick = runs.join('\n').length > single.join('\n').length / 3 ? runs : single;
  const text = pick.join('\n')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .filter(l => !/^[A-Za-z]:\\|Microsoft|Normal\.dot|Times New Roman|Calibri|MSWordDoc|Word\.Document/.test(l))
    .join('\n');

  if (!text.trim()) {
    return { text: '', warnings: [],
      error: 'No readable text could be pulled out of this .doc file. Open it in Word and use ' +
             'Save As to make a .docx or a PDF, then import that.' };
  }
  return { text, warnings: ['legacy-doc'], error: null };
}

/* ========================================================== dispatcher ==== */

const DOC_TYPES = '.pdf,.docx,.doc,.csv,.txt';

/** Reads any supported document and returns plain text plus any caveat. */
async function extractDocumentText(file) {
  if (!decompressionSupported()) {
    return { text: '', kind: null,
      error: 'This browser is too old to read PDF and Word files. Chrome, Edge or Firefox will work.' };
  }
  const name = (file.name || '').toLowerCase();
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const sig = latin1(bytes, 0, 8);

  // trust the file's own signature over its extension
  let kind = null;
  if (sig.startsWith('%PDF')) kind = 'pdf';
  else if (sig.startsWith('PK\x03\x04')) kind = 'docx';
  else if (sig === '\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1') kind = 'doc';
  else if (name.endsWith('.pdf')) kind = 'pdf';
  else if (name.endsWith('.docx')) kind = 'docx';
  else if (name.endsWith('.doc')) kind = 'doc';
  else kind = 'text';

  let r;
  if (kind === 'pdf') r = await readPdf(buf);
  else if (kind === 'docx') r = await readDocx(buf);
  else if (kind === 'doc') r = await readDoc(buf);
  else r = { text: new TextDecoder('utf-8').decode(bytes), warnings: [], error: null };

  return { ...r, kind, name: file.name, size: file.size };
}
