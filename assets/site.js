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
