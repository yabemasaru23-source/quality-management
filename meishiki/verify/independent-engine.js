// ===== 陰陽五行 命式エンジン =====
// 節入り（太陽黄経）ベースで年柱・月柱・日柱・時柱を算出する

const KAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const SHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const KAN_GYO  = ['木','木','火','火','土','土','金','金','水','水'];
const KAN_IN   = ['陽','陰','陽','陰','陽','陰','陽','陰','陽','陰'];
const SHI_GYO  = ['水','土','木','木','土','火','火','土','金','金','土','水'];
const SHI_IN   = ['陽','陰','陽','陰','陽','陰','陽','陰','陽','陰','陽','陰'];

// 節気（月の切り替わり）：太陽黄経 → 月支
const SETSU = [
  { lon: 315, shi: 2,  name: '立春' }, { lon: 345, shi: 3,  name: '啓蟄' },
  { lon: 15,  shi: 4,  name: '清明' }, { lon: 45,  shi: 5,  name: '立夏' },
  { lon: 75,  shi: 6,  name: '芒種' }, { lon: 105, shi: 7,  name: '小暑' },
  { lon: 135, shi: 8,  name: '立秋' }, { lon: 165, shi: 9,  name: '白露' },
  { lon: 195, shi: 10, name: '寒露' }, { lon: 225, shi: 11, name: '立冬' },
  { lon: 255, shi: 0,  name: '大雪' }, { lon: 285, shi: 1,  name: '小寒' },
];

const rad = d => d * Math.PI / 180;

// グレゴリオ暦 → ユリウス日（UT）
function toJD(y, m, d, h = 0, mi = 0) {
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1))
    + d + b - 1524.5 + (h + mi / 60) / 24;
}

// 太陽の視黄経（度）— Meeus 25章
function solarLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M  = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(rad(M))
           + (0.019993 - 0.000101 * T) * Math.sin(rad(2 * M))
           + 0.000289 * Math.sin(rad(3 * M));
  const O  = 125.04 - 1934.136 * T;
  let lon = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(O));
  return ((lon % 360) + 360) % 360;
}

// 指定黄経に太陽が達する時刻（JD, UT）を二分探索。startJD 以降で最初のもの
function findSolarTerm(startJD, targetLon) {
  const diff = jd => {
    let d = solarLongitude(jd) - targetLon;
    return ((d % 360) + 360) % 360; // 0..360
  };
  // targetLon 到達前は diff が 360 に近い。到達直後に 0 に落ちる
  let lo = startJD, hi = startJD + 370;
  // 粗探索：diff が大きい→小さいへ落ちる点を探す
  let prev = diff(lo), step = 1;
  for (let jd = lo + step; jd <= hi; jd += step) {
    const cur = diff(jd);
    if (cur < prev) { // ラップした＝この区間に節入りがある
      let a = jd - step, b = jd;
      for (let i = 0; i < 60; i++) {
        const mid = (a + b) / 2;
        if (diff(mid) > 180) a = mid; else b = mid;
      }
      return (a + b) / 2;
    }
    prev = cur;
  }
  return null;
}


// JD（JST）→ 年月日
function jdToYMD(jd) {
  const z = Math.floor(jd + 0.5), f = jd + 0.5 - z;
  let A = z;
  if (z >= 2299161) { const al = Math.floor((z - 1867216.25) / 36524.25); A = z + 1 + al - Math.floor(al / 4); }
  const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C),
        E = Math.floor((B - D) / 30.6001);
  const day = B - D - Math.floor(30.6001 * E) + f, mo = (E < 14) ? E - 1 : E - 13;
  return [(mo > 2) ? C - 4716 : C - 4715, mo, Math.floor(day)];
}
// 暦日の通し番号
const dayNumber = (y, m, d) => Math.floor(toJD(y, m, d, 12));

