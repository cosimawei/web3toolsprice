// ==================== 全局变量 ====================
const wsConnections = {};
const priceData = {};
let pollingIntervals = {};
let draggedElement = null;
let currentTab = 'crypto';

// ==================== 存储键 ====================
const CUSTOM_COINS_KEY = 'customCoins';
const CUSTOM_STOCKS_KEY = 'customStocks';
const COINS_ORDER_KEY = 'coinsOrder';
const STOCKS_ORDER_KEY = 'stocksOrder';

// ==================== 默认数据 ====================
// 虚拟币
const DEFAULT_CRYPTO = [
  { symbol: 'BTCUSDT', name: 'BTC', fullName: 'Bitcoin', icon: '₿', source: 'binance', tradingPair: 'BTCUSDT', type: 'crypto' },
  { symbol: 'ETHUSDT', name: 'ETH', fullName: 'Ethereum', icon: 'Ξ', source: 'binance', tradingPair: 'ETHUSDT', type: 'crypto' },
  { symbol: 'SOLUSDT', name: 'SOL', fullName: 'Solana', icon: '◎', source: 'binance', tradingPair: 'SOLUSDT', type: 'crypto' },
  { symbol: 'BNBUSDT', name: 'BNB', fullName: 'Binance Coin', icon: '🔶', source: 'binance', tradingPair: 'BNBUSDT', type: 'crypto' },
  { symbol: 'XRPUSDT', name: 'XRP', fullName: 'Ripple', icon: '✕', source: 'binance', tradingPair: 'XRPUSDT', type: 'crypto' },
  { symbol: 'ADAUSDT', name: 'ADA', fullName: 'Cardano', icon: '₳', source: 'binance', tradingPair: 'ADAUSDT', type: 'crypto' }
];

// 贵金属（固定）
const DEFAULT_METALS = [
  { symbol: 'XAUUSD', name: '黄金', fullName: 'Gold', icon: '🥇', source: 'metal', tradingPair: 'XAUUSD', type: 'metal' },
  { symbol: 'XAGUSD', name: '白银', fullName: 'Silver', icon: '🥈', source: 'metal', tradingPair: 'XAGUSD', type: 'metal' }
];

// 数据列表
let cryptoList = [];
let stockList = [];
let metalList = [...DEFAULT_METALS];

// 交易所图标
const EXCHANGE_ICONS = { binance: '🔶', okx: '⚫', bitget: '🟢', mexc: '🔵' };

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
  console.log('多资产追踪器已加载');

  // Tab 切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 按钮
  document.getElementById('refreshBtn').addEventListener('click', refreshAll);
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'settings.html' });
  });

  // 图表
  document.getElementById('closeChart').addEventListener('click', closeChart);

  // 加载数据
  loadAllData().then(() => {
    renderAllPanels();
    connectAll();
  });
});

