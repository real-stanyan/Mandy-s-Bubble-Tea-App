# Mandy's Bubble Tea App — V1 Design Spec

## Overview

React Native (Expo) 原生 App，完整复刻 Web 版功能。共享同一套 Square 后端 API。

**目标**：Menu 浏览 → 加购 → 下单支付 → Loyalty 积分，完整闭环。

## 决策记录

| 决策 | 选择 |
|------|------|
| 功能范围 | 完整复刻 Web 版 |
| 支付方案 | Square In-App Payments SDK（原生） |
| 视觉风格 | 原生优先，保留品牌色 |
| 导航结构 | 3 Tab：Menu（首屏）/ Cart / Account |
| Menu 浏览 | 顶部分类 tab + 商品纵向列表 |
| 商品详情 | 独立页面（stack push） |
| 数据获取 | 原生 fetch + 自定义 hooks |

## 技术栈

- Expo SDK 54 + Expo Router 6
- TypeScript
- Zustand（购物车状态，持久化到 AsyncStorage）
- Square In-App Payments SDK (`sq-in-app-payments-react-native`)
- react-native-reanimated 4 + react-native-gesture-handler
- expo-image

## 路由结构

```
app/
├── _layout.tsx                 # Root layout（字体、SplashScreen、Square SDK 初始化）
├── (tabs)/
│   ├── _layout.tsx             # 3-Tab：Menu | Cart | Account
│   ├── index.tsx               # Menu 首屏（分类 tab + 商品列表）
│   ├── cart.tsx                # 购物车
│   └── account.tsx             # Loyalty + 账户
├── menu/
│   └── [id].tsx                # 商品详情页
├── checkout.tsx                # 结账 + 支付
└── order-confirmation.tsx      # 下单成功
```

**导航行为：**
- Tab 之间切换保留各自滚动位置
- Menu → 商品详情：stack push，原生返回手势
- Cart → Checkout → Order Confirmation：线性 stack flow
- Order Confirmation 完成后：clearCart + 回到 Menu tab

## 数据层

### API 层 — `lib/api.ts`

```typescript
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://mandybubbletea.com'

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}
```

### 自定义 Hooks — `hooks/`

| Hook | 端点 | 返回 |
|------|------|------|
| `useMenu()` | GET `/api/catalog` | `{ items, categories, loading, error, refresh }` |
| `useLoyalty(phone)` | GET `/api/loyalty/account` + `/api/loyalty/events` | `{ account, events, loading, error }` |
| `useCreateOrder()` | POST `/api/orders` | `{ createOrder, loading, error }` |
| `usePayment()` | POST `/api/payment` | `{ pay, loading, error }` |

### Zustand Store — `store/cart.ts`

持久化到 AsyncStorage（key: `mandys-cart`）。

```typescript
interface CartItem {
  id: string           // catalog object id
  variationId: string  // variation id（unique key）
  name: string
  price: number        // cents
  quantity: number
  imageUrl?: string
}

// Actions: addItem, removeItem, updateQuantity, clearCart
// Computed: total(), itemCount()
```

### AsyncStorage 缓存

| Key | 用途 |
|-----|------|
| `mandys-cart` | Zustand persist middleware 自动管理 |
| `mandy_phone` | 用户手机号（Loyalty 查找） |

### Types — `types/square.ts`

- `CatalogItem`, `CatalogItemVariation`, `CatalogCategory`
- `CartItem`, `Order`, `LoyaltyAccount`, `LoyaltyEvent`

## 页面设计

### Menu 首屏 — `(tabs)/index.tsx`

- 顶部：大标题 "Menu"（iOS large title 风格）
- 分类标签栏：横向滚动 `ScrollView`，选中态品牌色 `#C43A10` 下划线/背景
- 商品列表：`FlatList`，每项 = 商品图（expo-image）+ 名称 + 价格 + 简短描述
- 下拉刷新：`FlatList` 内置 `onRefresh`

### 商品详情 — `menu/[id].tsx`

- 顶部大图
- 名称 + 描述
- Variations 选择（多规格时用 segmented control 或按钮组）
- 价格展示
- "Add to Cart" 按钮（品牌色，底部固定）+ haptic feedback
- 加购成功：toast 或简短动画提示

