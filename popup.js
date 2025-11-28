// WebSocket 连接池
const wsConnections = {};
// 价格数据存储
const priceData = {};
// 轮询定时器
let pollingInterval = null;

// 默认币种配置 (全部使用Binance)
const DEFAULT_COINS = {
  'BTCUSDT': { name: 'BTC', fullName: 'Bitcoin', icon: '₿', source: 'binance', tradingPair: 'BTCUSDT' },
  'ETHUSDT': { name: 'ETH', fullName: 'Ethereum', icon: 'Ξ', source: 'binance', tradingPair: 'ETHUSDT' },
  'SOLUSDT': { name: 'SOL', fullName: 'Solana', icon: '◎', source: 'binance', tradingPair: 'SOLUSDT' },
  'BNBUSDT': { name: 'BNB', fullName: 'Binance Coin', icon: '🔶', source: 'binance', tradingPair: 'BNBUSDT' },
  'XRPUSDT': { name: 'XRP', fullName: 'Ripple', icon: '✕', source: 'binance', tradingPair: 'XRPUSDT' },
  'ADAUSDT': { name: 'ADA', fullName: 'Cardano', icon: '₳', source: 'binance', tradingPair: 'ADAUSDT' }
};

// 所有币种
let COINS = {...DEFAULT_COINS};
const CUSTOM_COINS_KEY = 'customCoins';

// 交易所图标映射
const EXCHANGE_ICONS = {
  binance: '🔶',
  okx: '⚫',
  bitget: '🟢',
  mexc: '🔵'
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  console.log('多币种追踪器已加载');

  loadCustomCoins().then(() => {
    renderCoinCards();
    connectAllCoins();

    document.getElementById('refreshBtn').addEventListener('click', () => {
      closeAllConnections();
      connectAllCoins();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'settings.html' });
    });

    initChart();
  });
});

// 为所有代币建立连接
function connectAllCoins() {
  // 按交易所分组
  const coinsByExchange = {
    binance: [],
    okx: [],
    bitget: [],
    mexc: []
  };

  Object.keys(COINS).forEach(symbol => {
    const coin = COINS[symbol];
    const source = coin.source || 'binance';
    if (coinsByExchange[source]) {
      coinsByExchange[source].push({ symbol, ...coin });
    }
  });

  // Binance - 单独WebSocket
  coinsByExchange.binance.forEach(coin => {
    connectBinanceWebSocket(coin.symbol, coin.tradingPair);
  });

  // OKX - 单个WebSocket多订阅
  if (coinsByExchange.okx.length > 0) {
    connectOkxWebSocket(coinsByExchange.okx);
  }

  // Bitget - 单个WebSocket多订阅
  if (coinsByExchange.bitget.length > 0) {
    connectBitgetWebSocket(coinsByExchange.bitget);
  }

  // MEXC - REST API轮询
  if (coinsByExchange.mexc.length > 0) {
    startMexcPolling(coinsByExchange.mexc);
  }
}

// 关闭所有连接
function closeAllConnections() {
  Object.values(wsConnections).forEach(ws => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// ========== Binance WebSocket ==========
function connectBinanceWebSocket(symbol, tradingPair) {
  if (wsConnections[symbol]) {
    wsConnections[symbol].close();
  }

  try {
    const wsSymbol = tradingPair.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`);

    ws.onopen = () => console.log(`Binance WebSocket已连接: ${symbol}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        priceData[symbol] = {
          price: parseFloat(data.c),
          changePercent: parseFloat(data.P),
          change24h: parseFloat(data.p)
        };
        updateCoinCard(symbol);
      } catch (error) {
        console.error(`解析${symbol}数据失败:`, error);
      }
    };

    ws.onerror = () => updateCoinCardError(symbol);
    ws.onclose = () => {
      setTimeout(() => connectBinanceWebSocket(symbol, tradingPair), 3000);
    };

    wsConnections[symbol] = ws;
  } catch (error) {
    console.error(`创建${symbol} WebSocket失败:`, error);
    updateCoinCardError(symbol);
  }
}

