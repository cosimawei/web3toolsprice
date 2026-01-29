// ==================== 全局变量 ====================
const wsConnections = {};
const priceData = {};
let pollingIntervals = {};
let draggedElement = null;
let currentTab = 'crypto';

// ==================== 存储键 ====================
const CUSTOM_COINS_KEY = 'customCoins';
const CUSTOM_STOCKS_KEY = 'customStocks';
const CUSTOM_ALPHA_KEY = 'customAlpha';
const CUSTOM_MEME_KEY = 'customMeme';
const COINS_ORDER_KEY = 'coinsOrder';
const STOCKS_ORDER_KEY = 'stocksOrder';
const ALPHA_ORDER_KEY = 'alphaOrder';
const MEME_ORDER_KEY = 'memeOrder';
const TAB_VISIBILITY_KEY = 'tabVisibility';

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

// 股市（默认）
const DEFAULT_STOCKS = [
  { symbol: 'sh000001', name: '上证指数', fullName: 'SSE Composite', icon: '📊', source: 'cn', tradingPair: 'sh000001', type: 'stock' },
  { symbol: 'usIXIC', name: '纳斯达克', fullName: 'NASDAQ Composite', icon: '📈', source: 'us', tradingPair: 'usIXIC', type: 'stock' }
];

// 贵金属（固定）
const DEFAULT_METALS = [
  { symbol: 'XAUUSD', name: '黄金', fullName: 'Gold', icon: '🥇', source: 'metal', tradingPair: 'XAUUSD', type: 'metal' },
  { symbol: 'XAGUSD', name: '白银', fullName: 'Silver', icon: '🥈', source: 'metal', tradingPair: 'XAGUSD', type: 'metal' },
  { symbol: 'USOIL', name: '原油', fullName: 'Crude Oil', icon: '🛢️', source: 'metal', tradingPair: 'USOIL', type: 'metal' },
  { symbol: 'SOYBEAN', name: '大豆', fullName: 'Soybean', icon: '🫘', source: 'metal', tradingPair: 'SOYBEAN', type: 'metal' }
];

// 数据列表
let cryptoList = [];
let alphaList = [];
let memeList = [];
let stockList = [];
let metalList = [...DEFAULT_METALS];

// 交易所图标
const EXCHANGE_ICONS = { binance: '🔶', binance_alpha: '🅰️', okx: '⚫', bitget: '🟢', mexc: '🔵' };

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
  document.getElementById('tradingviewBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.tradingview.com/chart/' });
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

// 应用页签显示设置
function applyTabVisibility(visibility) {
  const tabs = ['crypto', 'alpha', 'meme', 'stock', 'metal'];
  let firstVisible = null;

  tabs.forEach(tab => {
    const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    const panel = document.getElementById(`panel-${tab}`);
    const isVisible = visibility[tab] !== false;

    if (btn) btn.style.display = isVisible ? '' : 'none';
    if (panel && !isVisible) panel.classList.remove('active');

    if (isVisible && !firstVisible) firstVisible = tab;
  });

  // 切换到第一个可见的页签
  if (firstVisible && !visibility[currentTab]) {
    switchTab(firstVisible);
  } else if (firstVisible) {
    switchTab(firstVisible);
  }
}

