#!/usr/bin/env node
/**
 * 命式アプリの定期巡回（2週間に1回）
 *
 *   node verify/patrol.mjs            ふつうに巡回（数分）
 *   node verify/patrol.mjs --quick    画面とPDFの確認を省く
 *
 * 見ること
 *   1. 計算の答え合わせ  … crosscheck.js（本体×独立エンジン 20,000件）と tests/verify.js（検証ずみ鑑定書）
 *   2. 同じ命式のくり返し … 1900〜2100年を1日ずつ進め、日柱が毎日1つずつ進むか（止まる・飛ぶ＝異常）、
 *                           月柱は節入りの日だけ、年柱は立春の日だけ切りかわるか、時柱は刻ごとに変わるか
 *   3. 公開中のアプリ     … https://qmw.co.jp/meishiki/ の計算部が手元と同じか。ちがえば公開版も答え合わせ
 *   4. 画面               … ちがう生年月日を続けて入れたとき、前の人の命式が残らず、正しい命式に変わるか
 *   5. スマホのPDF        … 天中殺カードなどがページの境目で切れていないか
 *
 * 結果は verify/out/patrol-YYYY-MM-DD.md に書く。異常があれば終了コード1。
 */
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const outDir = path.join(here, 'out');
mkdirSync(outDir, { recursive: true });
const quick = process.argv.includes('--quick');
const today = new Date().toLocaleDateString('sv-SE');
const require = createRequire(import.meta.url);
const IND = require('./independent-engine.js');

const report = [`# 命式アプリ 定期巡回 ${today}`, ''];
let ng = 0;
const ok = (title, detail = '') => report.push(`- ✅ ${title}${detail ? '　' + detail : ''}`);
const bad = (title, detail = '') => { ng++; report.push(`- ❌ **${title}**${detail ? '\n  ' + detail.replace(/\n/g, '\n  ') : ''}`); };
const warn = (title, detail = '') => report.push(`- ⚠️ ${title}${detail ? '　' + detail : ''}`);

/* ---- 計算部を取り出して動かす ---- */
const calcPart = html => {
  const s = html.indexOf('/* ================= 定数'), e = html.indexOf('/* ================= 描画');
  return s < 0 || e < 0 ? null : html.slice(s, e);
};
function engineFrom(html) {
  const code = calcPart(html);
  if (!code) return null;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const cache = new Map(), orig = ctx.setsuJD;
  ctx.setsuJD = (y, l) => { const k = y + ':' + l; if (!cache.has(k)) cache.set(k, orig(y, l)); return cache.get(k); };
  return ctx;
}
const localHtml = readFileSync(path.join(root, 'index.html'), 'utf8');
const E = engineFrom(localHtml);

/* ---- 1. 答え合わせ ---- */
report.push('## 1. 計算の答え合わせ');
for (const [label, args] of [['本体×独立エンジン（20,000件）', ['crosscheck.js', '20000']], ['検証ずみ鑑定書との回帰テスト', ['../tests/verify.js']]]) {
  const r = spawnSync(process.execPath, [path.join(here, args[0]), ...args.slice(1)], { encoding: 'utf8', timeout: 600000 });
  const tail = (r.stdout + r.stderr).trim().split('\n').slice(-3).join(' ／ ');
  r.status === 0 ? ok(label, tail) : bad(label, tail);
}