// ==================== Tab 切换 ====================
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tab}`);
  });
  closeChart();
}

// ==================== 加载数据 ====================
async function loadAllData() {
  return new Promise(resolve => {
    chrome.storage.local.get([CUSTOM_COINS_KEY, CUSTOM_STOCKS_KEY, COINS_ORDER_KEY, STOCKS_ORDER_KEY], result => {
      // 虚拟币
      const customCoins = result[CUSTOM_COINS_KEY] || [];
      const coinsOrder = result[COINS_ORDER_KEY] || [];
      cryptoList = buildOrderedList(DEFAULT_CRYPTO, customCoins, coinsOrder, 'crypto');

      // A股
      const customStocks = result[CUSTOM_STOCKS_KEY] || [];
      const stocksOrder = result[STOCKS_ORDER_KEY] || [];
      stockList = buildOrderedList([], customStocks, stocksOrder, 'stock');

      // 贵金属（固定）
      metalList = [...DEFAULT_METALS];

      resolve();
    });
  });
}

function buildOrderedList(defaults, customs, order, type) {
  const all = [...defaults];
  customs.forEach(item => {
    all.push({
      symbol: item.symbol,
      name: item.name,
      fullName: item.fullName || item.name,
      icon: item.icon || '📊',
      source: item.source || 'binance',
      tradingPair: item.tradingPair || item.symbol,
      type: type
    });
  });

  if (order.length > 0) {
    const ordered = [];
    order.forEach(sym => {
      const item = all.find(i => i.symbol === sym);
      if (item) ordered.push(item);
    });
    all.forEach(item => {
      if (!order.includes(item.symbol)) ordered.push(item);
    });
    return ordered;
  }
  return all;
}

// ==================== 渲染 ====================
function renderAllPanels() {
  renderPanel('crypto-grid', cryptoList);
  renderPanel('stock-grid', stockList);
  renderPanel('metal-grid', metalList);
}

function renderPanel(gridId, list) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-hint">暂无数据，请在设置中添加</div>';
    return;
  }

  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'coin-card';
    card.id = `card-${item.symbol}`;
    card.draggable = true;
    card.dataset.symbol = item.symbol;
    card.dataset.type = item.type;

    const sourceIcon = item.source !== 'binance' && item.type === 'crypto'
      ? `<span class="source-indicator">${EXCHANGE_ICONS[item.source] || ''}</span>` : '';

    card.innerHTML = `
      <div class="coin-card-header">
        <span class="coin-card-icon">${item.icon}</span>
        <span class="coin-card-name">${item.name}</span>
        ${sourceIcon}
      </div>
      <div class="coin-card-price" id="price-${item.symbol}">
        <span class="coin-card-loading">加载中...</span>
      </div>
      <div class="coin-card-change" id="change-${item.symbol}">
        <span>--</span>
      </div>
    `;

    // 拖拽
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('dragenter', handleDragEnter);
    card.addEventListener('dragleave', handleDragLeave);
    card.addEventListener('drop', handleDrop);

    // 点击
    card.addEventListener('click', () => openChart(item));

    grid.appendChild(card);
  });
}

// ==================== 数据连接 ====================
function connectAll() {
  // 虚拟币
  connectCrypto();
  // A股
  if (stockList.length > 0) fetchStockPrices();
  // 贵金属
  fetchMetalPrices();
}

function refreshAll() {
  closeAllConnections();
  connectAll();
}

function closeAllConnections() {
  Object.values(wsConnections).forEach(ws => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  });
  Object.values(pollingIntervals).forEach(id => clearInterval(id));
  pollingIntervals = {};
}

// ==================== 虚拟币连接 ====================
function connectCrypto() {
  const byExchange = { binance: [], okx: [], bitget: [], mexc: [] };

  cryptoList.forEach(coin => {
    const src = coin.source || 'binance';
    if (byExchange[src]) byExchange[src].push(coin);
  });

  byExchange.binance.forEach(c => connectBinanceWS(c));
  if (byExchange.okx.length > 0) connectOkxWS(byExchange.okx);
  if (byExchange.bitget.length > 0) connectBitgetWS(byExchange.bitget);
  if (byExchange.mexc.length > 0) startMexcPolling(byExchange.mexc);
}

function connectBinanceWS(coin) {
  const sym = coin.symbol;
  if (wsConnections[sym]) wsConnections[sym].close();

  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${coin.tradingPair.toLowerCase()}@ticker`);
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    priceData[sym] = { price: parseFloat(d.c), changePercent: parseFloat(d.P) };
    updateCard(sym);
  };
  ws.onclose = () => setTimeout(() => connectBinanceWS(coin), 3000);
  wsConnections[sym] = ws;
}

function connectOkxWS(coins) {
  if (wsConnections['okx']) wsConnections['okx'].close();
  const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
  ws.onopen = () => {
    ws.send(JSON.stringify({ op: 'subscribe', args: coins.map(c => ({ channel: 'tickers', instId: c.tradingPair })) }));
  };
  ws.onmessage = e => {
    const r = JSON.parse(e.data);
    if (r.data?.[0]) {
      const d = r.data[0];
      const coin = coins.find(c => c.tradingPair === d.instId);
      if (coin) {
        const change = d.sodUtc8 ? ((parseFloat(d.last) - parseFloat(d.sodUtc8)) / parseFloat(d.sodUtc8) * 100) : 0;
        priceData[coin.symbol] = { price: parseFloat(d.last), changePercent: change };
        updateCard(coin.symbol);
      }
    }
  };
  ws.onclose = () => setTimeout(() => connectOkxWS(coins), 3000);
  wsConnections['okx'] = ws;
}