// ========== OKX WebSocket ==========
function connectOkxWebSocket(coins) {
  if (wsConnections['okx']) {
    wsConnections['okx'].close();
  }

  try {
    const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

    ws.onopen = () => {
      console.log('OKX WebSocket已连接');
      // 订阅所有代币
      const args = coins.map(coin => ({
        channel: 'tickers',
        instId: coin.tradingPair
      }));
      ws.send(JSON.stringify({ op: 'subscribe', args }));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.data && response.data[0]) {
          const data = response.data[0];
          const instId = data.instId;
          // 找到对应的币种
          const coin = coins.find(c => c.tradingPair === instId);
          if (coin) {
            priceData[coin.symbol] = {
              price: parseFloat(data.last),
              changePercent: parseFloat(data.sodUtc8) ? ((parseFloat(data.last) - parseFloat(data.sodUtc8)) / parseFloat(data.sodUtc8) * 100) : 0,
              change24h: parseFloat(data.last) - parseFloat(data.open24h)
            };
            updateCoinCard(coin.symbol);
          }
        }
      } catch (error) {
        console.error('解析OKX数据失败:', error);
      }
    };

    ws.onerror = () => coins.forEach(c => updateCoinCardError(c.symbol));
    ws.onclose = () => {
      setTimeout(() => connectOkxWebSocket(coins), 3000);
    };

    wsConnections['okx'] = ws;
  } catch (error) {
    console.error('创建OKX WebSocket失败:', error);
    coins.forEach(c => updateCoinCardError(c.symbol));
  }
}

// ========== Bitget WebSocket ==========
function connectBitgetWebSocket(coins) {
  if (wsConnections['bitget']) {
    wsConnections['bitget'].close();
  }

  try {
    const ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');

    ws.onopen = () => {
      console.log('Bitget WebSocket已连接');
      // 订阅所有代币
      const args = coins.map(coin => ({
        instType: 'SPOT',
        channel: 'ticker',
        instId: coin.tradingPair
      }));
      ws.send(JSON.stringify({ op: 'subscribe', args }));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.data && response.data[0]) {
          const data = response.data[0];
          const instId = data.instId;
          const coin = coins.find(c => c.tradingPair === instId);
          if (coin) {
            priceData[coin.symbol] = {
              price: parseFloat(data.lastPr),
              changePercent: parseFloat(data.changeUtc24h) * 100,
              change24h: parseFloat(data.change24h) || 0
            };
            updateCoinCard(coin.symbol);
          }
        }
      } catch (error) {
        console.error('解析Bitget数据失败:', error);
      }
    };

    ws.onerror = () => coins.forEach(c => updateCoinCardError(c.symbol));
    ws.onclose = () => {
      setTimeout(() => connectBitgetWebSocket(coins), 3000);
    };

    wsConnections['bitget'] = ws;
  } catch (error) {
    console.error('创建Bitget WebSocket失败:', error);
    coins.forEach(c => updateCoinCardError(c.symbol));
  }
}

// ========== MEXC REST API 轮询 ==========
function startMexcPolling(coins) {
  fetchMexcPrices(coins);
  pollingInterval = setInterval(() => fetchMexcPrices(coins), 5000);
}

