// 存储键名
const CUSTOM_COINS_KEY = 'customCoins';
const CUSTOM_STOCKS_KEY = 'customStocks';
const API_APPCODE_KEY = 'metalApiAppCode';
const TAB_VISIBILITY_KEY = 'tabVisibility';

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

// 股票市场配置
const STOCK_MARKETS = {
  cn: {
    name: 'A股',
    icon: '🇨🇳',
    // 验证并获取股票信息
    validateUrl: (code) => {
      // 判断上证还是深证
      const prefix = code.startsWith('6') || code.startsWith('5') ? 'sh' : 'sz';
      return `https://qt.gtimg.cn/q=${prefix}${code}`;
    },
    getTradingPair: (code) => {
      const prefix = code.startsWith('6') || code.startsWith('5') ? 'sh' : 'sz';
      return `${prefix}${code}`;
    },
    parseValidation: (text) => {
      const parts = text.split('~');
      if (parts.length > 3 && parts[1]) {
        return { name: parts[1], valid: true };
      }
      return { valid: false };
    }
  },
  hk: {
    name: '港股',
    icon: '🇭🇰',
    validateUrl: (code) => `https://qt.gtimg.cn/q=hk${code.padStart(5, '0')}`,
    getTradingPair: (code) => `hk${code.padStart(5, '0')}`,
    parseValidation: (text) => {
      const parts = text.split('~');
      if (parts.length > 3 && parts[1]) {
        return { name: parts[1], valid: true };
      }
      return { valid: false };
    }
  },
  us: {
    name: '美股',
    icon: '🇺🇸',
    validateUrl: (code) => `https://qt.gtimg.cn/q=us${code.toUpperCase()}`,
    getTradingPair: (code) => `us${code.toUpperCase()}`,
    parseValidation: (text) => {
      const parts = text.split('~');
      if (parts.length > 3 && parts[1]) {
        return { name: parts[1], valid: true };
      }
      return { valid: false };
    }
  }
};

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
  loadCustomStocks();
  loadApiConfig();
  loadTabVisibility();

  // 绑定保存API配置按钮
  const saveApiBtn = document.getElementById('saveApiBtn');
  if (saveApiBtn) {
    saveApiBtn.addEventListener('click', saveApiConfig);
  }

  // 绑定保存页签设置按钮
  const saveTabsBtn = document.getElementById('saveTabsBtn');
  if (saveTabsBtn) {
    saveTabsBtn.addEventListener('click', saveTabVisibility);
  }

  // 绑定添加代币按钮事件
  const addBtn = document.getElementById('addBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addCoin);
  }

  // 绑定添加股票按钮事件
  const addStockBtn = document.getElementById('addStockBtn');
  if (addStockBtn) {
    addStockBtn.addEventListener('click', addStock);
  }

  // 绑定关闭按钮事件
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      window.close();
    });
  }

  // 绑定回车键添加代币
  const symbolInput = document.getElementById('coinSymbol');
  if (symbolInput) {
    symbolInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        addCoin();
      }
    });
  }

  // 绑定回车键添加股票
  const stockInput = document.getElementById('stockCode');
  if (stockInput) {
    stockInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        addStock();
      }
    });
  }

  // 使用事件委托处理删除代币按钮点击
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

  // 使用事件委托处理删除股票按钮点击
  const customStocksList = document.getElementById('customStocksList');
  if (customStocksList) {
    customStocksList.addEventListener('click', function(e) {
      if (e.target.classList.contains('remove-btn')) {
        const stockKey = e.target.dataset.key;
        if (stockKey) {
          removeCustomStock(stockKey);
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

// ==================== 股票相关函数 ====================

// 获取当前选中的股票市场
function getSelectedMarket() {
  const selected = document.querySelector('input[name="stockMarket"]:checked');
  return selected ? selected.value : 'cn';
}

// 验证股票是否存在
async function validateStock(code, market) {
  const config = STOCK_MARKETS[market];
  if (!config) {
    throw new Error('未知的市场');
  }

  const url = config.validateUrl(code);
  console.log(`验证股票 ${code} 在 ${config.name}: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { valid: false };
    }

    // 腾讯API返回GBK编码
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('gbk');
    const text = decoder.decode(buffer);
    return config.parseValidation(text);
  } catch (error) {
    console.error(`验证失败:`, error);
    return { valid: false };
  }
}

// 添加股票
async function addStock() {
  const codeInput = document.getElementById('stockCode');
  const addBtn = document.getElementById('addStockBtn');

  const code = codeInput.value.trim().toUpperCase();
  const market = getSelectedMarket();
  const config = STOCK_MARKETS[market];

  // 隐藏之前的消息
  hideStockMessages();

  // 验证输入
  if (!code) {
    showStockError('请输入股票代码');
    return;
  }

  // 显示加载状态
  addBtn.classList.add('loading');
  addBtn.disabled = true;

  try {
    // 验证股票是否存在
    console.log(`开始验证 ${code} 在 ${config.name}...`);
    const result = await validateStock(code, market);

    if (!result.valid) {
      showStockError(`未找到股票 ${code}，请检查代码是否正确`);
      return;
    }

    // 从 Chrome Storage 获取现有的自定义股票
    chrome.storage.local.get([CUSTOM_STOCKS_KEY], function(storageResult) {
      const customStocks = storageResult[CUSTOM_STOCKS_KEY] || [];

      // 生成唯一key
      const tradingPair = config.getTradingPair(code);
      const stockKey = tradingPair;

      // 检查是否已存在
      if (customStocks.some(stock => stock.symbol === stockKey)) {
        showStockError('该股票已存在');
        addBtn.classList.remove('loading');
        addBtn.disabled = false;
        return;
      }

      // 添加新股票
      const newStock = {
        symbol: stockKey,
        name: result.name || code,
        icon: getRandomIcon(),
        source: market,
        tradingPair: tradingPair,
        type: 'stock'
      };

      customStocks.push(newStock);

      // 保存到 Chrome Storage
      chrome.storage.local.set({ [CUSTOM_STOCKS_KEY]: customStocks }, function() {
        if (chrome.runtime.lastError) {
          showStockError('保存失败：' + chrome.runtime.lastError.message);
          addBtn.classList.remove('loading');
          addBtn.disabled = false;
          return;
        }

        console.log('股票添加成功！', newStock);
        showStockSuccess();

        // 清空输入框
        codeInput.value = '';

        // 重新加载列表
        loadCustomStocks();

        addBtn.classList.remove('loading');
        addBtn.disabled = false;
      });
    });

  } catch (error) {
    console.error('添加股票失败:', error);
    showStockError('验证失败，请稍后重试');
  } finally {
    addBtn.classList.remove('loading');
    addBtn.disabled = false;
  }
}

// 显示股票错误消息
function showStockError(message) {
  const errorMessage = document.getElementById('stockErrorMessage');
  const errorText = document.getElementById('stockErrorText');
  const successMessage = document.getElementById('stockSuccessMessage');

  successMessage.classList.remove('show');
  errorText.textContent = message;
  errorMessage.classList.add('show');

  setTimeout(() => {
    errorMessage.classList.remove('show');
  }, 5000);
}

// 显示股票成功消息
function showStockSuccess() {
  const successMessage = document.getElementById('stockSuccessMessage');
  const errorMessage = document.getElementById('stockErrorMessage');

  errorMessage.classList.remove('show');
  successMessage.classList.add('show');

  setTimeout(() => {
    successMessage.classList.remove('show');
  }, 3000);
}

// 隐藏股票消息
function hideStockMessages() {
  const successEl = document.getElementById('stockSuccessMessage');
  const errorEl = document.getElementById('stockErrorMessage');
  if (successEl) successEl.classList.remove('show');
  if (errorEl) errorEl.classList.remove('show');
}

// 删除自定义股票
function removeCustomStock(stockKey) {
  if (!confirm('确定要删除这个股票吗？')) {
    return;
  }

  chrome.storage.local.get([CUSTOM_STOCKS_KEY], function(result) {
    const customStocks = result[CUSTOM_STOCKS_KEY] || [];
    const updatedStocks = customStocks.filter(stock => stock.symbol !== stockKey);

    chrome.storage.local.set({ [CUSTOM_STOCKS_KEY]: updatedStocks }, function() {
      loadCustomStocks();
    });
  });
}

// 加载并显示自定义股票列表
function loadCustomStocks() {
  console.log('加载自定义股票列表...');
  chrome.storage.local.get([CUSTOM_STOCKS_KEY], function(result) {
    const customStocks = result[CUSTOM_STOCKS_KEY] || [];
    const listContainer = document.getElementById('customStocksList');

    console.log('已加载的股票:', customStocks);

    if (customStocks.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">暂无自定义股票</div>';
      return;
    }

    listContainer.innerHTML = customStocks.map(stock => {
      const config = STOCK_MARKETS[stock.source] || STOCK_MARKETS.cn;
      const sourceLabel = config.name;
      const sourceClass = stock.source;

      return `
        <div class="custom-coin-item">
          <div class="coin-info">
            <div class="coin-symbol">
              ${stock.name}
              <span class="source-badge ${sourceClass}">${sourceLabel}</span>
            </div>
            <div class="coin-full-name">${stock.tradingPair}</div>
          </div>
          <button class="remove-btn" data-key="${stock.symbol}">删除</button>
        </div>
      `;
    }).join('');
  });
}

// ==================== API配置相关函数 ====================

// 加载API配置
function loadApiConfig() {
  chrome.storage.local.get([API_APPCODE_KEY], function(result) {
    const appCode = result[API_APPCODE_KEY] || '';
    const input = document.getElementById('apiAppCode');
    const status = document.getElementById('apiStatus');

    if (input && appCode) {
      input.value = appCode;
      status.innerHTML = '✅ 已配置AppCode';
      status.style.color = '#4CAF50';
    } else if (status) {
      status.innerHTML = '⚠️ 未配置AppCode，贵金属价格将无法显示';
      status.style.color = '#ff9800';
    }
  });
}

// 保存API配置
function saveApiConfig() {
  const input = document.getElementById('apiAppCode');
  const appCode = input.value.trim();
  const successMsg = document.getElementById('apiSuccessMessage');
  const status = document.getElementById('apiStatus');

  if (!appCode) {
    status.innerHTML = '❌ 请输入AppCode';
    status.style.color = '#f44336';
    return;
  }

  chrome.storage.local.set({ [API_APPCODE_KEY]: appCode }, function() {
    successMsg.classList.add('show');
    status.innerHTML = '✅ 已配置AppCode';
    status.style.color = '#4CAF50';

    setTimeout(() => {
      successMsg.classList.remove('show');
    }, 3000);
  });
}

// ==================== 页签显示设置 ====================

// 加载页签显示设置
function loadTabVisibility() {
  chrome.storage.local.get([TAB_VISIBILITY_KEY], function(result) {
    const visibility = result[TAB_VISIBILITY_KEY] || { crypto: true, stock: true, metal: true };

    const cryptoCheckbox = document.getElementById('showCrypto');
    const stockCheckbox = document.getElementById('showStock');
    const metalCheckbox = document.getElementById('showMetal');

    if (cryptoCheckbox) cryptoCheckbox.checked = visibility.crypto !== false;
    if (stockCheckbox) stockCheckbox.checked = visibility.stock !== false;
    if (metalCheckbox) metalCheckbox.checked = visibility.metal !== false;
  });
}

// 保存页签显示设置
function saveTabVisibility() {
  const cryptoCheckbox = document.getElementById('showCrypto');
  const stockCheckbox = document.getElementById('showStock');
  const metalCheckbox = document.getElementById('showMetal');
  const successMsg = document.getElementById('tabsSuccessMessage');

  const visibility = {
    crypto: cryptoCheckbox.checked,
    stock: stockCheckbox.checked,
    metal: metalCheckbox.checked
  };

  // 至少选择一个
  if (!visibility.crypto && !visibility.stock && !visibility.metal) {
    alert('至少需要选择一个页签显示');
    return;
  }

  chrome.storage.local.set({ [TAB_VISIBILITY_KEY]: visibility }, function() {
    successMsg.classList.add('show');
    setTimeout(() => {
      successMsg.classList.remove('show');
    }, 3000);
  });
}

// ==================== 配置导入导出 ====================

const COINS_ORDER_KEY = 'coinsOrder';
const STOCKS_ORDER_KEY = 'stocksOrder';

// 初始化导入导出按钮
document.addEventListener('DOMContentLoaded', function() {
  // 导出按钮
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportConfig);
  }

  // 导入按钮 - 点击触发文件选择
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', function() {
      importFile.click();
    });
    importFile.addEventListener('change', importConfig);
  }
});

// 导出配置
function exportConfig() {
  chrome.storage.local.get([
    CUSTOM_COINS_KEY,
    CUSTOM_STOCKS_KEY,
    COINS_ORDER_KEY,
    STOCKS_ORDER_KEY,
    TAB_VISIBILITY_KEY,
    API_APPCODE_KEY
  ], function(result) {
    const config = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      data: {
        customCoins: result[CUSTOM_COINS_KEY] || [],
        customStocks: result[CUSTOM_STOCKS_KEY] || [],
        coinsOrder: result[COINS_ORDER_KEY] || [],
        stocksOrder: result[STOCKS_ORDER_KEY] || [],
        tabVisibility: result[TAB_VISIBILITY_KEY] || { crypto: true, stock: true, metal: true },
        metalApiAppCode: result[API_APPCODE_KEY] || ''
      }
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crypto-tracker-config-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showBackupSuccess('配置已导出');
  });
}

// 导入配置
function importConfig(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const config = JSON.parse(e.target.result);

      if (!config.data) {
        showBackupError('无效的配置文件格式');
        return;
      }

      const coinCount = (config.data.customCoins || []).length;
      const stockCount = (config.data.customStocks || []).length;
      const msg = '确定要导入配置吗？\n\n将导入：\n- ' + coinCount + ' 个自定义代币\n- ' + stockCount + ' 个自定义股票\n- 页签显示设置\n- 排序设置\n\n注意：这将覆盖当前的所有设置！';

      if (!confirm(msg)) {
        event.target.value = '';
        return;
      }

      const saveData = {};
      if (config.data.customCoins) saveData[CUSTOM_COINS_KEY] = config.data.customCoins;
      if (config.data.customStocks) saveData[CUSTOM_STOCKS_KEY] = config.data.customStocks;
      if (config.data.coinsOrder) saveData[COINS_ORDER_KEY] = config.data.coinsOrder;
      if (config.data.stocksOrder) saveData[STOCKS_ORDER_KEY] = config.data.stocksOrder;
      if (config.data.tabVisibility) saveData[TAB_VISIBILITY_KEY] = config.data.tabVisibility;
      if (config.data.metalApiAppCode) saveData[API_APPCODE_KEY] = config.data.metalApiAppCode;

      chrome.storage.local.set(saveData, function() {
        if (chrome.runtime.lastError) {
          showBackupError('导入失败：' + chrome.runtime.lastError.message);
          return;
        }

        showBackupSuccess('配置导入成功！页面将刷新...');
        setTimeout(function() { location.reload(); }, 1500);
      });

    } catch (err) {
      showBackupError('配置文件解析失败：' + err.message);
    }
  };

  reader.readAsText(file);
  event.target.value = '';
}

// 显示备份成功消息
function showBackupSuccess(message) {
  const successMsg = document.getElementById('backupSuccessMessage');
  const successText = document.getElementById('backupSuccessText');
  const errorMsg = document.getElementById('backupErrorMessage');

  if (errorMsg) errorMsg.classList.remove('show');
  if (successText) successText.textContent = message;
  if (successMsg) {
    successMsg.classList.add('show');
    setTimeout(function() { successMsg.classList.remove('show'); }, 3000);
  }
}

// 显示备份错误消息
function showBackupError(message) {
  const errorMsg = document.getElementById('backupErrorMessage');
  const errorText = document.getElementById('backupErrorText');
  const successMsg = document.getElementById('backupSuccessMessage');

  if (successMsg) successMsg.classList.remove('show');
  if (errorText) errorText.textContent = message;
  if (errorMsg) {
    errorMsg.classList.add('show');
    setTimeout(function() { errorMsg.classList.remove('show'); }, 5000);
  }
}
