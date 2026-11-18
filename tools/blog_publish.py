#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
QMブログ 公開スクリプト

drafts/pending.json に置かれた記事を assets/blog-posts.js の先頭へ挿入する。

なぜこれがあるか:
  blog-posts.js は 500KB を超えており、AI が直接読み書きすると
  処理の途中でセッションが力尽き、書いた記事が失われる事故が
  2026年10〜11月に4回起きた。巨大ファイルの操作は機械に任せ、
  AI は数KBの pending.json だけを書く。

使い方:
  python tools/blog_publish.py --titles      既存タイトル一覧（重複チェック用）
  python tools/blog_publish.py --check       pending.json の中身を検証するだけ
  python tools/blog_publish.py --publish     pending.json を blog-posts.js へ挿入
"""
import sys, os, io, re, json, datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS   = os.path.join(ROOT, 'assets', 'blog-posts.js')
PENDING = os.path.join(ROOT, 'drafts', 'pending.json')

REQUIRED = ['date', 'category', 'title', 'slug', 'summary', 'body']


def read_posts():
    with io.open(POSTS, encoding='utf-8') as f:
        return f.read()


def existing(src):
    titles = re.findall(r'title:\s*"((?:[^"\\]|\\.)*)"', src)
    slugs  = re.findall(r'slug:\s*"([^"]*)"', src)
    dates  = re.findall(r'date:\s*"([0-9.]+)"', src)
    return titles, slugs, dates


def cmd_titles():
    t, s, d = existing(read_posts())
    print('公開済み %d本　最新 %s' % (len(d), max(d) if d else '-'))
    print('--- 直近40本のタイトル（重複を避けること）---')
    for x in t[:40]:
        print(' ', x)


def load_pending():
    if not os.path.exists(PENDING):
        return None
    with io.open(PENDING, encoding='utf-8') as f:
        txt = f.read().strip()
    if not txt or txt in ('{}', 'null'):
        return None
    return json.loads(txt)


def validate(a, src):
    errs = []
    for k in REQUIRED:
        if k not in a or not a[k]:
            errs.append('必須項目がありません: ' + k)
    if errs:
        return errs

    if not re.match(r'^\d{4}\.\d{2}\.\d{2}$', a['date']):
        errs.append('date は YYYY.MM.DD 形式にすること: ' + a['date'])
    if not re.match(r'^[a-z0-9-]+$', a['slug']):
        errs.append('slug は半角英小文字・数字・ハイフンのみ: ' + a['slug'])
    if not isinstance(a['body'], list) or len(a['body']) < 4:
        errs.append('body は4要素以上の配列にすること')
    for ng in ('。', '、'):
        if ng in a['title']:
            errs.append('title に句読点を入れないこと（——や・は可）')
            break
    for ng in ('スタントマン', 'スタント'):
        joined = a['title'] + a['summary'] + ''.join(a['body'])
        if ng in joined:
            errs.append('「%s」は使わないこと（経営者指示）' % ng)
            break
    if not any('<div' in b for b in a['body']):
        errs.append('図解（HTMLのdiv）が本文に1つもありません')

    titles, slugs, _ = existing(src)
    if a['slug'] in slugs:
        errs.append('slug が既存と重複: ' + a['slug'])
    if a['title'] in titles:
        errs.append('title が既存と重複: ' + a['title'])
    return errs


def js_literal(a):
    """既存ファイルの見た目に合わせた JS オブジェクトリテラルを作る"""
    def q(v):
        return json.dumps(v, ensure_ascii=False)
    lines = ['  {']
    lines.append('    date: %s,'     % q(a['date']))
    lines.append('    category: %s,' % q(a['category']))
    lines.append('    title: %s,'    % q(a['title']))
    lines.append('    slug: %s,'     % q(a['slug']))
    lines.append('    summary: %s,'  % q(a['summary']))
    lines.append('    body: [')
    for i, b in enumerate(a['body']):
        comma = ',' if i < len(a['body']) - 1 else ''
        lines.append('      %s%s' % (q(b), comma))
    lines.append('    ],')
    lines.append('    sourceLabel: %s,' % q(a.get('sourceLabel', '')))
    lines.append('    sourceUrl: %s'    % q(a.get('sourceUrl', '')))
    lines.append('  },')
    return '\n'.join(lines)


def cmd_check():
    a = load_pending()
    if a is None:
        print('NO_PENDING　下書きはありません')
        return 0
    errs = validate(a, read_posts())
    if errs:
        print('NG　下書きに問題があります')
        for e in errs:
            print('  -', e)
        return 1
    print('OK　公開できます')
    print('  日付 :', a['date'])
    print('  題名 :', a['title'])
    print('  slug :', a['slug'])
    print('  段落 :', len(a['body']), '個')
    return 0


def cmd_publish():
    a = load_pending()
    if a is None:
        print('NO_PENDING　下書きがないため何もしません')
        return 0

    src = read_posts()
    errs = validate(a, src)
    if errs:
        print('NG　公開を中止しました')
        for e in errs:
            print('  -', e)
        return 1

    m = re.search(r'(window\.QM_POSTS\s*=\s*\[)', src)
    if not m:
        print('NG　blog-posts.js の構造が想定と違います')
        return 1

    before = len(re.findall(r'date:\s*"[0-9.]+"', src))
    out = src[:m.end()] + '\n' + js_literal(a) + src[m.end():]

    with io.open(POSTS, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    after = len(re.findall(r'date:\s*"[0-9.]+"', out))
    if after != before + 1:
        print('NG　件数が合いません（%d → %d）' % (before, after))
        return 1

    # 下書きを空にする（二重投稿の防止）
    with io.open(PENDING, 'w', encoding='utf-8', newline='') as f:
        f.write('{}')

    print('PUBLISHED')
    print('  %d本 → %d本' % (before, after))
    print('  題名 :', a['title'])
    print('  URL  : https://qmw.co.jp/blog.html?post=%s' % a['slug'])
    return 0


if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else '--check'
    if arg == '--titles':
        cmd_titles()
    elif arg == '--publish':
        sys.exit(cmd_publish())
    else:
        sys.exit(cmd_check())
