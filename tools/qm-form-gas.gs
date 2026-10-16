/**
 * QMサイト お問い合わせフォーム 受付スクリプト
 *
 * 【デプロイ手順】
 *  1. https://script.google.com/ を開き「新しいプロジェクト」
 *  2. このファイルの中身をすべて貼り付けて保存
 *  3. 右上「デプロイ」→「新しいデプロイ」
 *  4. 種類＝ウェブアプリ／次のユーザーとして実行＝自分／アクセスできるユーザー＝全員
 *  5. デプロイ → 表示された「ウェブアプリのURL」をコピー
 *
 * Formspree と違い、必須項目が空の送信はここで捨てるため、
 * ボットが直接POSTしても空メールは届かない。
 */

var NOTIFY_TO  = 'masa-ru@qmw.co.jp';   // 通知先
var SHEET_NAME = 'QMお問い合わせ受付';    // 自動生成されるスプレッドシート名

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    // --- 1. ハニーポット：人間は絶対に埋めない欄 ---
    if (p._gotcha) return ok();

    // --- 2. 必須項目チェック（空メールはここで止まる） ---
    var name  = String(p['お名前'] || '').trim();
    var email = String(p['email'] || '').trim();
    var kind  = String(p['ご相談の種類'] || '').trim();
    if (!name || !email || !kind) return ok();              // 静かに破棄
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ok();
    if (name.length > 100 || email.length > 200) return ok();

    // --- 3. 滞在時間チェック（3秒未満の送信はボット） ---
    var elapsed = Number(p._elapsed || 0);
    if (elapsed > 0 && elapsed < 3000) return ok();

    var company = String(p['会社名'] || '').trim();
    var tel     = String(p['電話番号'] || '').trim();
    var body    = String(p['ご相談内容'] || '').trim();

    // --- 4. スプレッドシートに記録 ---
    var sheet = getSheet();
    sheet.appendRow([new Date(), name, company, email, tel, kind, body]);

    // --- 5. メール通知 ---
    var lines = [
      'QMサイトのフォームからお問い合わせが届きました。',
      '',
      '■ お名前　　　：' + name,
      '■ 会社名　　　：' + (company || '（未入力）'),
      '■ メール　　　：' + email,
      '■ 電話番号　　：' + (tel || '（未入力）'),
      '■ ご相談の種類：' + kind,
      '',
      '■ ご相談内容',
      body || '（未入力）',
      '',
      '---------------------------------------',
      '受信日時：' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
      'このメールにそのまま返信すると、お客様へ返信できます。'
    ];

    MailApp.sendEmail({
      to:      NOTIFY_TO,
      subject: '【QMサイト】お問い合わせ：' + name + ' 様（' + kind + '）',
      body:    lines.join('\n'),
      replyTo: email,
      name:    'QMサイト お問い合わせ'
    });

    return ok();

  } catch (err) {
    // 失敗しても画面側は成功扱いにする（お客様を不安にさせない）
    console.error(err);
    try {
      MailApp.sendEmail(NOTIFY_TO, '【QMサイト】フォーム処理エラー', String(err));
    } catch (e2) {}
    return ok();
  }
}

function doGet() {
  return ContentService.createTextOutput('ok');
}

function ok() {
  return ContentService.createTextOutput('ok');
}

/** 記録用スプレッドシートを取得（無ければ自動作成） */
function getSheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss = null;

  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    props.setProperty('SHEET_ID', ss.getId());
    var sh = ss.getSheets()[0];
    sh.appendRow(['受信日時', 'お名前', '会社名', 'メールアドレス', '電話番号', 'ご相談の種類', 'ご相談内容']);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(7, 400);
  }
  return ss.getSheets()[0];
}

/** 動作確認用：エディタ上で実行すると、テストのお問い合わせが1件届く */
function テスト送信() {
  doPost({ parameter: {
    'お名前': 'テスト 太郎',
    '会社名': 'テスト株式会社',
    'email': 'test@example.com',
    '電話番号': '090-0000-0000',
    'ご相談の種類': 'AI×感動工房について',
    'ご相談内容': 'これはテスト送信です。',
    '_elapsed': '9999'
  }});
  Logger.log('テスト送信を実行しました。メールとスプレッドシートをご確認ください。');
}
