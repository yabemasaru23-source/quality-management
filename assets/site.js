// 共通スクリプト（全ページ共有）

// ハンバーガーメニュー
const menuBtn = document.getElementById('menuBtn');
const navMenu = document.getElementById('navMenu');
if (menuBtn && navMenu) {
  menuBtn.addEventListener('click', () => navMenu.classList.toggle('open'));
  navMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navMenu.classList.remove('open')));
}

// スクロールで出現
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ヘッダー影
const hdr = document.querySelector('header');
if (hdr) window.addEventListener('scroll', () => {
  hdr.style.boxShadow = window.scrollY > 10 ? '0 6px 24px rgba(6,47,99,.08)' : 'none';
});

// FAQ アコーディオン
document.querySelectorAll('.faq-q').forEach(q => {
  q.addEventListener('click', () => q.parentElement.classList.toggle('open'));
});

/* サービスのドロップダウン：いま見ているサービスに「表示中」を出す */
(function(){
  var svc = document.body.getAttribute('data-svc');
  if (!svc) {
    // トップページ内のアンカー（#ai / #works）にいるときも拾う
    var h = location.hash.replace('#','');
    if (h === 'ai' || h === 'works') svc = h;
  }
  if (!svc) return;
  var a = document.querySelector('.drop a[data-svc="' + svc + '"]');
  if (a) a.classList.add('current');
})();
