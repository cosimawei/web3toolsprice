// 存储键名
const CUSTOM_COINS_KEY = 'customCoins';

// 随机图标池
const RANDOM_ICONS = [
  '🪙', '💎', '🔷', '🔸', '⭐', '🌟', '✨', '💫',
  '🚀', '🌙', '☀️', '🔥', '💰', '💵', '💴', '💶',
  '🏆', '👑', '💠', '🔮', '🎯', '🎲', '🎰', '🃏',
  '⚡', '💥', '🌈', '🦄', '🐉', '🦅', '🦁', '🐯',
  '🌀', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚪',
  '♦️', '♠️', '♣️', '♥️', '🎵', '🎶', '🔑', '🗝️'
];

// 获取随机图标
function getRandomIcon() {
  return RANDOM_ICONS[Math.floor(Math.random() * RANDOM_ICONS.length)];
}

// 交易所配置
const EXCHANGES = {
  binance: {
    name: 'Binance',
    icon: '🔶',
    // 验证代币是否存在
    validateUrl: (symbol) => `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`,
    // 生成交易对
    getTradingPair: (symbol) => `${symbol}USDT`,
    // 解析验证响应
    parseValidation: (data) => data && data.price
  },
  okx: {
    name: 'OKX',
    icon: '⚫',
    validateUrl: (symbol) => `https://www.okx.com/api/v5/market/ticker?instId=${symbol}-USDT`,
    getTradingPair: (symbol) => `${symbol}-USDT`,
    parseValidation: (data) => data && data.data && data.data.length > 0
  },
  bitget: {
    name: 'Bitget',
    icon: '🟢',
    validateUrl: (symbol) => `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${symbol}USDT`,
    getTradingPair: (symbol) => `${symbol}USDT`,
    parseValidation: (data) => data && data.data && data.data.length > 0
  },
  mexc: {
    name: 'MEXC',
    icon: '🔵',
    validateUrl: (symbol) => `https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}USDT`,
    getTradingPair: (symbol) => `${symbol}USDT`,
    parseValidation: (data) => data && data.price
  }
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
  console.log('设置页面已加载');
  loadCustomCoins();

  // 绑定添加按钮事件
  const addBtn = document.getElementById('addBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addCoin);
  }

  // 绑定关闭按钮事件
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      window.close();
    });
  }

  // 绑定回车键添加
  const symbolInput = document.getElementById('coinSymbol');
  if (symbolInput) {
    symbolInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        addCoin();
      }
    });
  }

  // 使用事件委托处理删除按钮点击
  const customCoinsList = document.getElementById('customCoinsList');
  if (customCoinsList) {
    customCoinsList.addEventListener('click', function(e) {
      if (e.target.classList.contains('remove-btn')) {
        const coinKey = e.target.dataset.key;
        if (coinKey) {
          removeCustomCoin(coinKey);
        }
      }
    });
  }
});

// 获取当前选中的交易所
function getSelectedExchange() {
  const selected = document.querySelector('input[name="dataSource"]:checked');
  return selected ? selected.value : 'binance';
}