// JST の年月日時 → 命式
function calcMeishiki(y, m, d, hour = null, min = 0, opt = {}) {
  const hasTime = hour !== null;
  const jstJD = toJD(y, m, d, hasTime ? hour : 12, hasTime ? min : 0);
  const utJD  = jstJD - 9 / 24; // JST → UT

  // --- 節入り表（前年12月〜当年12月を網羅） ---
  const terms = [];
  for (const yy of [y - 1, y, y + 1]) {
    for (const s of SETSU) {
      // その黄経に達する時刻を yy 年の頭から探す
      const jd = findSolarTerm(toJD(yy, 1, 1) - 20, s.lon);
      if (jd) terms.push({ jd, ...s });
    }
  }
  terms.sort((a, b) => a.jd - b.jd);
  // 重複除去
  const uniq = [];
  for (const t of terms) if (!uniq.some(u => Math.abs(u.jd - t.jd) < 1)) uniq.push(t);

  // 誕生時点が属する節
  let cur = null;
  for (const t of uniq) if (t.jd <= utJD) cur = t; else break;

  // --- 年柱：立春が基準 ---
  const risshun = uniq.filter(t => t.name === '立春' && t.jd <= utJD).pop();
  const solarYear = risshun ? new Date((risshun.jd - 2440587.5) * 86400000).getUTCFullYear() : y - 1;
  const yIdx = ((solarYear - 4) % 60 + 60) % 60;

  // --- 月柱：節入りで決まる月支 ＋ 五虎遁 ---
  const mShi = cur.shi;
  const offsetFromTora = ((mShi - 2) % 12 + 12) % 12;
  const mKan = ((yIdx % 10) * 2 + 2 + offsetFromTora) % 10;

  // --- 日柱：ユリウス日の60周期 ---
  let dy = y, dm = m, dd = d;
  if (opt.lateZi && hasTime && hour >= 23) { // 23時以降を翌日とする設定
    const nx = new Date(Date.UTC(y, m - 1, d + 1));
    dy = nx.getUTCFullYear(); dm = nx.getUTCMonth() + 1; dd = nx.getUTCDate();
  }
  const jdn = Math.floor(toJD(dy, dm, dd, 12)) ;
  const dIdx = ((jdn + 49) % 60 + 60) % 60;

  // --- 時柱 ---
  let hIdx = null;
  if (hasTime) {
    const hShi = Math.floor(((hour + 1) % 24) / 2);
    const hKan = (((dIdx % 10) % 5) * 2 + hShi) % 10;
    hIdx = { kan: hKan, shi: hShi };
  }

  const pillar = (idx) => ({ kan: idx % 10, shi: idx % 12 });
  const res = {
    year:  pillar(yIdx),
    month: { kan: mKan, shi: mShi },
    day:   pillar(dIdx),
    hour:  hIdx,
    setsu: cur,
    // 節入りからの日数は暦日で数える（節入り当日を1日目とする）
    daysFromSetsu: dayNumber(y, m, d) - dayNumber(...jdToYMD(cur.jd + 9 / 24)) + 1,
    solarYear,
  };
  for (const k of ['year', 'month', 'day', 'hour']) {
    if (res[k]) res[k].name = KAN[res[k].kan] + SHI[res[k].shi];
  }
  return res;
}


// ===== ここから派生項目（蔵干・通変星・十二運星・天中殺・五行） =====
// 本体(index.html)とは別に、古典の規則からそのまま書き起こしている。
// 両者が一致しなければ、どちらかが間違っている。

// 月律分野蔵干：節入りからの日数で決まる
const ZOKAN_MONTH = {
  0:[[10,'壬'],[99,'癸']], 1:[[9,'癸'],[12,'辛'],[99,'己']], 2:[[7,'戊'],[14,'丙'],[99,'甲']],
  3:[[10,'甲'],[99,'乙']], 4:[[9,'乙'],[12,'癸'],[99,'戊']], 5:[[7,'戊'],[14,'庚'],[99,'丙']],
  6:[[10,'丙'],[19,'己'],[99,'丁']], 7:[[9,'丁'],[12,'乙'],[99,'己']], 8:[[7,'戊'],[14,'壬'],[99,'庚']],
  9:[[10,'庚'],[99,'辛']], 10:[[9,'辛'],[12,'丁'],[99,'戊']], 11:[[7,'戊'],[14,'甲'],[99,'壬']],
};
const ZOKAN_MAIN = ['癸','己','甲','乙','戊','丙','丁','己','庚','辛','戊','壬'];
// 蔵干は月柱だけでなく四柱すべてに「節入りからの日数」を当てる。
// （鑑定士作成の大森玲さんの解説書で確認：立冬5日目、年柱 巳→戊・時柱 酉→庚）
const zokanOf = (shi, days) => {
  for (const [lim, k] of ZOKAN_MONTH[shi]) if (days <= lim) return k;
  return ZOKAN_MAIN[shi];
};

