# 記事デザイン部品カタログ

blog.js の `wrapBody()` は、`<div` `<blockquote` などで始まる要素を `<p>` で包まない。
そのため body 配列の 1要素として、以下のHTMLをそのまま入れれば図解になる。

**使い方の原則：装飾のために入れない。** その記事の核心（数字・対比・時系列・言われた言葉）が
一目で分かるときだけ使う。1記事に3〜5個が目安。全部の型を使う必要はない。

---

## 1. 見出し `al-h`（記事を区切る／2〜4個）
```html
<div class="al-h"><small>THE REAL REASON</small>会社をつくった本当の理由</div>
```
`<small>` は英語のラベル。無くても可。

## 2. プルクオート `al-quote`（濃紺・最も強い一言を1記事に1つだけ）
```html
<div class="al-quote"><p>社長にならなければ、この話は本当のところが分からない。</p><cite>——講座の後ろに立ちながら、そう思いました</cite></div>
```

## 3. 証言ボックス `al-voice`（誰かに言われた言葉／黄）
```html
<div class="al-voice"><div class="vi">!</div><div><p class="vt">「バク転で金が儲かるわけないだろう、アホ」</p><p class="vs">初めて会った社長に、酒の席で言われた言葉です</p></div></div>
```

## 4. 数字ハイライト `al-nums`（2〜4個。実数があるときだけ）
```html
<div class="al-nums">
  <div class="al-num"><b>5<span class="u">万人</span></b><span>二十年間で指導した人数</span></div>
  <div class="al-num"><b>70<span class="u">%</span></b><span>受講者がバク転を習得する割合</span></div>
</div>
```

## 5. 年表 `al-time`（時系列が論点のとき）
```html
<div class="al-time">
  <div class="ti"><div class="ty">2002年</div><div class="tx">東京・中野で創業</div></div>
  <div class="tgap">↓　十数年、誰も追ってこない時期が続く</div>
  <div class="ti hot"><div class="ty">2020年</div><div class="tx">競合が1号店を開業</div></div>
</div>
```
`hot` を付けた項目は金色の点になる（強調したい年に）。`tgap` は年の間隔を示す差し込み。

## 6. ポイント3色 `al-points`（対比・分類）
```html
<div class="al-points">
  <div class="al-pt b"><b>見出し</b>説明文</div>
  <div class="al-pt g"><b>見出し</b>説明文</div>
  <div class="al-pt r"><b>見出し</b>説明文</div>
</div>
```
`b`=青 `g`=金 `r`=赤。2つでも3つでもよい。

## 7. Before / After `al-ba`
```html
<div class="al-ba">
  <div class="bx before"><h5>BEFORE</h5>内容</div>
  <div class="ar">→</div>
  <div class="bx after"><h5>AFTER</h5>内容</div>
</div>
```

## 8. 締めの一行 `al-end`（記事の最後の問い／1つだけ）
```html
<div class="al-end"><p>あなたがいま「遠回りだ」と感じている仕事は<br>本当に、遠回りでしょうか。</p></div>
```

---

## 自動で付くもの（body に書かなくてよい）

- カテゴリタグ・日付・**読了時間**（本文字数から自動計算）
- **NEW バッジ**（3日以内の記事）
- **リード文**（`summary` が記事冒頭に金色の枠で表示される）
- **1段落目の1文字が大きくなる**（ドロップキャップ）
- **読了プログレスバー**（画面上部）
- **前後の記事ナビ**（記事末）

## 本文中で使える文字装飾

- `<b>強調</b>` … 太字。1段落に1箇所まで
- `<span class="marker">黄色マーカー</span>`
- `<span class="red">赤字</span>`
