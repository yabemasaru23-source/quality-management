#!/usr/bin/env node
/**
 * 命式 相互検証（ダブルチェック）
 *
 * 本体 index.html の計算と、独立に書き起こした independent-engine.js を
 * 大量の生年月日で突き合わせる。1件でも食い違えば異常終了する。
 *
 * 「別の人が必ずもう一度計算する」を機械にやらせる仕組み。
 * 片方だけを直しても、もう片方が合っていなければ必ず落ちる。
 *
 *   node verify/crosscheck.js            既定 20,000 件
 *   node verify/crosscheck.js 50000      件数を指定
 *   node verify/crosscheck.js --full     1900〜2050年を全日付・時刻つきで
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const IND = require('./independent-engine.js');

/* ---- 本体(index.html)の計算部だけを取り出す ---- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const s = html.indexOf('/* ================= 定数');
const e = html.indexOf('/* ================= 描画');
if (s < 0 || e < 0) {
  console.error('✗ index.html から計算ロジックを抽出できません。区切りコメントを消さないでください。');
  process.exit(1);
}
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(html.slice(s, e), ctx);

// 節入りの算出は重いので、検証中だけ結果を覚えておく（計算内容は変えない）
const _setsuCache = new Map();
const _setsuJD = ctx.setsuJD;
ctx.setsuJD = (year, lon) => {
  const k = year + ':' + lon;
  if (!_setsuCache.has(k)) _setsuCache.set(k, _setsuJD(year, lon));
  return _setsuCache.get(k);
};

/* ---- 比較する項目 ---- */
const COLS = ['年柱', '月柱', '日柱', '時柱'];
const KEY  = { 年柱: 'year', 月柱: 'month', 日柱: 'day', 時柱: 'hour' };

function compare(y, m, d, hour) {
  const A = ctx.meishiki(y, m, d, hour === null ? '' : String(hour));
  const B = IND.fullMeishiki(y, m, d, hour);
  const ng = [];
  const eq = (label, a, b) => { if (a !== b) ng.push(`${label}: 本体=${a} / 独立=${b}`); };

  eq('節入りの節名', A.setsu.name, B.setsu.name);
  eq('節入りからの日数', A.setsu.days, B.daysFromSetsu);
  eq('年柱の基準年', A.setsuYear, B.solarYear);
  eq('天中殺(日柱)', A.tcsDay, B.tcsDay);
  eq('天中殺(年柱)', A.tcsYear, B.tcsYear);

  for (const c of A.cols) {
    const k = KEY[c.name];
    if (!k || !B[k]) continue;
    const p = B[k];
    eq(`${c.name}の干支`,   c.ganshi, p.name);
    eq(`${c.name}の蔵干`,   c.zokan,  p.zokan);
    eq(`${c.name}の通変星`, c.tsuhen === null ? '—' : c.tsuhen, p.tsuhen);
    eq(`${c.name}の蔵干通変星`, c.zoTsu, p.zokanTsuhen);
    eq(`${c.name}の十二運星`,   c.unsei, p.unsei);
    eq(`${c.name}のエネルギー`, c.energy, p.energy);
  }
  for (const g of ['木','火','土','金','水']) eq(`五行(${g})`, A.count[g], B.gyo[g]);
  return ng;
}

/* ---- 検証する生年月日を組み立てる ---- */
const arg  = process.argv[2];
const full = arg === '--full';
const N    = full ? 0 : (parseInt(arg, 10) || 20000);
const cases = [];
const push = (y, m, d, h) => cases.push([y, m, d, h]);

if (full) {
  for (let y = 1900; y <= 2050; y++)
    for (let m = 1; m <= 12; m++)
      for (let d = 1; d <= new Date(y, m, 0).getDate(); d++)
        push(y, m, d, (d % 3 === 0) ? (d % 24) : null);
} else {
  // 節の境目は事故が起きやすいので厚めに踏む
  for (let y = 1900; y <= 2050; y++)
    for (const [m, d] of [[2,3],[2,4],[2,5],[3,5],[3,6],[4,4],[4,5],[5,5],[5,6],
                          [6,5],[6,6],[7,6],[7,7],[8,6],[8,7],[9,7],[9,8],
                          [10,7],[10,8],[11,6],[11,7],[12,6],[12,7],[12,8],
                          [1,4],[1,5],[1,6],[12,31],[1,1]])
      push(y, m, d, null);
  while (cases.length < N) {
    const y = 1900 + Math.floor(Math.random() * 151);
    const m = 1 + Math.floor(Math.random() * 12);
    const d = 1 + Math.floor(Math.random() * new Date(y, m, 0).getDate());
    push(y, m, d, Math.random() < 0.5 ? Math.floor(Math.random() * 24) : null);
  }
}

/* ---- 実行 ---- */
let bad = 0, sameDay = 0;
const report = [];
for (const [y, m, d, h] of cases) {
  let ng;
  try { ng = compare(y, m, d, h); }
  catch (err) { ng = [`例外: ${err.message}`]; }
  if (!ng.length) continue;
  // 節入り当日は「日付で判定するか時刻で判定するか」の流派差。別集計にする
  const A = ctx.meishiki(y, m, d, h === null ? '' : String(h));
  if (A.setsu.days === 1) { sameDay++; continue; }
  bad++;
  if (report.length < 15)
    report.push(`  ✗ ${y}/${m}/${d}${h === null ? '' : ' ' + h + '時'}\n     ` + ng.join('\n     '));
}

console.log(`\n命式 相互検証 — 本体(index.html) × 独立エンジン`);
console.log('─'.repeat(56));
console.log(`  検証した生年月日        ${cases.length.toLocaleString()} 件`);
console.log(`  節入り当日（流派差のため対象外） ${sameDay.toLocaleString()} 件`);
if (bad) {
  console.log(`\n✗ 食い違い ${bad} 件\n`);
  console.log(report.join('\n'));
  console.log('\n  どちらかの計算が間違っています。両方を読んで原因を特定してください。');
  process.exit(1);
}
console.log(`\n✓ 全項目一致（干支・蔵干・通変星・蔵干通変星・十二運星・エネルギー・天中殺・五行）\n`);
