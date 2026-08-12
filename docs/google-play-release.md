# 上架 Google Play — 发布清单

> 状态核对于 2026-08-12。每一条「代码事实」都是从这个仓库里读出来的，不是回忆。

## 现状

| 项 | 值 | 来源 |
|---|---|---|
| Package | `com.mandysbubbletea.app` | `app.json` |
| Play 上最新版本 | **1.1.4 / versionCode 3**，2026-07-08 | Play Console |
| Play 轨道 | 仅 Internal testing，Production **Inactive** | Play Console |
| 仓库版本 | **1.2.0** | `app.json` |
| 新构建 | 1.2.0 / **versionCode 4** | EAS，2026-08-12 |
| 开发者账号 | **组织账号** | Stan 确认 |

**关键差距**：Play 上跑的是 7 月 8 日的包。从那天起加的东西一个都没有 —— 点单助手 chatbox、夜间模式、促销卡片、语音入口下线、蓝莓特价。Android 用户现在装到的是一个月前的 App。

**组织账号意味着**不受「封闭测试 12 人 × 14 天」的限制（那条只针对 2023-11-13 之后创建的个人账号）。可以直接申请发到 Production。

---

## 步骤

### 1. 上传新包

构建产物是 AAB。两种方式：

**手动**（首次推荐，不用交出任何密钥）：EAS 构建页下载 `.aab` → Play Console → Production → Create new release → 拖进去。

**自动**（`eas submit`）：需要在 Google Cloud 建一个 service account、给它 Play Console 权限、下载 JSON 密钥，然后在 `eas.json` 的 `submit.production` 下加 `android.serviceAccountKeyPath`。目前 `eas.json` 里**只有 iOS 的 `ascAppId`**，Android 侧完全没配。这一步需要你自己在 Google 后台操作，我拿不到也不该拿那个密钥。

### 2. 补完 Dashboard 任务

Draft app 在所有必填项完成前无法发布。下面按「谁能答」分类。

---

## Data safety 表格 —— 从代码里读出来的实际情况

⚠️ **这张表最容易出事**：填的内容必须和 App 实际行为一致。填错不是「被拒」而已，Google 事后发现会强制下架。

下面是这个 App **确实**碰到的数据（逐个查过代码）：

| 数据类型 | 收集 | 在哪 |
|---|---|---|
| 姓名（firstName / lastName） | ✅ | 账户资料 |
| 邮箱 | ✅ | 登录（Supabase / Google / Apple） |
| 电话号码 | ✅ | 账户 + 订单 |
| 地址（street / suburb / postcode） | ✅ | 结账页配送地址 |
| 照片 | ✅ | `app/order-complaint.tsx` —— 报告订单问题时附图 |
| 购买历史 | ✅ | 订单记录 |
| 支付信息 | ✅ | Square In-App Payments SDK 在 App 内采集卡信息（`lib/square-payment.ts`），换成 nonce；**卡号本身不经过我们的服务器也不存储** |
| 推送 token | ✅ | `lib/push-registration.ts` → `device_push_tokens` 表 |

**确认不收集的**（别勾）：

- ❌ 位置 —— 没有 `expo-location`，代码里没有任何 geolocation 调用
- ❌ 分析 / 崩溃上报 —— `package.json` 里没有 Sentry / Firebase Analytics / Amplitude / Crashlytics 任何一个
- ❌ 广告 —— 没有广告 SDK
- ❌ 联系人、日历、通话记录、短信、健康数据

**权限**（来自 plugins）：相册 + 相机（`expo-image-picker`，仅用于投诉附图）、通知（`expo-notifications`）。

**需要你判断的两处**（我不替你在合规表上做判断）：

1. **支付信息**：Google 要求申报「App 内 SDK 采集的数据」。Square SDK 是在 App 内弹卡片输入界面的，所以倾向于要申报为 collected。但如果按「由第三方支付处理方直接采集、我方从不接触」归类，规则不同。建议按前者填（更保守，不会因少报被追责）。
2. **数据是否「shared」**：数据发给 Supabase / Square 属于「我方服务商代为处理」，Google 的定义里通常算 processing 不算 sharing。这个定义值得你在表格里的说明链接上再核一遍。

隐私政策 URL：**https://mandybubbletea.com/privacy**（已验证 200 可访问）。

### 🚩 阻塞项：隐私政策和 App 实际行为矛盾

`lib/legal.ts` §2「Mobile app data」这一条写着：

> We do not collect precise location, contacts, **photos**, or any data beyond what is listed here

**但 App 确实收集照片。** `app/order-complaint.tsx` 让客人从相册选或直接拍，压缩后以 multipart 上传到 `/api/orders/{orderId}/complaint`（见该文件第 200–212 行）。

这条必须改，原因不只是「说法不严谨」：Play 的 Data safety 申报**必须和隐私政策一致**，一边勾了「收集照片」、一边政策写「不收集照片」，是 Google 会直接挑出来的矛盾。

政策是法律文件，改词不该我替你定。建议改法（把照片从「不收集」挪到「收集」并说明用途和范围）：