// 五行の相生・相剋
const SEI  = { '木':'火','火':'土','土':'金','金':'水','水':'木' }; // 生む
const KOKU = { '木':'土','土':'水','水':'火','火':'金','金':'木' }; // 剋す

// 通変星：日干から見た相手の干の位置づけ
function tsuhen(dayKan, target) {
  const a = KAN.indexOf(dayKan), b = KAN.indexOf(target);
  const ga = KAN_GYO[a], gb = KAN_GYO[b];
  const same = KAN_IN[a] === KAN_IN[b];       // 陰陽が同じか
  if (ga === gb)      return same ? '比肩' : '劫財';   // 同じ五行
  if (SEI[ga] === gb) return same ? '食神' : '傷官';   // 自分が生む
  if (KOKU[ga] === gb)return same ? '偏財' : '正財';   // 自分が剋す
  if (KOKU[gb] === ga)return same ? '偏官' : '正官';   // 相手が自分を剋す
  return same ? '偏印' : '印綬';                        // 相手が自分を生む
}

// 十二運星：日干の長生の位置から、陽干は順行・陰干は逆行
const CHOSEI = { '甲':'亥','乙':'午','丙':'寅','丁':'酉','戊':'寅',
                 '己':'酉','庚':'巳','辛':'子','壬':'申','癸':'卯' };
const UNSEI  = ['長生','沐浴','冠帯','建禄','帝旺','衰','病','死','墓','絶','胎','養'];
const ENERGY = { 胎:3, 養:6, 長生:9, 沐浴:7, 冠帯:10, 建禄:11, 帝旺:12,
                 衰:8, 病:4, 死:2, 墓:5, 絶:1 };
function unsei(dayKan, shi) {
  const start = SHI.indexOf(CHOSEI[dayKan]);
  const isYin = KAN_IN[KAN.indexOf(dayKan)] === '陰';
  const step  = isYin ? (start - shi + 12) % 12 : (shi - start + 12) % 12;
  return UNSEI[step];
}

// 天中殺（空亡）：干支の旬から、欠けている2支
function tenchusatsu(kan, shi) {
  const head = (shi - kan + 12) % 12;          // その旬の先頭が子から何番目か
  return [SHI[(head + 10) % 12], SHI[(head + 11) % 12]];
}

// 命式まるごと（派生項目つき）
function fullMeishiki(y, m, d, hour = null, min = 0, opt = {}) {
  const r = calcMeishiki(y, m, d, hour, min, opt);
  const dayKan = KAN[r.day.kan];
  const cols = ['year', 'month', 'day'];
  if (r.hour) cols.push('hour');
  const gyo = { 木:0, 火:0, 土:0, 金:0, 水:0 };
  for (const k of cols) {
    const p = r[k];
    p.zokan  = zokanOf(p.shi, r.daysFromSetsu);
    p.tsuhen = (k === 'day') ? '—' : tsuhen(dayKan, KAN[p.kan]);
    p.zokanTsuhen = tsuhen(dayKan, p.zokan);
    p.unsei  = unsei(dayKan, p.shi);
    p.energy = ENERGY[p.unsei];
    gyo[KAN_GYO[p.kan]]++; gyo[SHI_GYO[p.shi]]++;
  }
  r.gyo = gyo;
  r.tcsDay  = tenchusatsu(r.day.kan,  r.day.shi).join('');
  r.tcsYear = tenchusatsu(r.year.kan, r.year.shi).join('');
  return r;
}

module.exports = { calcMeishiki, fullMeishiki, KAN, SHI, KAN_GYO, SHI_GYO, KAN_IN, SHI_IN,
                   zokanOf, tsuhen, unsei, tenchusatsu, ENERGY };