function connectBitgetWS(coins) {
  if (wsConnections['bitget']) wsConnections['bitget'].close();
  const ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');
  ws.onopen = () => {
    ws.send(JSON.stringify({ op: 'subscribe', args: coins.map(c => ({ instType: 'SPOT', channel: 'ticker', instId: c.tradingPair })) }));
  };
  ws.onmessage = e => {
    const r = JSON.parse(e.data);
    if (r.data?.[0]) {
      const d = r.data[0];
      const coin = coins.find(c => c.tradingPair === d.instId);
      if (coin) {
        priceData[coin.symbol] = { price: parseFloat(d.lastPr), changePercent: parseFloat(d.changeUtc24h) * 100 };
        updateCard(coin.symbol);
      }
    }
  };
  ws.onclose = () => setTimeout(() => connectBitgetWS(coins), 3000);
  wsConnections['bitget'] = ws;
}

function startMexcPolling(coins) {
  const fetch = async () => {
    for (const c of coins) {
      try {
        const r = await window.fetch(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${c.tradingPair}`);
        if (r.ok) {
          const d = await r.json();
          priceData[c.symbol] = { price: parseFloat(d.lastPrice), changePercent: parseFloat(d.priceChangePercent) };
          updateCard(c.symbol);
        }
      } catch (e) { console.error(e); }
    }
  };
  fetch();
  pollingIntervals['mexc'] = setInterval(fetch, 5000);
}

// ==================== 股票数据 ====================
async function fetchStockPrices() {
  if (stockList.length === 0) return;

  const fetchOnce = async () => {
    for (const stock of stockList) {
      try {
        // 使用腾讯股票API（支持A股、港股）
        const code = stock.tradingPair;
        const r = await window.fetch(`https://qt.gtimg.cn/q=${code}`);
        if (r.ok) {
          const text = await r.text();
          const parts = text.split('~');
          if (parts.length > 32) {
            const price = parseFloat(parts[3]);
            const change = parseFloat(parts[32]);
            priceData[stock.symbol] = { price, changePercent: change, isStock: true };
            updateCard(stock.symbol);
          }
        }
      } catch (e) { console.error('股票数据获取失败:', e); }
    }
  };

  fetchOnce();
  pollingIntervals['stock'] = setInterval(fetchOnce, 10000); // 10秒更新
}

// ==================== 贵金属数据 ====================
async function fetchMetalPrices() {
  const fetchOnce = async () => {
    // 使用外汇API获取黄金白银价格
    try {
      // 黄金 XAU/USD
      const goldRes = await window.fetch('https://api.exchangerate-api.com/v4/latest/XAU');
      if (goldRes.ok) {
        const data = await goldRes.json();
        const goldPrice = 1 / data.rates.USD; // XAU to USD
        priceData['XAUUSD'] = { price: goldPrice, changePercent: 0, isMetal: true };
        updateCard('XAUUSD');
      }
    } catch (e) {
      // 备用：使用固定显示
      console.log('黄金价格获取失败，使用TradingView');
    }

    try {
      // 白银 XAG/USD
      const silverRes = await window.fetch('https://api.exchangerate-api.com/v4/latest/XAG');
      if (silverRes.ok) {
        const data = await silverRes.json();
        const silverPrice = 1 / data.rates.USD;
        priceData['XAGUSD'] = { price: silverPrice, changePercent: 0, isMetal: true };
        updateCard('XAGUSD');
      }
    } catch (e) {
      console.log('白银价格获取失败');
    }
  };

  fetchOnce();
  pollingIntervals['metal'] = setInterval(fetchOnce, 30000); // 30秒更新
}

// ==================== UI 更新 ====================
function updateCard(symbol) {
  const data = priceData[symbol];
  if (!data) return;

  const priceEl = document.getElementById(`price-${symbol}`);
  const changeEl = document.getElementById(`change-${symbol}`);
  if (!priceEl || !changeEl) return;

  const prefix = data.isStock ? '¥' : '$';
  priceEl.textContent = `${prefix}${formatPrice(data.price)}`;
  priceEl.style.animation = 'none';
  setTimeout(() => priceEl.style.animation = 'priceUpdate 0.2s ease', 10);

  const pos = data.changePercent >= 0;
  changeEl.className = `coin-card-change ${pos ? 'positive' : 'negative'}`;
  changeEl.innerHTML = `<span>${pos ? '+' : ''}${data.changePercent.toFixed(2)}%</span>`;
}

function formatPrice(p) {
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  if (p >= 0.0001) return p.toFixed(6);
  return p.toFixed(8);
}

// ==================== 拖拽排序 ====================
function handleDragStart(e) {
  draggedElement = this;
  this.classList.add('dragging');
  e.dataTransfer.setData('text/plain', this.dataset.symbol);
}

function handleDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('.coin-card').forEach(c => c.classList.remove('drag-over'));
  draggedElement = null;
}

