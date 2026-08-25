(function(){
  const posts = window.QM_POSTS || [];
  const list = document.getElementById("postList");
  const article = document.getElementById("postArticle");
  const title = document.getElementById("postTitle");
  const meta = document.getElementById("postMeta");
  const body = document.getElementById("postBody");
  const source = document.getElementById("postSource");
  const params = new URLSearchParams(location.search);
  const slug = params.get("post");

  const CAT_THUMB = {
    "お知らせ":     "assets/cat-oshirase.svg",
    "時間コラム":   "assets/cat-jikan.svg",
    "経営コラム":   "assets/cat-keiei.svg",
    "AI活用":       "assets/cat-ai.svg",
    "感動セールス": "assets/cat-kando.svg"
  };

  function postVisual(p){
    const src = p.thumb || CAT_THUMB[p.category] || "assets/cat-keiei.svg";
    return `<img class="p-thumb" src="${src}" alt="" loading="lazy">`;
  }

  // 記事の日付が直近何日以内かで NEW を出す
  function isNew(p){
    const d = String(p.date || "").split(".");
    if(d.length !== 3) return false;
    const t = new Date(+d[0], +d[1] - 1, +d[2]).getTime();
    return (Date.now() - t) / 86400000 <= 3;
  }

  function renderList(category){
    if(!list) return;
    const filtered = category && category !== "すべて" ? posts.filter(p => p.category === category) : posts;
    list.innerHTML = filtered.map(p => `
      <a class="post reveal on" href="blog.html?post=${encodeURIComponent(p.slug)}">
        ${isNew(p) ? '<span class="newflag">NEW</span>' : ''}
        ${postVisual(p)}
        <div><div class="date" style="flex:none;margin-bottom:4px">${p.date}</div><span class="cat">${p.category}</span><h3>${p.title}</h3><p>${p.summary}</p></div>
      </a>
    `).join("");
  }

  const LINE_URL = "https://line.me/R/ti/p/%40171hzbls";

  function feedbackCta(post){
    const slug = String(post.slug || "").replace(/"/g, "");
    return `
      <div class="blog-feedback">
        <p class="bf-lead">この記事は、お役に立ちましたか。</p>
        <p class="bf-sub">ひと言の感想が、次の記事の力になります。「記事のタイトル＋ひと言」でお気軽にお送りください。</p>
        <a href="${LINE_URL}" target="_blank" rel="noopener" class="btn btn-line"
           onclick="if(window.gtag)gtag('event','blog_feedback_click',{post_slug:'${slug}'});">LINEで感想をひと言 →</a>
      </div>`;
  }

  // 本文の文字数から読了時間を出す（日本語は毎分およそ600字）
  function readMinutes(post){
    const chars = (post.body || []).join("").replace(/<[^>]*>/g, "").length;
    return Math.max(1, Math.round(chars / 600));
  }

  // すでにHTMLブロックとして書かれた要素は <p> で包まない
  function wrapBody(t){
    return /^\s*<(div|figure|blockquote|section|ul|ol|table|h[2-6]|p)\b/i.test(t) ? t : `<p>${t}</p>`;
  }

  // 前後の記事（配列は新しい順）
  function postNav(post){
    const i = posts.indexOf(post);
    if(i < 0) return "";
    const newer = i > 0 ? posts[i - 1] : null;
    const older = i < posts.length - 1 ? posts[i + 1] : null;
    if(!newer && !older) return "";
    const cell = (p, label, cls) => p
      ? `<a class="${cls}" href="blog.html?post=${encodeURIComponent(p.slug)}">
           <div class="lb">${label}</div><div class="tt">${p.title}</div></a>`
      : `<span></span>`;
    return `<div class="post-nav">
      ${cell(older, "◀ 前の記事", "pv")}
      ${cell(newer, "次の記事 ▶", "nx")}
    </div>`;
  }

  function renderArticle(post){
    if(!article || !post) return;
    article.hidden = false;
    if(list) list.closest("section").hidden = true;
    title.textContent = post.title;

    // ヘッダー（カテゴリ・日付・読了時間・リード文）
    meta.innerHTML = `<div class="art-tags">
        <span class="art-cat">${post.category}</span>
        <span class="art-date">${post.date}</span>
        <span class="art-read">およそ${readMinutes(post)}分で読めます</span>
        ${isNew(post) ? '<span class="art-new">NEW</span>' : ''}
      </div>`;
    const heroWrap = document.getElementById("artHero");
    if(heroWrap && post.summary){
      heroWrap.innerHTML = `<div class="art-lead">${post.summary}</div>`;
    }

    body.innerHTML = post.body.map(wrapBody).join("");
    const srcHtml = post.sourceUrl ? `<a href="${post.sourceUrl}" target="_blank" rel="noopener">${post.sourceLabel || "元投稿を見る"} →</a>` : "";
    source.innerHTML = srcHtml + feedbackCta(post) + postNav(post);

    // 読了プログレスバー
    const bar = document.createElement("div");
    bar.className = "read-bar";
    document.body.appendChild(bar);
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0) + "%";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const fullTitle = post.title + "｜" + post.category + "｜株式会社クオリティマネジメント";
    document.title = fullTitle;
    const descTag = document.querySelector('meta[name="description"]');
    if(descTag) descTag.setAttribute("content", post.summary || post.title);
    if(window.gtag){
      gtag("event", "page_view", {
        page_title: fullTitle,
        page_location: location.href,
        page_path: location.pathname + location.search
      });
    }
  }

  document.querySelectorAll("[data-cat]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-cat]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderList(btn.dataset.cat);
    });
  });

  const current = slug ? posts.find(p => p.slug === slug) : null;
  if(current){
    renderArticle(current);
  } else if(window.gtag){
    gtag("event", "page_view", {
      page_title: document.title,
      page_location: location.href,
      page_path: location.pathname + location.search
    });
  }
  renderList("すべて");

  const latest = posts[0];
  if(latest){
    const lastUpdateLine = document.getElementById("lastUpdateLine");
    if(lastUpdateLine){
      lastUpdateLine.innerHTML = `<strong style="color:var(--blue)">最終更新：${latest.date}</strong>　「${latest.title}」を追加しました`;
    }
    const decoDate = document.getElementById("decoDate");
    const decoTitle = document.getElementById("decoTitle");
    const latestDeco = document.getElementById("latestDeco");
    if(decoDate) decoDate.textContent = latest.date;
    if(decoTitle) decoTitle.textContent = latest.title.length > 26 ? latest.title.slice(0, 26) + "…" : latest.title;
    if(latestDeco) latestDeco.href = "blog.html?post=" + encodeURIComponent(latest.slug);
  }
})();