// 验证代币是否在交易所存在
async function validateCoin(symbol, exchange) {
  const config = EXCHANGES[exchange];
  if (!config) {
    throw new Error('未知的交易所');
  }

  const url = config.validateUrl(symbol);
  console.log(`验证代币 ${symbol} 在 ${config.name}: ${url}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      // 对于某些交易所，404表示代币不存在
      if (response.status === 400 || response.status === 404) {
        return false;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return config.parseValidation(data);
  } catch (error) {
    console.error(`验证失败:`, error);
    // 网络错误时，可能是CORS问题，尝试备用方案
    return null; // null表示无法验证，但不一定不存在
  }
}

// 添加代币
async function addCoin() {
  const symbolInput = document.getElementById('coinSymbol');
  const addBtn = document.getElementById('addBtn');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

  const symbol = symbolInput.value.trim().toUpperCase();
  const exchange = getSelectedExchange();
  const config = EXCHANGES[exchange];

  // 隐藏之前的消息
  hideMessages();

  // 验证输入
  if (!symbol) {
    showError('请输入代币符号');
    return;
  }

  // 检查格式
  if (!/^[A-Z0-9]+$/.test(symbol)) {
    showError('代币符号只能包含字母和数字');
    return;
  }

  // 显示加载状态
  addBtn.classList.add('loading');
  addBtn.disabled = true;

  try {
    // 验证代币是否存在
    console.log(`开始验证 ${symbol} 在 ${config.name}...`);
    const exists = await validateCoin(symbol, exchange);

    if (exists === false) {
      showError(`${config.name} 不支持 ${symbol} 代币`);
      return;
    }

    if (exists === null) {
      // 无法验证（可能是CORS），提示用户但允许添加
      console.warn('无法验证代币，可能是CORS限制');
    }

    // 从 Chrome Storage 获取现有的自定义代币
    chrome.storage.local.get([CUSTOM_COINS_KEY], function(result) {
      const customCoins = result[CUSTOM_COINS_KEY] || [];

      // 生成唯一key
      const tradingPair = config.getTradingPair(symbol);
      const coinKey = exchange === 'binance' ? tradingPair : `${exchange.toUpperCase()}_${tradingPair.replace('-', '')}`;

      // 检查是否已存在
      if (customCoins.some(coin => coin.symbol === coinKey)) {
        showError('该代币已存在');
        addBtn.classList.remove('loading');
        addBtn.disabled = false;
        return;
      }

      // 添加新代币
      const newCoin = {
        symbol: coinKey,
        name: symbol,
        icon: getRandomIcon(),
        source: exchange,
        tradingPair: tradingPair
      };

      customCoins.push(newCoin);

      // 保存到 Chrome Storage
      chrome.storage.local.set({ [CUSTOM_COINS_KEY]: customCoins }, function() {
        if (chrome.runtime.lastError) {
          showError('保存失败：' + chrome.runtime.lastError.message);
          addBtn.classList.remove('loading');
          addBtn.disabled = false;
          return;
        }

        console.log('代币添加成功！', newCoin);
        showSuccess();

        // 清空输入框
        symbolInput.value = '';

        // 重新加载列表
        loadCustomCoins();

        addBtn.classList.remove('loading');
        addBtn.disabled = false;
      });
    });

  } catch (error) {
    console.error('添加代币失败:', error);
    showError('验证失败，请稍后重试');
  } finally {
    addBtn.classList.remove('loading');
    addBtn.disabled = false;
  }
}

// 显示错误消息
function showError(message) {
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  const successMessage = document.getElementById('successMessage');

  successMessage.classList.remove('show');
  errorText.textContent = message;
  errorMessage.classList.add('show');

  setTimeout(() => {
    errorMessage.classList.remove('show');
  }, 5000);
}

// 显示成功消息
function showSuccess() {
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');

  errorMessage.classList.remove('show');
  successMessage.classList.add('show');

  setTimeout(() => {
    successMessage.classList.remove('show');
  }, 3000);
}

// 隐藏所有消息
function hideMessages() {
  document.getElementById('successMessage').classList.remove('show');
  document.getElementById('errorMessage').classList.remove('show');
}

// 删除自定义代币
function removeCustomCoin(coinKey) {
  if (!confirm('确定要删除这个代币吗？')) {
    return;
  }

  chrome.storage.local.get([CUSTOM_COINS_KEY], function(result) {
    const customCoins = result[CUSTOM_COINS_KEY] || [];
    const updatedCoins = customCoins.filter(coin => coin.symbol !== coinKey);

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

    listContainer.innerHTML = customCoins.map(coin => {
      const config = EXCHANGES[coin.source] || EXCHANGES.binance;
      const sourceLabel = config.name;
      const sourceClass = coin.source;
      const displayInfo = coin.tradingPair || coin.symbol;

      return `
        <div class="custom-coin-item">
          <div class="coin-info">
            <div class="coin-symbol">
              ${coin.name}
              <span class="source-badge ${sourceClass}">${sourceLabel}</span>
            </div>
            <div class="coin-full-name">${displayInfo}</div>
          </div>
          <button class="remove-btn" data-key="${coin.symbol}">删除</button>
        </div>
      `;
    }).join('');
  });
}
