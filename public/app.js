// 应用入口：路由切换 + 各模块初始化
// 路由策略：根据 URL hash 切换页面（#cards / #goods）

// 通用：所有 data-close="xxx" 按钮 → 关闭对应 modal
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-close]');
  if (target) {
    window.App.closeModal(target.dataset.close);
  }
});
// 点击遮罩关闭弹窗
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});

// 路由切换：根据 hash 显示对应页面，更新侧边栏激活状态
function switchPage(page) {
  // 默认到 cards
  const validPages = ['cards', 'goods', 'send-card', 'send-card-batch', 'send-gold', 'send-gold-batch', 'send-exp', 'live-study-migrate', 'coupons', 'coupon-grant', 'user-coupons'];
  if (!validPages.includes(page)) page = 'cards';

  document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
  document.getElementById('page-' + page).classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // 切换到该页时再拉数据，避免无谓的初始请求
  if (page === 'cards') window.Cards.loadCardList();
  if (page === 'goods') window.Goods.loadGoodsList();
  if (page === 'coupons') window.Coupon.loadCouponList();
  if (page === 'coupon-grant') {
    window.CouponGrant.loadGrantOptions();
    window.CouponGrant.loadBatchList();
  }
  if (page === 'user-coupons') window.UserCoupon.loadUserCouponList();
}

function currentPageFromHash() {
  // hash 形如 "#cards" → "cards"
  return (location.hash || '#cards').slice(1);
}

window.addEventListener('hashchange', () => {
  switchPage(currentPageFromHash());
});

// 启动
window.Cards.initCards();
window.Goods.initGoods();
window.SendCard.initSendCard();
window.SendCardBatch.initSendCardBatch();
window.SendGold.initSendGold();
window.SendGoldBatch.initSendGoldBatch();
window.SendExp.initSendExp();
window.LiveStudyMigrate.initLiveStudyMigrate();
window.Coupon.initCouponPage();
window.CouponGrant.initGrantPage();
window.UserCoupon.initUserCouponPage();
switchPage(currentPageFromHash());