### Cart — `(tabs)/cart.tsx`

- 空状态：插画 + "Your cart is empty" + 跳转 Menu 按钮
- 商品列表：缩略图 + 名称 + 规格 + 单价 + 数量 +-（滑动删除）
- 底部固定栏：总价 + "Checkout" 按钮
- Tab badge：显示 `itemCount()`

### Checkout — `checkout.tsx`

- 订单摘要（商品列表 + 总价）
- 手机号输入（可选，"Enter for loyalty stars"，从 AsyncStorage 预填）
- 创建 Order → 选择支付方式 → 支付
- 成功 → clearCart → Order Confirmation
- 失败 → Alert 提示，留在当前页

### Order Confirmation — `order-confirmation.tsx`

- Haptic 成功反馈（`expo-haptics`）
- 订单号 + 商品列表
- 取餐地址：34 Davenport St, Southport QLD 4215
- 如有手机号：显示获得的星星数
- "Back to Menu" 按钮

### Account — `(tabs)/account.tsx`

**未登录态：**
- 手机号输入框（placeholder `04xx xxx xxx`，`keyboardType="phone-pad"`）
- 提交后 `formatAUPhone()` 格式化 → 调用 API

**已登录态：**
- LoyaltyCard 组件（`#C43A10` 背景，当前星星 + 9 格进度条 + 奖励状态，reanimated 动画）
- "Use a different number" 文字按钮
- How it works 说明框（`#F5E6C8` 奶油色背景，3 条规则）
- 近期活动历史（FlatList，+N 星星 / 兑换奖励）
- 底部：店铺信息

## 支付集成

**SDK**: `sq-in-app-payments-react-native`

**初始化：** App 启动时在 Root Layout 调用 `SQIPCore.setSquareApplicationId()`

**支付流程：**
1. Checkout 创建 Order（POST `/api/orders`）→ 拿到 `orderId`
2. 展示支付方式：
   - iOS: Apple Pay 按钮优先 + "Pay with Card" 备选
   - Android: Google Pay 按钮优先 + "Pay with Card" 备选
   - `Platform.OS` 判断
3. Apple Pay / Google Pay → `requestNonce()` → nonce
4. Card Entry → `startCardEntryFlow()` → nonce
5. POST `/api/payment` with `{ token: nonce, orderId, total, phoneNumber? }`
6. 后端完成支付 + loyalty 积分（积分失败不影响支付）
7. 成功 → Order Confirmation；失败 → Alert，留在 Checkout

**幂等性：** 每次支付生成新 UUID 作为 idempotency key。

**原生配置：**
- iOS: Apple Pay merchant ID + entitlement（Xcode）
- Android: Google Pay merchant ID + AndroidManifest
- EAS Build 时处理，开发阶段用 Card Entry 测试

## 品牌 & 风格

| 属性 | 值 |
|------|-----|
| Primary | `#C43A10`（砖红） |
| Accent | `#F5E6C8`（奶油） |
| Background | 系统默认（白/暗色跟随系统） |
| Font | 系统默认（SF Pro / Roboto） |
| 风格 | 原生优先：iOS 大标题导航、原生 Tab Bar、平台动效 |

## Utility 函数 — `lib/utils.ts`

```typescript
export const toDollars = (cents: number | string): number => Number(cents) / 100
export const formatPrice = (cents: number | string): string => `A$${toDollars(cents).toFixed(2)}`
export const formatAUPhone = (phone: string): string =>
  phone.startsWith('+61') ? phone : `+61${phone.replace(/^0/, '')}`
```

## Constants — `lib/constants.ts`

```typescript
export const BRAND = {
  name: "Mandy's Bubble Tea",
  address: '34 Davenport St, Southport QLD 4215',
  phone: '0404 978 238',
  color: '#C43A10',
  accentColor: '#F5E6C8',
} as const

export const LOYALTY = {
  starsForReward: 9,
  rewardName: 'Free Drink of Your Choice',
} as const
```

## 不在 V1 范围内

- 暗色模式主题切换（跟随系统但不提供手动切换）
- 推送通知
- 多语言
- 订单历史列表页（仅有单次确认页）
- 多门店选择
