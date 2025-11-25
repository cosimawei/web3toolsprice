// 存储键名
const CUSTOM_COINS_KEY = 'customCoins';

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
  console.log('设置页面已加载');
  loadCustomCoins();

  // 绑定添加按钮事件
  const addBtn = document.querySelector('.add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', addCustomCoin);
  }

  // 绑定关闭按钮事件
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      window.close();
    });
  }

  // 使用事件委托处理删除按钮点击
  const customCoinsList = document.getElementById('customCoinsList');
  if (customCoinsList) {
    customCoinsList.addEventListener('click', function(e) {
      if (e.target.classList.contains('remove-btn')) {
        const tradingPair = e.target.dataset.symbol;
        if (tradingPair) {
          removeCustomCoin(tradingPair);
        }
      }
    });
  }
});

// 添加自定义代币
function addCustomCoin() {
  console.log('开始添加自定义代币...');

  const symbolInput = document.getElementById('coinSymbol');
  const tradingPairInput = document.getElementById('tradingPair');

  const symbol = symbolInput.value.trim().toUpperCase();
  const tradingPair = tradingPairInput.value.trim().toUpperCase();

  console.log('代币符号:', symbol);
  console.log('交易对:', tradingPair);

  // 验证输入
  if (!symbol || !tradingPair) {
    alert('请填写完整的代币信息');
    return;
  }

  // 验证交易对格式
  if (!tradingPair.endsWith('USDT')) {
    alert('交易对必须以USDT结尾，如：DOGEUSDT');
    return;
  }

  // 从 Chrome Storage 获取现有的自定义代币
  chrome.storage.local.get([CUSTOM_COINS_KEY], function(result) {
    const customCoins = result[CUSTOM_COINS_KEY] || [];
    console.log('现有代币:', customCoins);

    // 检查是否已存在
    if (customCoins.some(coin => coin.symbol === tradingPair)) {
      alert('该代币已存在');
      return;
    }

    // 添加新代币
    const newCoin = {
      symbol: tradingPair,
      name: symbol,
      icon: '🪙'  // 默认图标
    };

    customCoins.push(newCoin);
    console.log('添加后的代币列表:', customCoins);

    // 保存到 Chrome Storage
    chrome.storage.local.set({ [CUSTOM_COINS_KEY]: customCoins }, function() {
      if (chrome.runtime.lastError) {
        console.error('保存失败:', chrome.runtime.lastError);
        alert('保存失败：' + chrome.runtime.lastError.message);
        return;
      }

      console.log('代币添加成功！');

      // 显示成功消息
      const successMessage = document.getElementById('successMessage');
      successMessage.classList.add('show');
      setTimeout(() => {
        successMessage.classList.remove('show');
      }, 3000);

      // 清空输入框
      symbolInput.value = '';
      tradingPairInput.value = '';

      // 重新加载列表
      loadCustomCoins();
    });
  });
}

// 删除自定义代币
function removeCustomCoin(tradingPair) {
  if (!confirm('确定要删除这个代币吗？')) {
    return;
  }

  chrome.storage.local.get([CUSTOM_COINS_KEY], function(result) {
    const customCoins = result[CUSTOM_COINS_KEY] || [];
    const updatedCoins = customCoins.filter(coin => coin.symbol !== tradingPair);

    chrome.storage.local.set({ [CUSTOM_COINS_KEY]: updatedCoins }, function() {
      loadCustomCoins();
    });
  });
}

// 加载并显示自定义代币列表
function loadCustomCoins() {
  console.log('加载自定义代币列表...');
  chrome.storage.local.get([CUSTOM_COINS_KEY], function(result) {
    const customCoins = result[CUSTOM_COINS_KEY] || [];
    const listContainer = document.getElementById('customCoinsList');

    console.log('已加载的代币:', customCoins);

    // 同步到 localStorage 以便主页面可以快速访问
    localStorage.setItem(CUSTOM_COINS_KEY, JSON.stringify(customCoins));

    if (customCoins.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">暂无自定义代币</div>';
      return;
    }

    listContainer.innerHTML = customCoins.map(coin => `
      <div class="custom-coin-item">
        <div class="coin-info">
          <div class="coin-symbol">${coin.name}</div>
          <div class="coin-full-name">${coin.symbol}</div>
        </div>
        <button class="remove-btn" data-symbol="${coin.symbol}">删除</button>
      </div>
    `).join('');
  });
}
