// 后台服务 Worker - 实时价格更新和Badge显示

let currentBTCPrice = 0;
let priceChangePercent = 0;
let priceHistory = [];
let badgeScrollIndex = 0;
let badgeScrollTimer = null;
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// 安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('多币种追踪器已安装');
  initializeExtension();
});

// Service Worker启动时初始化（包括被唤醒后）
chrome.runtime.onStartup.addListener(() => {
  console.log('浏览器启动，初始化扩展...');
  initializeExtension();
});

// 初始化函数
function initializeExtension() {
  // 立即获取初始价格
  updateBTCPrice();

  // 连接WebSocket实时价格流
  connectWebSocket();

  // 创建定时器 - 每5分钟重连一次（作为备份）
  chrome.alarms.create('checkConnection', { periodInMinutes: 5 });

  // 设置初始badge颜色
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });

  // 启动badge滚动显示
  startBadgeScroll();
}

// 连接Binance WebSocket获取实时价格
function connectWebSocket() {
  try {
    // Binance WebSocket stream for BTC/USDT ticker
    const wsUrl = 'wss://stream.binance.com:9443/ws/btcusdt@ticker';
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket已连接 - 实时价格流已启动');
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // 更新价格信息
        currentBTCPrice = parseFloat(data.c); // 当前价格
        priceChangePercent = parseFloat(data.P); // 24小时涨跌百分比

        // 保存价格历史
        priceHistory.push({
          price: currentBTCPrice,
          change: priceChangePercent,
          timestamp: Date.now()
        });

        // 只保留最近100条记录
        if (priceHistory.length > 100) {
          priceHistory.shift();
        }

        // 存储到chrome.storage供popup使用
        chrome.storage.local.set({
          btcPrice: currentBTCPrice,
          priceChange: priceChangePercent,
          lastUpdate: Date.now()
        });

        // 根据涨跌设置badge颜色
        if (priceChangePercent >= 0) {
          chrome.action.setBadgeBackgroundColor({ color: '#26a69a' }); // 绿色
        } else {
          chrome.action.setBadgeBackgroundColor({ color: '#ef5350' }); // 红色
        }

        // console.log('实时价格更新:', currentBTCPrice, '涨跌:', priceChangePercent + '%');
      } catch (error) {
        console.error('解析WebSocket数据失败:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket连接已关闭');
      // 尝试重连
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`尝试重连 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(connectWebSocket, 3000 * reconnectAttempts);
      } else {
        console.log('达到最大重连次数，切换到轮询模式');
        // 启动轮询作为备用方案
        chrome.alarms.create('updatePrice', { periodInMinutes: 0.5 });
      }
    };
  } catch (error) {
    console.error('创建WebSocket失败:', error);
    // 启动轮询作为备用方案
    chrome.alarms.create('updatePrice', { periodInMinutes: 0.5 });
  }
}

// 监听定时器
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updatePrice') {
    updateBTCPrice();
  } else if (alarm.name === 'checkConnection') {
    // 检查WebSocket连接状态
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('检测到连接断开，尝试重连...');
      connectWebSocket();
    }
  } else if (alarm.name === 'keepAlive') {
    // Service Worker被唤醒，确保滚动功能在运行
    if (!badgeScrollTimer) {
      console.log('重新启动Badge滚动...');
      startBadgeScroll();
    }
    // 更新一次显示
    updateBadgeDisplay();
  }
});

// 更新BTC价格（备用API方式）
async function updateBTCPrice() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
    const data = await response.json();

    if (data && data.lastPrice) {
      currentBTCPrice = parseFloat(data.lastPrice);
      priceChangePercent = parseFloat(data.priceChangePercent);

      // 保存价格历史
      priceHistory.push({
        price: currentBTCPrice,
        change: priceChangePercent,
        timestamp: Date.now()
      });

      if (priceHistory.length > 100) {
        priceHistory.shift();
      }

      // 存储到chrome.storage
      chrome.storage.local.set({
        btcPrice: currentBTCPrice,
        priceChange: priceChangePercent,
        lastUpdate: Date.now()
      });

      // 设置badge颜色
      if (priceChangePercent >= 0) {
        chrome.action.setBadgeBackgroundColor({ color: '#26a69a' });
      } else {
        chrome.action.setBadgeBackgroundColor({ color: '#ef5350' });
      }

      console.log('价格已更新(API):', currentBTCPrice);
    }
  } catch (error) {
    console.error('更新BTC价格失败:', error);
    chrome.action.setBadgeText({ text: 'ERR' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF9800' });
  }
}

// 启动Badge滚动显示 - 使用chrome.alarms保证在Service Worker挂起后仍能工作
function startBadgeScroll() {
  // 使用alarms API - 最小间隔是0.5分钟，但我们可以用它来保持Service Worker活跃
  // 同时用setInterval来实现快速滚动
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });

  // 清除旧的定时器
  if (badgeScrollTimer) {
    clearInterval(badgeScrollTimer);
  }

  // 每500毫秒更新一次badge显示
  badgeScrollTimer = setInterval(() => {
    updateBadgeDisplay();
  }, 500);
}

// 更新Badge显示
function updateBadgeDisplay() {
  if (currentBTCPrice === 0) {
    chrome.action.setBadgeText({ text: '...' });
    return;
  }

  // 格式化价格
  const priceStr = formatPriceForBadge(currentBTCPrice);

  // Badge最多显示4个字符
  const maxLength = 4;

  // 如果价格字符串长度小于等于最大长度，直接显示
  if (priceStr.length <= maxLength) {
    chrome.action.setBadgeText({ text: priceStr });
    badgeScrollIndex = 0;
    return;
  }

  // 滚动显示效果
  const paddedStr = priceStr + '    ' + priceStr; // 在末尾添加空格和重复，形成循环
  const displayText = paddedStr.substring(badgeScrollIndex, badgeScrollIndex + maxLength);
  chrome.action.setBadgeText({ text: displayText });

  // 更新滚动索引
  badgeScrollIndex++;
  if (badgeScrollIndex >= priceStr.length + 4) {
    badgeScrollIndex = 0;
  }
}

// 格式化价格用于badge显示 - 显示整数，不要小数位
function formatPriceForBadge(price) {
  // 直接返回整数部分，不要小数
  return Math.round(price).toString();
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getBTCPrice') {
    sendResponse({
      price: currentBTCPrice,
      change: priceChangePercent,
      history: priceHistory
    });
  } else if (request.action === 'updateNow') {
    updateBTCPrice().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// 启动时立即执行
updateBTCPrice();
connectWebSocket();
startBadgeScroll();
