// スクロール時のヘッダーシャドウ
window.addEventListener('scroll', () => {
  const header = document.querySelector('.header');
  if (window.scrollY > 10) {
    header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
  } else {
    header.style.boxShadow = 'none';
  }
});

// スクロールアニメーション
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .step, .pricing-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// フォーム送信
function handleSubmit(e) {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const btn = e.target.querySelector('button');
  btn.textContent = '送信しました！';
  btn.style.background = '#28C840';
  input.value = '';
  setTimeout(() => {
    btn.textContent = '無料トライアルを開始';
    btn.style.background = '';
  }, 3000);
}