async function fetchMexcPrices(coins) {
  for (const coin of coins) {
    try {
      const response = await fetch(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${coin.tradingPair}`);
      if (response.ok) {
        const data = await response.json();
        priceData[coin.symbol] = {
          price: parseFloat(data.lastPrice),
          changePercent: parseFloat(data.priceChangePercent),
          change24h: parseFloat(data.priceChange)
        };
        updateCoinCard(coin.symbol);
      }
    } catch (error) {
      console.error(`获取MEXC ${coin.symbol}价格失败:`, error);
      updateCoinCardError(coin.symbol);
    }
  }
}

// ========== UI 渲染 ==========
function renderCoinCards() {
  const coinsGrid = document.querySelector('.coins-grid');
  coinsGrid.innerHTML = '';

  Object.keys(COINS).forEach(symbol => {
    const coin = COINS[symbol];
    const card = document.createElement('div');
    card.className = 'coin-card';
    card.id = `card-${symbol}`;

    // 非Binance代币显示交易所标识
    const sourceIndicator = coin.source !== 'binance'
      ? `<span class="source-indicator" title="${coin.source.toUpperCase()}">${EXCHANGE_ICONS[coin.source] || '📊'}</span>`
      : '';

    card.innerHTML = `
      <div class="coin-card-header">
        <span class="coin-card-icon">${coin.icon}</span>
        <span class="coin-card-name">${coin.name}</span>
        ${sourceIndicator}
      </div>
      <div class="coin-card-price" id="price-${symbol}">
        <span class="coin-card-loading">加载中...</span>
      </div>
      <div class="coin-card-change" id="change-${symbol}">
        <span>--</span>
      </div>
    `;

    card.addEventListener('click', () => openChart(symbol));
    coinsGrid.appendChild(card);
  });
}

function updateCoinCard(symbol) {
  const data = priceData[symbol];
  if (!data) return;

  const priceElement = document.getElementById(`price-${symbol}`);
  const changeElement = document.getElementById(`change-${symbol}`);

  if (priceElement && changeElement) {
    priceElement.style.animation = 'none';
    setTimeout(() => {
      priceElement.textContent = `$${formatPrice(data.price)}`;
      priceElement.style.animation = 'priceUpdate 0.2s ease';
    }, 10);

    const isPositive = data.changePercent >= 0;
    changeElement.className = `coin-card-change ${isPositive ? 'positive' : 'negative'}`;
    changeElement.innerHTML = `<span>${isPositive ? '+' : ''}${data.changePercent.toFixed(2)}%</span>`;
  }
}

function updateCoinCardError(symbol) {
  const priceElement = document.getElementById(`price-${symbol}`);
  if (priceElement) {
    priceElement.innerHTML = '<span class="coin-card-loading">连接失败</span>';
  }
}

function formatPrice(price) {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (price >= 1) {
    return price.toFixed(2);
  } else if (price >= 0.01) {
    return price.toFixed(4);
  } else if (price >= 0.0001) {
    return price.toFixed(6);
  } else {
    return price.toFixed(8);
  }
}

// ========== 加载自定义代币 ==========
async function loadCustomCoins() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CUSTOM_COINS_KEY], function(result) {
      const customCoins = result[CUSTOM_COINS_KEY] || [];
      COINS = {...DEFAULT_COINS};

      customCoins.forEach(coin => {
        COINS[coin.symbol] = {
          name: coin.name,
          fullName: `${coin.source.toUpperCase()}: ${coin.tradingPair}`,
          icon: coin.icon || EXCHANGE_ICONS[coin.source] || '🪙',
          source: coin.source || 'binance',
          tradingPair: coin.tradingPair || coin.symbol
        };
      });

      console.log('加载的币种配置:', COINS);
      resolve();
    });
  });
}

// ========== 图表功能 ==========
function initChart() {
  document.getElementById('closeChart').addEventListener('click', closeChart);
}

function openChart(symbol) {
  const chartSection = document.getElementById('chartSection');
  const chartCoinName = document.getElementById('chartCoinName');
  const coin = COINS[symbol];

  chartCoinName.textContent = `${coin.name}/USDT`;
  chartSection.classList.add('expanded');
  loadTradingViewChart(symbol, coin);
}

function closeChart() {
  const chartSection = document.getElementById('chartSection');
  chartSection.classList.remove('expanded');
  setTimeout(() => {
    document.getElementById('tradingview-chart').innerHTML = '';
  }, 400);
}

function loadTradingViewChart(symbol, coin) {
  const container = document.getElementById('tradingview-chart');
  container.innerHTML = '';

  const coinSymbol = coin.name.toUpperCase();
  const source = coin.source || 'binance';

  // 根据交易所选择TradingView符号
  const exchangeMap = {
    binance: `BINANCE:${coinSymbol}USDT`,
    okx: `OKX:${coinSymbol}USDT`,
    bitget: `BITGET:${coinSymbol}USDT`,
    mexc: `MEXC:${coinSymbol}USDT`
  };

  const tvSymbol = exchangeMap[source] || `BINANCE:${coinSymbol}USDT`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px';
  iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=ffffff&studies=%5B%5D&theme=light&style=1&timezone=Asia%2FShanghai&locale=zh_CN`;

  container.appendChild(iframe);
}

// 清理资源
window.addEventListener('beforeunload', closeAllConnections);