/* ---- 2. 同じ命式のくり返し ---- */
report.push('', '## 2. 同じ命式がくり返し出ていないか（1900〜2100年・1日ずつ）');
{
  const errs = { day: [], month: [], year: [], hour: [] };
  let prev = null, days = 0, monthChanges = 0, yearChanges = 0;
  const d0 = new Date(Date.UTC(1900, 0, 1)), d1 = new Date(Date.UTC(2100, 11, 31));
  for (let t = d0; t <= d1; t = new Date(t.getTime() + 86400000)) {
    const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate();
    const r = E.meishiki(y, m, d, '');
    const cur = { y, m, d, day: r.cols[2].no, mon: r.cols[1].no, year: r.cols[0].no, setsu: r.setsu.name, sdays: r.setsu.days, sy: r.setsuYear };
    if (prev) {
      const at = `${y}-${m}-${d}`;
      if (cur.day !== prev.day % 60 + 1) errs.day.push(`${at}：日柱 No.${prev.day} → No.${cur.day}`);
      const newSetsu = cur.sdays === 1 || cur.setsu !== prev.setsu;
      if (newSetsu) { monthChanges++; if (cur.mon !== prev.mon % 60 + 1) errs.month.push(`${at}（${cur.setsu}）：月柱 No.${prev.mon} → No.${cur.mon}`); }
      else if (cur.mon !== prev.mon) errs.month.push(`${at}：節入りでないのに月柱が変わった No.${prev.mon} → No.${cur.mon}`);
      if (cur.sy !== prev.sy) { yearChanges++; if (cur.year !== prev.year % 60 + 1 || m !== 2 || d < 2 || d > 6) errs.year.push(`${at}：年柱 No.${prev.year} → No.${cur.year}`); }
      else if (cur.year !== prev.year) errs.year.push(`${at}：立春でないのに年柱が変わった`);
    }
    prev = cur; days++;
  }
  // 時柱：1日の中で刻ごとに変わるか（23時と0時は同じ子の刻）
  for (const [y, m, d] of [[1998, 5, 14], [1966, 7, 3], [2001, 1, 20], [2026, 10, 16]]) {
    const hs = Array.from({ length: 24 }, (_, h) => E.meishiki(y, m, d, String(h)).cols[3].ganshi);
    const kinds = new Set(hs.slice(1, 23)).size;
    if (kinds !== 11 || hs[23] !== hs[0]) errs.hour.push(`${y}-${m}-${d}：1〜22時で${kinds}種類（11のはず）・0時と23時 ${hs[0]}/${hs[23]}`);
  }
  const show = (label, a) => a.length ? bad(label, a.slice(0, 8).join('\n') + (a.length > 8 ? `\n…ほか${a.length - 8}件` : '')) : ok(label);
  show(`日柱が毎日1つずつ進む（${days.toLocaleString()}日）`, errs.day);
  show(`月柱は節入りの日だけ切りかわる（${monthChanges}回）`, errs.month);
  show(`年柱は立春の日だけ切りかわる（${yearChanges}回）`, errs.year);
  show('時柱は刻ごとに切りかわる', errs.hour);
}

