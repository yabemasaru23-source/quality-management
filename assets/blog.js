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

  function renderList(category){
    if(!list) return;
    const filtered = category && category !== "すべて" ? posts.filter(p => p.category === category) : posts;
    list.innerHTML = filtered.map(p => `
      <a class="post reveal on" href="blog.html?post=${encodeURIComponent(p.slug)}">
        <div class="date">${p.date}</div>
        <div><span class="cat">${p.category}</span><h3>${p.title}</h3><p>${p.summary}</p></div>
      </a>
    `).join("");
  }

  function renderArticle(post){
    if(!article || !post) return;
    article.hidden = false;
    if(list) list.closest("section").hidden = true;
    title.textContent = post.title;
    meta.textContent = `${post.date} / ${post.category}`;
    body.innerHTML = post.body.map(t => `<p>${t}</p>`).join("");
    source.innerHTML = post.sourceUrl ? `<a href="${post.sourceUrl}" target="_blank" rel="noopener">${post.sourceLabel || "元投稿を見る"} →</a>` : "";
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
})();
