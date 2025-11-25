// WebSocket 连接池
const wsConnections = {};
// 价格数据存储
const priceData = {};

// 默认币种配置
const DEFAULT_COINS = {
  'BTCUSDT': { name: 'BTC', fullName: 'Bitcoin', icon: '₿' },
  'ETHUSDT': { name: 'ETH', fullName: 'Ethereum', icon: 'Ξ' },
  'SOLUSDT': { name: 'SOL', fullName: 'Solana', icon: '◎' },
  'BNBUSDT': { name: 'BNB', fullName: 'Binance Coin', icon: '🔶' },
  'XRPUSDT': { name: 'XRP', fullName: 'Ripple', icon: '✕' },
  'ADAUSDT': { name: 'ADA', fullName: 'Cardano', icon: '₳' }
};

// 所有币种（包括自定义）
let COINS = {...DEFAULT_COINS};
const CUSTOM_COINS_KEY = 'customCoins';

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  console.log('多币种追踪器已加载');

  // 加载自定义代币并初始化界面
  loadCustomCoins().then(() => {
    // 渲染币种卡片
    renderCoinCards();

    // 为所有代币建立 WebSocket 连接
    connectAllCoins();

    // 初始化按钮
    document.getElementById('refreshBtn').addEventListener('click', () => {
      // 重新连接所有 WebSocket
      closeAllConnections();
      connectAllCoins();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      // 打开设置页面
      chrome.tabs.create({ url: 'settings.html' });
    });

    // 初始化图表区域
    initChart();
  });
});

// 为所有代币建立 WebSocket 连接
function connectAllCoins() {
  Object.keys(COINS).forEach(symbol => {
    connectWebSocket(symbol);
  });
}

// 关闭所有 WebSocket 连接
function closeAllConnections() {
  Object.values(wsConnections).forEach(ws => {
    if (ws) {
      ws.close();
    }
  });
}