// ==================== 加载数据 ====================
async function loadAllData() {
  return new Promise(resolve => {
    chrome.storage.local.get([CUSTOM_COINS_KEY, CUSTOM_STOCKS_KEY, CUSTOM_ALPHA_KEY, CUSTOM_MEME_KEY, COINS_ORDER_KEY, STOCKS_ORDER_KEY, ALPHA_ORDER_KEY, MEME_ORDER_KEY, TAB_VISIBILITY_KEY], result => {
      // 虚拟币（排除Alpha代币）
      const customCoins = (result[CUSTOM_COINS_KEY] || []).filter(c => c.source !== 'binance_alpha');
      const coinsOrder = result[COINS_ORDER_KEY] || [];
      cryptoList = buildOrderedList(DEFAULT_CRYPTO, customCoins, coinsOrder, 'crypto');

      // Alpha代币
      const customAlpha = result[CUSTOM_ALPHA_KEY] || [];
      const alphaOrder = result[ALPHA_ORDER_KEY] || [];
      alphaList = buildOrderedList([], customAlpha, alphaOrder, 'alpha');

      // MEME代币
      const customMeme = result[CUSTOM_MEME_KEY] || [];
      const memeOrder = result[MEME_ORDER_KEY] || [];
      memeList = buildOrderedList([], customMeme, memeOrder, 'meme');

      // 股市
      const customStocks = result[CUSTOM_STOCKS_KEY] || [];
      const stocksOrder = result[STOCKS_ORDER_KEY] || [];
      stockList = buildOrderedList(DEFAULT_STOCKS, customStocks, stocksOrder, 'stock');

      // 贵金属（固定）
      metalList = [...DEFAULT_METALS];

      // 应用页签显示设置
      const visibility = result[TAB_VISIBILITY_KEY] || { crypto: true, alpha: true, meme: true, stock: true, metal: true };
      applyTabVisibility(visibility);

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
      tokenId: item.tokenId || null,
      contractAddress: item.contractAddress || null,
      network: item.network || 'bsc',
      note: item.note || '', // 备注
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
  renderPanel('alpha-grid', alphaList);
  renderPanel('meme-grid', memeList);
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

    // 虚拟币交易所标识
    const sourceIcon = item.source !== 'binance' && item.type === 'crypto'
      ? `<span class="source-indicator">${EXCHANGE_ICONS[item.source] || ''}</span>` : '';

    // 股票市场标识
    const MARKET_FLAGS = { cn: '🇨🇳', hk: '🇭🇰', us: '🇺🇸' };
    const marketFlag = item.type === 'stock' && MARKET_FLAGS[item.source]
      ? `<span class="market-flag">${MARKET_FLAGS[item.source]}</span>` : '';

    // 备注显示（Alpha和MEME）
    const hasNote = (item.type === 'alpha' || item.type === 'meme') && item.note;
    const noteHtml = hasNote ? `<div class="coin-card-note">📝 ${item.note}</div>` : '';

    card.innerHTML = `
      <div class="coin-card-header">
        <span class="coin-card-icon">${item.icon}</span>
        <span class="coin-card-name">${item.name}</span>
        ${sourceIcon}
        ${marketFlag}
      </div>
      <div class="coin-card-price" id="price-${item.symbol}">
        <span class="coin-card-loading">加载中...</span>
      </div>
      <div class="coin-card-change" id="change-${item.symbol}">
        <span>--</span>
      </div>
      ${noteHtml}
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
  console.log('connectAll 被调用');
  // 虚拟币
  connectCrypto();
  // Alpha代币
  if (alphaList.length > 0) startAlphaPolling();
  // MEME代币
  if (memeList.length > 0) startMemePolling();
  // 股票
  if (stockList.length > 0) fetchStockPrices();
  // 贵金属
  console.log('准备调用 fetchMetalPrices');
  fetchMetalPrices();
}

function refreshAll() {
  console.log('刷新按钮点击');
  closeAllConnections();
  // 重新渲染面板
  renderAllPanels();
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
  if (wsConnections[sym]) {
    try { wsConnections[sym].close(); } catch(e) {}
  }

  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${coin.tradingPair.toLowerCase()}@ticker`);
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    priceData[sym] = { price: parseFloat(d.c), changePercent: parseFloat(d.P) };
    updateCard(sym);
  };
  ws.onerror = () => {}; // 忽略错误
  ws.onclose = () => {
    if (wsConnections[sym] === ws) {
      setTimeout(() => connectBinanceWS(coin), 3000);
    }
  };
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

// Binance Alpha代币轮询
function startAlphaPolling() {
  const fetchAlpha = async () => {
    try {
      // 获取Alpha token列表（包含价格信息）
      const r = await window.fetch('https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list');
      if (r.ok) {
        const data = await r.json();
        if (data && data.data && Array.isArray(data.data)) {
          for (const c of alphaList) {
            // 通过tokenId或symbol匹配
            const token = data.data.find(t => {
              if (c.tokenId && t.id === c.tokenId) return true;
              return t.symbol && t.symbol.toUpperCase() === c.name.toUpperCase();
            });
            if (token && token.price) {
              const price = parseFloat(token.price);
              const change = token.priceChange24h ? parseFloat(token.priceChange24h) : 0;
              priceData[c.symbol] = { price, changePercent: change, isAlpha: true };
              updateCard(c.symbol);
            }
          }
        }
      }
    } catch (e) { console.error('Alpha数据获取失败:', e); }
  };
  fetchAlpha();
  pollingIntervals['alpha'] = setInterval(fetchAlpha, 10000); // 10秒更新
}

// MEME代币轮询（使用GeckoTerminal API）
function startMemePolling() {
  const fetchMeme = async () => {
    for (const c of memeList) {
      if (!c.contractAddress) continue;
      try {
        const network = c.network || 'bsc';
        const networkMap = { 'bsc': 'bsc', 'eth': 'eth', 'sol': 'solana', 'base': 'base' };
        const geckoNetwork = networkMap[network.toLowerCase()] || network.toLowerCase();

        // 使用GeckoTerminal获取token信息
        const url = `https://api.geckoterminal.com/api/v2/networks/${geckoNetwork}/tokens/${c.contractAddress}`;
        const r = await window.fetch(url);
        if (r.ok) {
          const data = await r.json();
          if (data && data.data && data.data.attributes) {
            const attrs = data.data.attributes;
            const price = parseFloat(attrs.price_usd) || 0;
            const change = parseFloat(attrs.price_change_percentage?.h24) || 0;
            if (price > 0) {
              priceData[c.symbol] = { price, changePercent: change, isMeme: true };
              updateCard(c.symbol);
            }
          }
        }
      } catch (e) { console.error('MEME数据获取失败:', c.name, e); }
    }
  };
  fetchMeme();
  pollingIntervals['meme'] = setInterval(fetchMeme, 15000); // 15秒更新（避免超过API限制）
}

// ==================== 股票数据 ====================
async function fetchStockPrices() {
  if (stockList.length === 0) return;

  const fetchOnce = async () => {
    for (const stock of stockList) {
      try {
        // 使用腾讯股票API（支持A股、港股、美股）
        const code = stock.tradingPair;
        const r = await window.fetch(`https://qt.gtimg.cn/q=${code}`);
        if (r.ok) {
          // 腾讯API返回GBK编码，需要转换
          const buffer = await r.arrayBuffer();
          const decoder = new TextDecoder('gbk');
          const text = decoder.decode(buffer);
          const parts = text.split('~');
          if (parts.length > 32) {
            const price = parseFloat(parts[3]);
            // 美股涨跌幅在parts[31]，A股在parts[32]
            const isUS = code.startsWith('us');
            const change = parseFloat(parts[isUS ? 31 : 32]);
            priceData[stock.symbol] = { price, changePercent: change, isStock: true, isUS };
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
const API_APPCODE_KEY = 'metalApiAppCode';

async function fetchMetalPrices() {
  // 先获取AppCode配置
  const appCode = await new Promise(resolve => {
    chrome.storage.local.get([API_APPCODE_KEY], result => {
      resolve(result[API_APPCODE_KEY] || '');
    });
  });

  const fetchOnce = async () => {
    console.log('开始获取贵金属数据...', appCode ? '使用API' : '使用换算');

    // 始终获取国际金价（Binance PAXG）
    await fetchInternationalGold();

    // 获取原油价格
    await fetchOilPrice();

    // 获取大豆价格
    await fetchSoybeanPrice();

    if (appCode) {
      // 有AppCode，使用阿里云API获取中国金价和白银
      await fetchMetalFromApi(appCode);
    } else {
      // 无AppCode，用换算的中国金价
      if (priceData['XAUUSD']) {
        const usdPrice = priceData['XAUUSD'].price;
        priceData['XAUUSD'].cnPrice = usdPrice / 31.1035 * 7.1;
        updateGoldCard();
      }
      // 白银显示提示
      const silverCard = document.getElementById('price-XAGUSD');
      if (silverCard) {
        silverCard.innerHTML = '<span style="font-size:12px;color:rgba(255,255,255,0.6)">点击查看K线</span>';
      }
    }
  };

  fetchOnce();
  pollingIntervals['metal'] = setInterval(fetchOnce, 120000); // 120秒更新，节省API调用
}

// 获取国际金价（Binance PAXG）
async function fetchInternationalGold() {
  try {
    const goldRes = await window.fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT');
    if (goldRes.ok) {
      const data = await goldRes.json();
      const price = parseFloat(data.lastPrice);
      const change = parseFloat(data.priceChangePercent);
      console.log('国际黄金价格(PAXG):', price);
      if (!isNaN(price) && price > 0) {
        priceData['XAUUSD'] = {
          price: price,
          changePercent: change,
          isMetal: true
        };
      }
    }
  } catch (e) {
    console.error('国际黄金价格获取失败:', e);
  }
}

// 获取原油价格（腾讯期货）
async function fetchOilPrice() {
  try {
    // 使用腾讯期货API获取WTI原油 (hf_CL)
    const res = await window.fetch('https://qt.gtimg.cn/q=hf_CL');
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const decoder = new TextDecoder('gbk');
      const text = decoder.decode(buffer);
      console.log('原油数据:', text);
      // 格式: v_hf_CL="57.41,1.18,57.39,57.41,57.52,56.91,..."
      const match = text.match(/="([^"]+)"/);
      if (match) {
        const parts = match[1].split(',');
        if (parts.length > 1) {
          const price = parseFloat(parts[0]);
          const change = parseFloat(parts[1]);
          if (!isNaN(price) && price > 0) {
            // 换算人民币价格（美元/桶 * 汇率）
            const cnPrice = price * 7.1;
            priceData['USOIL'] = {
              price: price,
              cnPrice: cnPrice,
              changePercent: change,
              isMetal: true
            };
            updateOilCard();
            console.log('原油价格:', price, '涨跌:', change);
            return;
          }
        }
      }
    }
  } catch (e) {
    console.error('原油价格获取失败:', e);
  }
  // 备用：显示提示
  const oilCard = document.getElementById('price-USOIL');
  if (oilCard) {
    oilCard.innerHTML = '<span style="font-size:12px;color:rgba(255,255,255,0.6)">点击查看K线</span>';
  }
}

// 更新原油卡片
function updateOilCard() {
  const data = priceData['USOIL'];
  if (!data) return;

  const priceEl = document.getElementById('price-USOIL');
  const changeEl = document.getElementById('change-USOIL');
  if (priceEl) {
    let priceText = `$${data.price.toFixed(2)}`;
    if (data.cnPrice) {
      priceText += `<br><span style="font-size:12px;color:rgba(255,255,255,0.7)">(¥${data.cnPrice.toFixed(2)}/桶)</span>`;
    }
    priceEl.innerHTML = priceText;
  }
  if (changeEl) {
    const ch = data.changePercent;
    const pos = ch >= 0;
    changeEl.className = `coin-card-change ${pos ? 'positive' : 'negative'}`;
    changeEl.innerHTML = `<span>${pos ? '+' : ''}${ch.toFixed(2)}%</span>`;
  }
}

// 获取大豆价格（腾讯期货）
async function fetchSoybeanPrice() {
  try {
    // 使用腾讯期货API获取CBOT大豆 (hf_S)
    const res = await window.fetch('https://qt.gtimg.cn/q=hf_S');
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const decoder = new TextDecoder('gbk');
      const text = decoder.decode(buffer);
      console.log('大豆数据:', text);
      // 格式: v_hf_S="1075.90,0.08,..."
      const match = text.match(/="([^"]+)"/);
      if (match) {
        const parts = match[1].split(',');
        if (parts.length > 1) {
          const price = parseFloat(parts[0]);
          const change = parseFloat(parts[1]);
          if (!isNaN(price) && price > 0) {
            // 大豆价格单位是美分/蒲式耳，换算成美元
            const priceUsd = price / 100;
            // 换算人民币价格（美元/蒲式耳 * 汇率）
            const cnPrice = priceUsd * 7.1;
            priceData['SOYBEAN'] = {
              price: priceUsd,
              cnPrice: cnPrice,
              changePercent: change,
              isMetal: true
            };
            updateSoybeanCard();
            console.log('大豆价格:', priceUsd, '涨跌:', change);
            return;
          }
        }
      }
    }
  } catch (e) {
    console.error('大豆价格获取失败:', e);
  }
  // 备用：显示提示
  const soybeanCard = document.getElementById('price-SOYBEAN');
  if (soybeanCard) {
    soybeanCard.innerHTML = '<span style="font-size:12px;color:rgba(255,255,255,0.6)">点击查看K线</span>';
  }
}

// 更新大豆卡片
function updateSoybeanCard() {
  const data = priceData['SOYBEAN'];
  if (!data) return;

  const priceEl = document.getElementById('price-SOYBEAN');
  const changeEl = document.getElementById('change-SOYBEAN');
  if (priceEl) {
    let priceText = `$${data.price.toFixed(2)}`;
    if (data.cnPrice) {
      priceText += `<br><span style="font-size:12px;color:rgba(255,255,255,0.7)">(¥${data.cnPrice.toFixed(2)}/蒲式耳)</span>`;
    }
    priceEl.innerHTML = priceText;
  }
  if (changeEl) {
    const ch = data.changePercent;
    const pos = ch >= 0;
    changeEl.className = `coin-card-change ${pos ? 'positive' : 'negative'}`;
    changeEl.innerHTML = `<span>${pos ? '+' : ''}${ch.toFixed(2)}%</span>`;
  }
}

// 使用阿里云API获取贵金属价格
async function fetchMetalFromApi(appCode) {
  // 获取伦敦金银价格（白银）
  try {
    const res = await window.fetch('https://tsgold.market.alicloudapi.com/london', {
      headers: { 'Authorization': `APPCODE ${appCode}` }
    });
    if (res.ok) {
      const data = await res.json();
      console.log('伦敦金银数据:', data);
      if (data && data.code === 1 && data.data && data.data.list) {
        const list = data.data.list;

        // 白银 - 伦敦银
        const silver = list.find(item => item.type === '伦敦银');
        if (silver) {
          const price = parseFloat(silver.price);
          const change = parseFloat(silver.changepercent.replace('%', '').replace('+', ''));
          const isNeg = silver.changepercent.includes('-');
          if (!isNaN(price) && price > 0) {
            // 换算人民币/克：美元/盎司 ÷ 31.1035 × 汇率
            const cnPrice = price / 31.1035 * 7.1;
            priceData['XAGUSD'] = {
              price,
              cnPrice,
              changePercent: isNeg ? -Math.abs(change) : change,
              isMetal: true
            };
            updateSilverCard();
          }
        }
      }
    }
  } catch (e) {
    console.log('伦敦金银API请求失败:', e.message);
  }

  // 获取上海黄金期货价格（中国金价）
  try {
    const res = await window.fetch('https://tsgold.market.alicloudapi.com/shgold', {
      headers: { 'Authorization': `APPCODE ${appCode}` }
    });
    if (res.ok) {
      const data = await res.json();
      console.log('上海黄金数据:', data);
      if (data && data.code === 1 && data.data && data.data.list && priceData['XAUUSD']) {
        // 找 AU99.99 (AU9999)
        const gold = data.data.list.find(item => item.type === 'AU99.99' || item.typename === 'AU9999');
        if (gold) {
          const cnPrice = parseFloat(gold.price);
          if (!isNaN(cnPrice) && cnPrice > 0) {
            priceData['XAUUSD'].cnPrice = cnPrice;
          }
        }
      }
    }
  } catch (e) {
    console.log('上海黄金API请求失败:', e.message);
  }

  // 如果没获取到中国金价，用换算
  if (priceData['XAUUSD'] && !priceData['XAUUSD'].cnPrice) {
    priceData['XAUUSD'].cnPrice = priceData['XAUUSD'].price / 31.1035 * 7.1;
  }

  // 白银没数据时显示提示
  if (!priceData['XAGUSD']) {
    const silverCard = document.getElementById('price-XAGUSD');
    if (silverCard) {
      silverCard.innerHTML = '<span style="font-size:12px;color:rgba(255,255,255,0.6)">点击查看K线</span>';
    }
  }

  updateGoldCard();
}

// 更新黄金卡片
function updateGoldCard() {
  const data = priceData['XAUUSD'];
  if (!data) return;

  const priceEl = document.getElementById('price-XAUUSD');
  const changeEl = document.getElementById('change-XAUUSD');
  if (!priceEl || !changeEl) return;

  // 显示格式：$国际价格 (¥中国价格/克)
  let priceText = `$${formatPrice(data.price)}`;
  if (data.cnPrice) {
    priceText += ` <span style="font-size:12px;color:rgba(255,255,255,0.7)">(¥${formatPrice(data.cnPrice)}/克)</span>`;
  }
  priceEl.innerHTML = priceText;

  const pos = data.changePercent >= 0;
  changeEl.className = `coin-card-change ${pos ? 'positive' : 'negative'}`;
  changeEl.innerHTML = `<span>${pos ? '+' : ''}${data.changePercent.toFixed(2)}%</span>`;
}

// 更新白银卡片
function updateSilverCard() {
  const data = priceData['XAGUSD'];
  if (!data) return;

  const priceEl = document.getElementById('price-XAGUSD');
  const changeEl = document.getElementById('change-XAGUSD');
  if (!priceEl || !changeEl) return;

  // 显示格式：$国际价格，人民币价格放下面（跟黄金一样）
  let priceText = `$${formatPrice(data.price)}`;
  if (data.cnPrice) {
    priceText += `<br><span style="font-size:12px;color:rgba(255,255,255,0.7)">(¥${formatPrice(data.cnPrice)}/克)</span>`;
  }
  priceEl.innerHTML = priceText;

  const pos = data.changePercent >= 0;
  changeEl.className = `coin-card-change ${pos ? 'positive' : 'negative'}`;
  changeEl.innerHTML = `<span>${pos ? '+' : ''}${data.changePercent.toFixed(2)}%</span>`;
}

// ==================== UI 更新 ====================
function updateCard(symbol) {
  const data = priceData[symbol];
  if (!data) return;

  const priceEl = document.getElementById(`price-${symbol}`);
  const changeEl = document.getElementById(`change-${symbol}`);
  if (!priceEl || !changeEl) return;

  // 美股用$，A股港股用¥
  const prefix = data.isStock ? (data.isUS ? '$' : '¥') : '$';
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

  let list;
  if (type === 'crypto') list = cryptoList;
  else if (type === 'alpha') list = alphaList;
  else if (type === 'meme') list = memeList;
  else if (type === 'stock') list = stockList;
  else list = metalList;

  const dragIdx = list.findIndex(i => i.symbol === dragSym);
  const targetIdx = list.findIndex(i => i.symbol === targetSym);

  if (dragIdx === -1 || targetIdx === -1) return;

  const [item] = list.splice(dragIdx, 1);
  list.splice(targetIdx, 0, item);

  let gridId;
  if (type === 'crypto') gridId = 'crypto-grid';
  else if (type === 'alpha') gridId = 'alpha-grid';
  else if (type === 'meme') gridId = 'meme-grid';
  else if (type === 'stock') gridId = 'stock-grid';
  else gridId = 'metal-grid';
  renderPanel(gridId, list);

  // 保存顺序
  let orderKey;
  if (type === 'crypto') orderKey = COINS_ORDER_KEY;
  else if (type === 'alpha') orderKey = ALPHA_ORDER_KEY;
  else if (type === 'meme') orderKey = MEME_ORDER_KEY;
  else if (type === 'stock') orderKey = STOCKS_ORDER_KEY;
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

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px';

  if (item.type === 'alpha' || item.type === 'meme') {
    // Alpha和MEME代币 - 尝试DexScreener K线
    const network = item.network || 'bsc';
    const address = item.contractAddress;

    if (address) {
      // 网络ID映射到DexScreener格式
      const dexScreenerChain = { bsc: 'bsc', eth: 'ethereum', sol: 'solana', base: 'base' };
      const chainId = dexScreenerChain[network.toLowerCase()] || network.toLowerCase();
      const dexScreenerUrl = `https://dexscreener.com/${chainId}/${address}?embed=1&theme=dark&trades=0&info=0`;

      // 创建带iframe和备用按钮的布局
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;">
          <div style="flex:1;position:relative;">
            <iframe id="dexScreenerFrame" src="${dexScreenerUrl}" style="width:100%;height:100%;border:none;border-radius:8px;" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
            <div id="iframeError" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(30,60,114,0.95);border-radius:8px;flex-direction:column;align-items:center;justify-content:center;">
              <p style="color:#fff;margin-bottom:16px;font-size:14px;">DexScreener 不支持嵌入显示</p>
              <div style="display:flex;gap:12px;">
                <button id="openDexScreenerBtn" style="padding:10px 20px;background:#00d395;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;">
                  📊 打开DexScreener
                </button>
                <button id="openDebotBtn2" style="padding:10px 20px;background:#4CAF50;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;">
                  🔗 打开Debot
                </button>
              </div>
            </div>
          </div>
          <div style="display:flex;justify-content:center;gap:12px;padding:8px 0;background:rgba(0,0,0,0.2);border-radius:0 0 8px 8px;">
            <button id="openDexScreenerBtnBottom" style="padding:6px 16px;background:#00d395;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
              📊 DexScreener
            </button>
            <button id="openDebotBtnBottom" style="padding:6px 16px;background:#4CAF50;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
              🔗 Debot
            </button>
          </div>
        </div>
      `;

      const dexScreenerPageUrl = `https://dexscreener.com/${chainId}/${address}`;
      const debotUrl = `https://debot.ai/token/${network}/${address}`;

      // 底部按钮事件
      document.getElementById('openDexScreenerBtnBottom').addEventListener('click', () => {
        window.open(dexScreenerPageUrl, '_blank');
      });
      document.getElementById('openDebotBtnBottom').addEventListener('click', () => {
        window.open(debotUrl, '_blank');
      });

      // iframe加载错误处理
      const iframeEl = document.getElementById('dexScreenerFrame');
      const errorDiv = document.getElementById('iframeError');

      iframeEl.onerror = () => {
        errorDiv.style.display = 'flex';
      };

      // 检测iframe是否被阻止（3秒后检查）
      setTimeout(() => {
        try {
          // 尝试访问iframe内容，如果被阻止会抛出错误
          if (iframeEl.contentDocument === null || iframeEl.contentWindow.length === 0) {
            // 可能被X-Frame-Options阻止
          }
        } catch (e) {
          // 跨域错误，说明加载成功了
        }
      }, 3000);

      // 备用按钮事件（错误显示时）
      setTimeout(() => {
        const btn1 = document.getElementById('openDexScreenerBtn');
        const btn2 = document.getElementById('openDebotBtn2');
        if (btn1) btn1.addEventListener('click', () => window.open(dexScreenerPageUrl, '_blank'));
        if (btn2) btn2.addEventListener('click', () => window.open(debotUrl, '_blank'));
      }, 100);

    } else {
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;background:rgba(255,255,255,0.1);border-radius:8px;">
          <p style="color:#fff;font-size:14px;">暂无合约地址，无法查看K线</p>
        </div>
      `;
    }
    return;
  } else if (item.type === 'crypto') {
    // 虚拟币用TradingView
    const exMap = { binance: 'BINANCE', okx: 'OKX', bitget: 'BITGET', mexc: 'MEXC' };
    const tvSymbol = `${exMap[item.source] || 'BINANCE'}:${item.name}USDT`;
    iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=ffffff&theme=light&style=1&timezone=Asia%2FShanghai&locale=zh_CN`;
  } else if (item.type === 'stock') {
    // 股票K线
    const code = item.tradingPair;

    if (code.startsWith('hk')) {
      // 港股：TradingView嵌入不支持，打开新标签页
      const hkCode = code.slice(2).replace(/^0+/, '');
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:rgba(255,255,255,0.1);border-radius:8px;">
          <p style="color:#fff;margin-bottom:20px;font-size:14px;">港股K线需要在TradingView网站查看</p>
          <button id="openTvBtn" style="padding:12px 24px;background:#4CAF50;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">
            🔗 打开TradingView查看
          </button>
        </div>
      `;
      document.getElementById('openTvBtn').addEventListener('click', () => {
        window.open(`https://www.tradingview.com/chart/?symbol=HKEX:${hkCode}`, '_blank');
      });
      return;
    }

    // A股、美股用TradingView嵌入
    let tvSymbol;
    let interval = 'D'; // 默认日K
    if (code.startsWith('sh')) {
      tvSymbol = `SSE:${code.slice(2)}`;
      interval = 'D'; // A股日K
    } else if (code.startsWith('sz')) {
      tvSymbol = `SZSE:${code.slice(2)}`;
      interval = 'D'; // A股日K
    } else if (code.startsWith('us')) {
      // 美股不指定交易所，让TradingView自动匹配
      tvSymbol = code.slice(2);
      interval = '15'; // 美股15分钟
    } else {
      tvSymbol = code;
    }
    iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=ffffff&theme=light&style=1&timezone=Asia%2FShanghai&locale=zh_CN`;
  } else if (item.type === 'metal') {
    // 大豆期货在嵌入式widget中不支持，需要打开网页查看
    if (item.symbol === 'SOYBEAN') {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:rgba(255,255,255,0.1);border-radius:8px;">
          <p style="color:#fff;margin-bottom:20px;font-size:14px;">大豆期货K线需要在TradingView网站查看</p>
          <button id="openTvBtn" style="padding:12px 24px;background:#4CAF50;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">
            🔗 打开TradingView查看
          </button>
        </div>
      `;
      document.getElementById('openTvBtn').addEventListener('click', () => {
        window.open('https://www.tradingview.com/chart/?symbol=CBOT:ZS1!', '_blank');
      });
      return;
    }
    // 贵金属用TradingView
    let tvSymbol = 'TVC:GOLD';
    if (item.symbol === 'XAGUSD') tvSymbol = 'TVC:SILVER';
    else if (item.symbol === 'USOIL') tvSymbol = 'TVC:USOIL';
    iframe.src = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=ffffff&theme=light&style=1&timezone=Asia%2FShanghai&locale=zh_CN`;
  }

  container.appendChild(iframe);
}

function closeChart() {
  document.getElementById('chartSection').classList.remove('expanded');
  setTimeout(() => document.getElementById('tradingview-chart').innerHTML = '', 400);
}

// 清理
window.addEventListener('beforeunload', closeAllConnections);