> Mobile app data: push notification token (via Apple APNs or Google FCM), app version and platform, anonymous sign-in identifiers when you choose Sign in with Apple or Google, and **any photos you choose to attach when reporting a problem with an order**. We do not collect precise location or contacts, we do not access your photo library except for the photos you explicitly select, and the app does not use third-party advertising or analytics SDKs.

同时 §5「Sharing of Information」里应补一句照片存在哪（Supabase storage）。

改动落在两处，内容必须一致：
- `lib/legal.ts`（App 内的政策页面）
- 网站 `src/app/privacy/page.tsx`

你点头我就开 PR。

---

## 🚩 App access —— 第二个需要你决定的地方

代码里**没找到全局登录门禁** —— 菜单应该可以不登录浏览，但结账、账户、订单、投诉都要登录。所以 App access 一栏不能填「所有功能无需特殊访问」，必须给审核员一个能进去的账号。

**问题在于登录方式**。按隐私政策 §5 列的，登录只有三条路：

1. 手机号 + 短信 OTP（Twilio 发码）
2. Sign in with Apple
3. Sign in with Google

**三条都给不了审核员**。Google 的审核员拿不到你的手机验证码，也不会用你的 Apple/Google 账号登录。没有邮箱 + 密码这条路。

可选做法，从省事到干净：

| 做法 | 说明 |
|---|---|
| 给一个固定测试手机号 + 固定验证码 | 后端对某个特定号码跳过真实 OTP，直接认一个写死的码。最快，但等于开了一个后门，得确保它只认那一个号 |
| 加邮箱 + 密码登录 | 最干净，也对普通用户有用（有人就是不想用手机号）。工作量最大 |
| 申请豁免 | 说明 App 无需登录即可浏览核心内容 —— 但结账要登录，审核员大概率仍会要求账号 |

我的建议是**第一种**，专门为审核开一个测试号，配套写清楚它的作用域和过期方式。这是安全相关的改动，需要你拍板再动。

---

## 商店素材

已生成（`assets/store/`，符合 Play 的尺寸和「无 alpha 通道」要求，已验证）：

- `play-icon-512.png` — 512×512，无 alpha，250KB
- `play-feature-graphic-1024x500.png` — 1024×500，无 alpha，195KB（**草稿**，用现有 logo + 品牌色拼的，随时可换）

**还缺截图** —— 至少 2 张手机截图，这个只能从真机/模拟器上装 App 截。可以直接用 Internal testing 那个轨道装了截，但注意截出来的是 1.1.4 的旧界面；建议等 1.2.0 装上再截，不然商店页展示的是一个月前的样子。

建议截这几屏：菜单、饮品定制、点单助手对话（带饮品卡片）、购物车/结账、会员星星页。

### 文案草稿

**短描述**（上限 80 字符）：

```
Order your bubble tea ahead, skip the queue, and earn a free drink every 9 cups.
```

（79 字符）

**完整描述**（上限 4000 字符）：

```
Mandy's Bubble Tea — Southport, Gold Coast.

Order ahead from your phone, skip the queue, and pick up when it's ready.

WHAT YOU CAN DO
• Browse the full menu — milk teas, fruit teas, slushies, and this week's specials
• Customise every cup: sugar level, ice, milk, and toppings
• Pay in the app and collect in store, or get it delivered
• Earn 1 star for every drink — 9 stars is a free drink, any flavour, any size
• Track your order from the counter to your hands

ASK MANDY
Not sure what to get? Our in-app ordering assistant can recommend a drink,
build your whole order, explain what's on special, and answer questions about
the store — in English, Chinese, Japanese, or Korean.

MEMBERSHIP
Silver, Gold, and Diamond tiers. Gold and Diamond members get a discount on
every order, and Diamond members get free toppings every month.

Made fresh to order, every cup.
Mandy's Bubble Tea · 34 Davenport St, Southport QLD · 0404 978 238
```

**App 名称**：目前 Play 上显示 `Temporary app name (unreviewed)`，需要正式填。`app.json` 里叫 `Mandy's`，建议商店名用 `Mandy's Bubble Tea`（更容易被搜到），App 图标下的名字保持短的。

---

## 其他必填项（快速答案）

| 项 | 答案 |
|---|---|
| 内容分级问卷 | 餐饮/电商类，无暴力/成人内容 → 应为全年龄 |
| 目标受众 | 18+（涉及支付） |
| 广告 | 无 |
| 政府 App | 否 |
| 金融功能 | 否（只是卖自己店里的饮品，不是金融服务） |
| 健康 App | 否 |
| 新闻 App | 否 |
| 数据删除 | ✅ 已满足。App「账户」页底部有 Delete Account（`app/(tabs)/account.tsx:187`），隐私政策 §9 也写明了路径和 7 年匿名化保留 |

---

## 顺便提一个安全项（不是上架阻塞项）

`app.json` 里 `expo-build-properties` 设了 **`usesCleartextTraffic: true`**，也就是允许明文 HTTP 请求。这对一个走支付的 App 是没必要的暴露面 —— 大概是为了本地调试留的。生产包不该带这个。

不影响上架审核，但建议单独改掉（或者改成只在 dev profile 生效）。要动的话我来做。