/* ---- 3. 公開中のアプリ ---- */
report.push('', '## 3. 公開中のアプリ（https://qmw.co.jp/meishiki/）');
let liveHtml = null;
try {
  const res = await fetch('https://qmw.co.jp/meishiki/', { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  liveHtml = await res.text();
  const lc = calcPart(liveHtml), mc = calcPart(localHtml);
  if (!lc) bad('公開版から計算部を取り出せない', '区切りコメントが消えている可能性があります');
  else if (lc === mc) ok('公開版の計算部は手元と同じ');
  else {
    warn('公開版の計算部が手元とちがう（アップロードしていない修正がある、または公開版だけ書きかわった）');
    const L = engineFrom(liveHtml); const diff = [];
    for (let i = 0; i < 3000; i++) {
      const y = 1930 + Math.floor(Math.random() * 100), m = 1 + Math.floor(Math.random() * 12), d = 1 + Math.floor(Math.random() * 28);
      const h = Math.random() < .5 ? null : Math.floor(Math.random() * 24);
      const A = L.meishiki(y, m, d, h === null ? '' : String(h)); if (A.setsu.days === 1) continue;
      const B = IND.fullMeishiki(y, m, d, h);
      const K = { 年柱: 'year', 月柱: 'month', 日柱: 'day', 時柱: 'hour' };
      for (const c of A.cols) { const p = B[K[c.name]]; if (p && (c.ganshi !== p.name || c.zokan !== p.zokan || c.unsei !== p.unsei)) { diff.push(`${y}-${m}-${d} ${c.name} 公開=${c.ganshi}/${c.zokan}/${c.unsei} 独立=${p.name}/${p.zokan}/${p.unsei}`); break; } }
    }
    diff.length ? bad('公開版の計算が独立エンジンと合わない', diff.slice(0, 5).join('\n')) : ok('公開版も独立エンジンと一致（3,000件）');
  }
} catch (e) { bad('公開中のアプリを開けない', String(e.message || e)); }

/* ---- 4・5. 画面とPDF（Chrome を自動で動かす） ---- */
if (!quick) {
  const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  if (!CHROME) warn('Chrome が見つからないので、画面とPDFの確認を省きました');
  else {
    const people = [[1998, 5, 14, 14, '女性'], [1983, 10, 26, 7, '男性'], [1966, 7, 3, null, '女性'], [2001, 1, 20, 18, '男性'], [1989, 11, 28, 10, '女性'], [1998, 5, 15, 14, '女性']];
    const expect = people.map(([y, m, d, h]) => E.meishiki(y, m, d, h === null ? '' : String(h)).cols.map(c => c.ganshi).join(''));
    for (const [label, url] of [['手元のアプリ', pathToFileURL(path.join(root, 'index.html')).href], ['公開中のアプリ', liveHtml ? 'https://qmw.co.jp/meishiki/' : null]]) {
      if (!url) continue;
      report.push('', `## 4. 画面：${label}（ちがう生年月日を続けて入れる）`);
      const port = 9400 + Math.floor(Math.random() * 400), prof = path.join(outDir, 'chrome-prof-' + port);
      const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      let ws, id = 0; const wait = {};
      // 返事が来ないまま待ち続けると Node が黙って終わるので、30秒で打ち切る
      const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; const t = setTimeout(() => { delete wait[i]; rej(new Error(`${method} が30秒で返ってこない`)); }, 30000); wait[i] = v => { clearTimeout(t); res(v); }; ws.send(JSON.stringify({ id: i, method, params })); });
      const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
      try {
        let tgt; for (let i = 0; i < 40 && !tgt; i++) { await sleep(250); try { tgt = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {} }
        if (!tgt) throw new Error('Chrome を起動できない');
        ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('Chrome に接続できない')); });
        ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait[m.id]) { wait[m.id](m.result || m.error); delete wait[m.id]; } };
        await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
        await send('Page.navigate', { url }); await sleep(4000);
        const shown = [];
        for (const [y, m, d, h, sex] of people) {
          shown.push(await evaluate(`(async()=>{const $=i=>document.getElementById(i);
            $('birth').value='${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}'; $('sex').value='${sex}'; $('hour').value='${h ?? ''}';
            $('go').click(); await new Promise(r=>setTimeout(r,900));
            return [...document.querySelectorAll('#body .ganshi')].map(e=>e.textContent).reverse().join('');})()`));
        }
        const errs = [];
        people.forEach((p, i) => { if (shown[i] !== expect[i]) errs.push(`${p.slice(0, 3).join('-')} ${p[3] ?? '時刻なし'}：画面=${shown[i] || '（空）'} 計算=${expect[i]}`); });
        shown.forEach((s, i) => { if (i && s === shown[i - 1]) errs.push(`${people[i].slice(0, 3).join('-')}：前の人と同じ命式のまま`); });
        errs.length ? bad(`${people.length}人を続けて入れたときの表示`, errs.join('\n')) : ok(`${people.length}人を続けて入れて、毎回正しい命式に切りかわった`);

        if (label === '手元のアプリ') {
          report.push('', '## 5. スマホからのPDF');
          await evaluate(`(async()=>{const $=i=>document.getElementById(i);$('birth').value='1998-05-14';$('sex').value='女性';$('hour').value='14';$('go').click();await new Promise(r=>setTimeout(r,1200));})()`);
          const pdf = await send('Page.printToPDF', { paperWidth: 8.27, paperHeight: 11.69, printBackground: true, preferCSSPageSize: true });
          const file = path.join(outDir, `patrol-${today}-mobile.pdf`);
          writeFileSync(file, Buffer.from(pdf.data, 'base64'));
          const py = spawnSync('python', ['-X', 'utf8', '-c', `
import fitz,json,sys
d=fitz.open(sys.argv[1]); pages=[p.get_text() for p in d]
def page_of(s): return next((i for i,t in enumerate(pages) if s in t), -1)
print(json.dumps({'pages':len(pages),'label':page_of('日柱から'),'value':page_of('天中殺'),'tcs':page_of('子丑（ねうし）天中殺')}))`, file], { encoding: 'utf8' });
          if (py.status !== 0) warn('PDFの中身を調べられませんでした（python の PyMuPDF が必要）', file);
          else {
            const r = JSON.parse(py.stdout);
            r.label >= 0 && r.label === r.tcs ? ok(`天中殺カードが1ページにおさまっている（全${r.pages}ページ）`, path.basename(file)) : bad('天中殺カードがページの境目で切れている', `見出し ${r.label + 1}ページ／中身 ${r.tcs + 1}ページ（${path.basename(file)}）`);
          }
        }
      } catch (e) { bad(`${label}の画面を動かせない`, String(e.message || e)); }
      finally { try { ws && ws.close(); } catch {} ch.kill(); await sleep(500); try { rmSync(prof, { recursive: true, force: true }); } catch {} }
    }
  }
}

report.push('', ng ? `**結果：異常 ${ng} 件**` : '**結果：異常なし**');
const file = path.join(outDir, `patrol-${today}.md`);
writeFileSync(file, report.join('\n') + '\n');
console.log(report.join('\n'));
console.log('\n報告書:', file);
process.exit(ng ? 1 : 0);
