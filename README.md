# 多币种价格追踪器 Chrome插件

一个功能强大的Chrome浏览器扩展，支持实时追踪多种加密货币价格，包括BTC、ETH、SOL、BNB、XRP、ADA等主流币种。

## 功能特性

- **多币种支持**: 支持BTC、ETH、SOL、BNB、XRP、ADA等多种加密货币
- **真正的实时价格**:
  - 使用WebSocket连接Binance实时数据流
  - 价格更新延迟 < 1秒
  - 后台持续更新BTC价格
  - 弹窗实时更新选中币种价格
  - 支持手动刷新
- **图标Badge滚动显示**:
  - 插件图标上滚动显示BTC完整价格
  - 每1秒滚动一次，确保价格完整可见
  - 绿色表示上涨，红色表示下跌
  - 无需打开插件即可查看实时价格
- **专业蜡烛图**: 使用Chart.js绘制的蜡烛图（Candlestick），显示开高低收
- **多时间周期**: 支持1m, 5m, 15m, 1h, 4h, 1D
- **24小时统计**: 显示24小时最高价、最低价和交易量
- **价格变化指示**: 实时显示价格涨跌幅度和百分比
- **美观界面**: 现代化的渐变色设计，支持暗色主题

## 安装步骤

### 1. 生成图标文件

1. 在浏览器中打开 `generate-icons.html` 文件
2. 依次点击三个"下载"按钮，生成三个不同尺寸的图标
3. 将下载的 `icon16.png`、`icon48.png`、`icon128.png` 移动到 `icons` 文件夹中

### 2. 加载Chrome扩展

1. 打开Chrome浏览器
2. 在地址栏输入 `chrome://extensions/` 并回车
3. 在右上角打开"开发者模式"开关
4. 点击"加载已解压的扩展程序"按钮
5. 选择本项目所在的文件夹（包含 manifest.json 的文件夹）
6. 插件安装成功！

## 使用说明

### 切换币种

点击顶部的币种按钮即可切换到对应的加密货币：
- ₿ BTC - 比特币
- Ξ ETH - 以太坊
- ◎ SOL - Solana
- 🔶 BNB - 币安币
- ✕ XRP - 瑞波币
- ₳ ADA - 艾达币

### 调整图表时间周期

点击图表上方的时间周期按钮：
- 1m - 1分钟
- 5m - 5分钟
- 15m - 15分钟
- 1h - 1小时
- 4h - 4小时（默认）
- 1D - 1天

### 刷新数据

点击右上角的刷新按钮 🔄 可以立即更新价格和图表数据。

## 项目结构

```
web3/
├── manifest.json          # Chrome扩展配置文件
├── background.js          # 后台服务Worker（实时更新价格）
├── popup.html            # 弹出窗口HTML
├── popup.js              # 核心JavaScript逻辑
├── styles.css            # 样式文件
├── generate-icons.html   # 图标生成器
├── icons/                # 图标文件夹
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # 说明文档
```

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **实时数据**: Binance WebSocket Stream (wss://stream.binance.com)
- **API**: Binance REST API
- **图表**: Chart.js + chartjs-chart-financial (蜡烛图)
- **后台服务**: Chrome Extension Service Worker (Manifest V3)
- **架构**: Chrome Extension Manifest V3

## API说明

### Binance API

使用 Binance 公开API获取实时数据：

**WebSocket实时数据流**:
- 端点: `wss://stream.binance.com:9443/ws/<symbol>@ticker`
- 功能: 实时推送价格变化，延迟 < 1秒
- 数据: 实时价格、涨跌幅、交易量等

**24小时价格统计**:
- 端点: `https://api.binance.com/api/v3/ticker/24hr`
- 参数: `symbol` (交易对，如 BTCUSDT)
- 返回: 24小时价格统计数据

**K线数据**:
- 端点: `https://api.binance.com/api/v3/klines`
- 参数: `symbol`, `interval`, `limit`
- 返回: 历史K线数据用于绘制蜡烛图

### Chart.js

使用 Chart.js + chartjs-chart-financial 插件，绘制专业的蜡烛图，显示开盘价、最高价、最低价、收盘价。

## 自定义配置

### 添加新币种

在 `popup.js` 的 `COINS` 对象中添加新的币种配置：

```javascript
const COINS = {
  'BTCUSDT': { name: 'BTC', fullName: 'Bitcoin' },
  'ETHUSDT': { name: 'ETH', fullName: 'Ethereum' },
  // 添加新币种
  'DOGEUSDT': { name: 'DOGE', fullName: 'Dogecoin' }
};
```

然后在 `popup.html` 的币种选择器中添加对应按钮：

```html
<button class="coin-btn" data-symbol="DOGEUSDT" data-name="DOGE">
  <span class="coin-icon">Ð</span>
  <span>DOGE</span>
</button>
```

### 修改更新频率

在 `popup.js` 中修改自动更新间隔（单位：毫秒）：

```javascript
// 默认30秒更新一次
priceUpdateInterval = setInterval(() => {
  updatePrice(currentSymbol);
}, 30000); // 修改这个数值
```

### 自定义主题颜色

在 `styles.css` 中修改主色调：

```css
body {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  /* 修改渐变色 */
}
```

## 注意事项

1. **网络连接**: 需要联网才能获取实时价格数据
2. **API限制**: Binance API有请求频率限制，建议不要设置过短的更新间隔
3. **浏览器兼容**: 仅支持Chrome浏览器及基于Chromium的浏览器（如Edge、Brave等）
4. **隐私**: 本插件不收集任何用户数据，所有数据均来自公开API

## 常见问题

### Q: 价格不更新怎么办？
A: 检查网络连接，或点击刷新按钮手动更新。

### Q: 图表显示不出来？
A: 确保网络可以访问 TradingView 的CDN资源。

### Q: 如何添加更多币种？
A: 参考"自定义配置"章节的说明添加新币种。

### Q: 能否显示其他法币对（如CNY）？
A: 可以，修改代码中的交易对名称即可，例如将 BTCUSDT 改为 BTCCNY（需要交易所支持）。

## 开发计划

- [ ] 添加价格提醒功能
- [ ] 支持自定义币种列表
- [ ] 添加多个交易所数据源
- [ ] 支持历史价格查询
- [ ] 添加投资组合追踪功能
- [ ] 支持中英文切换

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

如有问题或建议，请通过GitHub Issues联系。

---

**免责声明**: 本插件仅供学习和研究使用，价格数据仅供参考，不构成任何投资建议。投资有风险，决策需谨慎。
"# web3toolsprice" 