// 连接单个代币的 WebSocket
function connectWebSocket(symbol) {
  // 关闭旧的连接
  if (wsConnections[symbol]) {
    wsConnections[symbol].close();
  }

  try {
    const wsSymbol = symbol.toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`WebSocket已连接: ${symbol}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // 保存价格数据
        priceData[symbol] = {
          price: parseFloat(data.c),
          changePercent: parseFloat(data.P),
          change24h: parseFloat(data.p)
        };

        // 更新界面
        updateCoinCard(symbol);

      } catch (error) {
        console.error(`解析${symbol}数据失败:`, error);
      }
    };

    ws.onerror = (error) => {
      console.error(`${symbol} WebSocket错误:`, error);
      updateCoinCardError(symbol);
    };

    ws.onclose = () => {
      console.log(`${symbol} WebSocket连接已关闭`);
      // 3秒后自动重连
      setTimeout(() => {
        console.log(`尝试重新连接 ${symbol}...`);
        connectWebSocket(symbol);
      }, 3000);
    };

    wsConnections[symbol] = ws;

  } catch (error) {
    console.error(`创建${symbol} WebSocket失败:`, error);
    updateCoinCardError(symbol);
  }
}

// 渲染币种卡片
function renderCoinCards() {
  const coinsGrid = document.querySelector('.coins-grid');
  coinsGrid.innerHTML = '';

  Object.keys(COINS).forEach(symbol => {
    const coin = COINS[symbol];

    const card = document.createElement('div');
    card.className = 'coin-card';
    card.id = `card-${symbol}`;

    card.innerHTML = `
      <div class="coin-card-header">
        <span class="coin-card-icon">${coin.icon}</span>
        <span class="coin-card-name">${coin.name}</span>
      </div>
      <div class="coin-card-price" id="price-${symbol}">
        <span class="coin-card-loading">加载中...</span>
      </div>
      <div class="coin-card-change" id="change-${symbol}">
        <span>--</span>
      </div>
    `;

    // 添加点击事件
    card.addEventListener('click', () => {
      openChart(symbol);
    });

    coinsGrid.appendChild(card);
  });
}

// 更新币种卡片
function updateCoinCard(symbol) {
  const data = priceData[symbol];
  if (!data) return;

  const priceElement = document.getElementById(`price-${symbol}`);
  const changeElement = document.getElementById(`change-${symbol}`);

  if (priceElement && changeElement) {
    // 更新价格（带动画）
    priceElement.style.animation = 'none';
    setTimeout(() => {
      priceElement.textContent = `$${formatPrice(data.price)}`;
      priceElement.style.animation = 'priceUpdate 0.2s ease';
    }, 10);

    // 更新涨跌幅
    const isPositive = data.changePercent >= 0;
    changeElement.className = `coin-card-change ${isPositive ? 'positive' : 'negative'}`;
    changeElement.innerHTML = `
      <span>${isPositive ? '+' : ''}${data.changePercent.toFixed(2)}%</span>
    `;
  }
}

// 更新币种卡片错误状态
function updateCoinCardError(symbol) {
  const priceElement = document.getElementById(`price-${symbol}`);
  if (priceElement) {
    priceElement.innerHTML = '<span class="coin-card-loading">连接失败</span>';
  }
}

// 格式化价格
function formatPrice(price) {
  if (price >= 1000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } else if (price >= 1) {
    return price.toFixed(2);
  } else if (price >= 0.01) {
    return price.toFixed(4);
  } else {
    return price.toFixed(6);
  }
}

// 清理资源
window.addEventListener('beforeunload', () => {
  closeAllConnections();
});

// 加载自定义代币
async function loadCustomCoins() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CUSTOM_COINS_KEY], function(result) {
      const customCoins = result[CUSTOM_COINS_KEY] || [];

      // 重置 COINS 为默认币种
      COINS = {...DEFAULT_COINS};

      // 添加自定义代币
      customCoins.forEach(coin => {
        COINS[coin.symbol] = {
          name: coin.name,
          fullName: coin.symbol,
          icon: coin.icon || '🪙'
        };
      });

      resolve();
    });
  });
}

// 初始化图表区域
function initChart() {
  const closeBtn = document.getElementById('closeChart');

  // 点击收起按钮
  closeBtn.addEventListener('click', closeChart);
}

// 打开K线图
function openChart(symbol) {
  const chartSection = document.getElementById('chartSection');
  const chartCoinName = document.getElementById('chartCoinName');
  const coin = COINS[symbol];

  // 设置标题
  chartCoinName.textContent = `${coin.name}/USDT`;

  // 展开图表区域
  chartSection.classList.add('expanded');

  // 加载TradingView图表
  loadTradingViewChart(symbol);
}

// 关闭K线图
function closeChart() {
  const chartSection = document.getElementById('chartSection');
  chartSection.classList.remove('expanded');

  // 清空容器
  setTimeout(() => {
    document.getElementById('tradingview-chart').innerHTML = '';
  }, 400); // 等待收起动画完成
}

// 加载TradingView图表（使用iframe方式，白色主题）
function loadTradingViewChart(symbol) {
  // 清空容器
  const container = document.getElementById('tradingview-chart');
  container.innerHTML = '';

  // 获取币种名称（去掉USDT后缀）
  const coinSymbol = symbol.replace('USDT', '');

  // 创建iframe
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';

  // TradingView Widget URL - 使用白色主题
  const widgetUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=BINANCE%3A${coinSymbol}USDT&interval=15&hidesidetoolbar=0&symboledit=0&saveimage=0&toolbarbg=ffffff&studies=%5B%5D&theme=light&style=1&timezone=Asia%2FShanghai&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=zh_CN&utm_source=&utm_medium=widget&utm_campaign=chart&utm_term=BINANCE%3A${coinSymbol}USDT`;

  iframe.src = widgetUrl;

  container.appendChild(iframe);
}
