#!/usr/bin/env node
/**
 * 命式算出エンジンの回帰テスト
 *
 * index.html 内の計算ロジックを抽出して実行し、
 * 実鑑定書・実アプリで確認済みの正解データと突き合わせる。
 *
 *   実行:  node tests/verify.js
 *
 * index.html を編集したあとは必ずこれを通すこと。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// <script> 内の「定数」〜「描画」直前までを切り出す（DOM 非依存の純粋ロジック部）
const start = html.indexOf("/* ================= 定数");
const end = html.indexOf("/* ================= 描画");
if (start < 0 || end < 0) {
  console.error("✗ index.html から計算ロジックを抽出できません。");
  console.error("  『/* ===== 定数』『/* ===== 描画』のコメント区切りを消さないでください。");
  process.exit(1);
}
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(html.slice(start, end), ctx);

/* ---------------- 正解データ ----------------
 * 出典:
 *   大森玲  … 鑑定士作成のオリジナル命式解説書（時柱あり = 酉の刻）
 *   矢部大  … 既存の命式算出アプリの出力画面
 * ------------------------------------------- */
const CASES = [
  {
    label: "大森玲 1977-11-11 17時（酉の刻）",
    args: [1977, 11, 11, 17],
    setsu: { name: "立冬", days: 5 },
    tcsDay: "戌亥",
    tcsYear: "子丑",
    seijitsu: false,
    seigetsu: false,
    gogyo: { 木: 0, 火: 2, 土: 1, 金: 3, 水: 2 },
    cols: [
      { name: "年柱", ganshi: "丁巳", no: 54, zokan: "戊", tsuhen: "正財", zoTsu: "偏官", unsei: "絶",   energy: 1 },
      { name: "月柱", ganshi: "辛亥", no: 48, zokan: "戊", tsuhen: "印綬", zoTsu: "偏官", unsei: "建禄", energy: 11 },
      { name: "日柱", ganshi: "壬申", no:  9, zokan: "戊", tsuhen: null,   zoTsu: "偏官", unsei: "長生", energy: 9 },
      { name: "時柱", ganshi: "己酉", no: 46, zokan: "庚", tsuhen: "正官", zoTsu: "偏印", unsei: "沐浴", energy: 7 }
    ]
  },
  {
    label: "矢部大 1975-03-31 時刻不明",
    args: [1975, 3, 31, ""],
    setsu: { name: "啓蟄", days: 26 },
    tcsDay: "申酉",
    tcsYear: "子丑",
    seijitsu: true,   // 生日中殺あり
    seigetsu: false,
    gogyo: { 木: 3, 火: 1, 土: 1, 金: 0, 水: 1 },
    cols: [
      { name: "年柱", ganshi: "乙卯", no: 52, zokan: "乙", tsuhen: "印綬", zoTsu: "印綬", unsei: "沐浴", energy: 7 },
      { name: "月柱", ganshi: "己卯", no: 16, zokan: "乙", tsuhen: "傷官", zoTsu: "印綬", unsei: "沐浴", energy: 7 },
      { name: "日柱", ganshi: "丙子", no: 13, zokan: "癸", tsuhen: null,   zoTsu: "正官", unsei: "胎",   energy: 3 }
    ]
  },
  // 立春をまたぐ年柱の切り替わり（節入り前は前年の干支になる）
  {
    label: "立春前 1990-02-01 → 己巳年（1989年扱い）",
    args: [1990, 2, 1, ""],
    setsuYear: 1989,
    cols: [{ name: "年柱", ganshi: "己巳" }]
  },
  {
    label: "立春後 1990-02-05 → 庚午年",
    args: [1990, 2, 5, ""],
    setsuYear: 1990,
    cols: [{ name: "年柱", ganshi: "庚午" }]
  }
];

/* ---------------- 実行 ---------------- */
let pass = 0, fail = 0;
const check = (label, actual, expected) => {
  if (actual === expected) { pass++; return; }
  fail++;
  console.log(`  ✗ ${label}: 期待 ${JSON.stringify(expected)} / 実際 ${JSON.stringify(actual)}`);
};

for (const c of CASES) {
  console.log(`\n■ ${c.label}`);
  const r = ctx.meishiki(...c.args);

  if (c.setsu) {
    check("節入りの節名", r.setsu.name, c.setsu.name);
    check("節入りからの日数", r.setsu.days, c.setsu.days);
  }
  if (c.setsuYear !== undefined) check("年柱の基準年", r.setsuYear, c.setsuYear);
  if (c.tcsDay)  check("天中殺(日柱基準)", r.tcsDay,  c.tcsDay);
  if (c.tcsYear) check("天中殺(年柱基準)", r.tcsYear, c.tcsYear);
  if (c.seijitsu !== undefined) check("生日中殺", r.seijitsu, c.seijitsu);
  if (c.seigetsu !== undefined) check("生月中殺", r.seigetsu, c.seigetsu);
  if (c.gogyo) for (const [g, v] of Object.entries(c.gogyo)) check(`五行 ${g}`, r.count[g], v);

  if (c.cols.length !== undefined && c.setsu) check("柱の本数", r.cols.length, c.cols.length);

  for (const exp of c.cols) {
    const got = r.cols.find(x => x.name === exp.name);
    if (!got) { fail++; console.log(`  ✗ ${exp.name} が存在しません`); continue; }
    for (const key of ["ganshi", "no", "zokan", "tsuhen", "zoTsu", "unsei", "energy"]) {
      if (exp[key] === undefined) continue;
      check(`${exp.name} ${key}`, got[key], exp[key]);
    }
  }
  console.log(`  ${r.cols.map(x => x.ganshi).join(" ")}`);
}

console.log(`\n${"─".repeat(46)}`);
console.log(`${fail === 0 ? "✓ 全項目一致" : "✗ 不一致あり"}   成功 ${pass} / 失敗 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
