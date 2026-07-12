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

  const CAT_ICON = {
    "お知らせ":       { emoji: "📢", bg: "#e8f1ff", ring: "#1f86ff" },
    "時間コラム":     { emoji: "⏰", bg: "#fff4e0", ring: "#e8a020" },
    "経営コラム":     { emoji: "🧭", bg: "#e9f8ef", ring: "#1ea862" },
    "AI活用":         { emoji: "🤖", bg: "#f0eaff", ring: "#7a5cd6" },
    "感動セールス":   { emoji: "❤️‍🔥", bg: "#ffecef", ring: "#e0506a" }
  };

  function postVisual(p){
    if(p.thumb){
      return `<img class="p-thumb" src="${p.thumb}" alt="" loading="lazy">`;
    }
    const ic = CAT_ICON[p.category] || { emoji: "✍️", bg: "#eef5ff", ring: "#1f86ff" };
    return `<div class="p-ico" style="background:${ic.bg};box-shadow:inset 0 0 0 1.5px ${ic.ring}33">${ic.emoji}</div>`;
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