function handleDragOver(e) { e.preventDefault(); }
function handleDragEnter(e) {
  e.preventDefault();
  if (this !== draggedElement) this.classList.add('drag-over');
}
function handleDragLeave() { this.classList.remove('drag-over'); }

function handleDrop(e) {
  e.preventDefault();
  if (this === draggedElement) return;
  this.classList.remove('drag-over');

  const dragSym = e.dataTransfer.getData('text/plain');
  const targetSym = this.dataset.symbol;
  const type = this.dataset.type;

  let list = type === 'crypto' ? cryptoList : type === 'stock' ? stockList : metalList;
  const dragIdx = list.findIndex(i => i.symbol === dragSym);
  const targetIdx = list.findIndex(i => i.symbol === targetSym);

  if (dragIdx === -1 || targetIdx === -1) return;

  const [item] = list.splice(dragIdx, 1);
  list.splice(targetIdx, 0, item);

  const gridId = type === 'crypto' ? 'crypto-grid' : type === 'stock' ? 'stock-grid' : 'metal-grid';
  renderPanel(gridId, list);

  // 保存顺序
  const orderKey = type === 'crypto' ? COINS_ORDER_KEY : type === 'stock' ? STOCKS_ORDER_KEY : null;
  if (orderKey) {
    chrome.storage.local.set({ [orderKey]: list.map(i => i.symbol) });
  }
}

// ==================== K线图 ====================
function openChart(item) {
  const section = document.getElementById('chartSection');
  document.getElementById('chartCoinName').textContent = item.name;
  section.classList.add('expanded');

  const container = document.getElementById('tradingview-chart');
  container.innerHTML = '';

  let tvSymbol;
  if (item.type === 'crypto') {
    const exMap = { binance: 'BINANCE', okx: 'OKX', bitget: 'BITGET', mexc: 'MEXC' };
    tvSymbol = `${exMap[item.source] || 'BINANCE'}:${item.name}USDT`;
  } else if (item.type === 'stock') {
    // 股票使用对应交易所
    const code = item.tradingPair;
    if (code.startsWith('sh')) {
      tvSymbol = `SSE:${code.slice(2)}`;
    } else if (code.startsWith('sz')) {
      tvSymbol = `SZSE:${code.slice(2)}`;
    } else if (code.startsWith('hk')) {
      tvSymbol = `HKEX:${code.slice(2)}`;
    } else if (code.startsWith('us')) {
      tvSymbol = `NASDAQ:${code.slice(2)}`;
    } else {
      tvSymbol = `SSE:${code}`;
    }
  } else if (item.type === 'metal') {
    tvSymbol = item.symbol === 'XAUUSD' ? 'TVC:GOLD' : 'TVC:SILVER';
  }

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px';
  iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=ffffff&theme=light&style=1&timezone=Asia%2FShanghai&locale=zh_CN`;
  container.appendChild(iframe);
}

function closeChart() {
  document.getElementById('chartSection').classList.remove('expanded');
  setTimeout(() => document.getElementById('tradingview-chart').innerHTML = '', 400);
}

// 清理
window.addEventListener('beforeunload', closeAllConnections);
