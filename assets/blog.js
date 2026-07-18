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

  function renderList(category){
    if(!list) return;
    const filtered = category && category !== "すべて" ? posts.filter(p => p.category === category) : posts;
    list.innerHTML = filtered.map(p => `
      <a class="post reveal on" href="blog.html?post=${encodeURIComponent(p.slug)}">
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

  function renderArticle(post){
    if(!article || !post) return;
    article.hidden = false;
    if(list) list.closest("section").hidden = true;
    title.textContent = post.title;
    meta.textContent = `${post.date} / ${post.category}`;
    body.innerHTML = post.body.map(t => `<p>${t}</p>`).join("");
    const srcHtml = post.sourceUrl ? `<a href="${post.sourceUrl}" target="_blank" rel="noopener">${post.sourceLabel || "元投稿を見る"} →</a>` : "";
    source.innerHTML = srcHtml + feedbackCta(post);
  }

  document.querySelectorAll("[data-cat]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-cat]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderList(btn.dataset.cat);
    });
  });

  const current = slug ? posts.find(p => p.slug === slug) : null;
  if(current) renderArticle(current);
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
