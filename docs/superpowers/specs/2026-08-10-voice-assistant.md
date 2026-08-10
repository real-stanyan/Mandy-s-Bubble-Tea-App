# Voice Assistant — Mandy 开口说话（立项 spec）

> 2026-08-10 立项（Stan/Xin 拍板「真语音助手立项」）。
> 目标：Chatbox 里按住说话 → Mandy 语音 + 文字回答，闭环点单。

## 已核验的地基（本日探活）

| 事实 | 状态 |
|---|---|
| App 二进制**无任何音频模块**（无 expo-av/expo-audio/voice） | ✅ 查过 package.json — **一切语音功能都需要新包 + App Store 审核** |
| MiniMax TTS 中文 | ✅ 探活成功（96KB mp3，"你好，我是Mandy…"）；6/14 的中文占位问题已解 |
| MiniMax 声音克隆 pipeline | ✅ `~/system/memory/sound/minimaxi-instant-clone-pipeline.md` 端到端跑通（双 host、instant clone 免费） |
| TTS 成本 | ~$0.0001/字符 → 一条 40 字回复 ≈ $0.004，1000 次语音对话 ≈ $4 量级 |
| ASR（听） | iOS 端上 SFSpeechRecognition **免费**（走 expo-speech-recognition 原生模块）；服务端 ASR 无已验证 provider |

## 架构（推荐方案）

```
[App 新包 v25]
  麦克风按钮（ChatSheet 输入行）
   └─ expo-speech-recognition（端上 STT，免费，流式，zh/en）
       └─ 实时转写进现有输入框 → 走现有 /api/chat 文字管线（大脑零改动）
           └─ 回复文字 + 请求 /api/chat/tts?text=...
               └─ 服务端 MiniMax t2a_v2（按回复 hash 缓存进 Supabase storage）
                   └─ expo-audio 播放 = Mandy 开口
```

- **大脑不动**：整单点餐/答疑/客诉/锁定小料全部继承，语音只是 IO 层。
- **STT 端上做**：免费、低延迟、隐私友好；服务端 ASR 留作 Android 兜底选项（provider 待选型）。
- **TTS 服务端做**：换声音/调参数不用发版；结果缓存（同一句只合成一次）。
- web 端同架构可跟进（浏览器 SpeechRecognition + 同一个 /api/chat/tts），Safari 兼容性需实测。

## 阶段拆分

| 阶段 | 内容 | 依赖 | 可开工 |
|---|---|---|---|
| P1 | web 仓库 `/api/chat/tts`（MiniMax 代理 + hash 缓存 + 限流复用 chat_rate_limit） | 无 | **随时（纯 JS，先行）** |
| P2 | App：expo-speech-recognition + expo-audio 接入、麦克风按钮、按住说话 UI、权限文案（zh/en） | — | 代码可先写，跑不了真机 |
| P3 | **新包**：app.json 权限 + runtimeVersion 25 + `eas build` + 提审 | **Stan（Apple 凭证，A 类）** | P2 后 |
| P4 | Mandy 声音定型：预置女声 vs **克隆品牌声**（录 1-5 分钟样本 + consent，sound 域四件套流程） | **Stan（C 类决策）** | 与 P1-3 并行 |
| P5 | web 端语音（浏览器 STT + 同一 TTS 端点） | P1 | P1 后 |

## 待 Stan 拍板（两件）

1. **P3 发包窗口**：新包顺带把 native splash 去 logo（issue #48 遗留）等积压一起带上？
2. **P4 Mandy 的声音**：MiniMax 预置声（零成本零风险）vs 克隆真人声（要录音 + 书面 consent，sound 域已有完整合规模板）。

## 风险

- App Store 审核 1-3 天，语音权限文案要写清用途（拒审常见坑）。
- MiniMax 单点依赖：TTS 挂了要静默降级回纯文字（P1 里就做好降级）。
- 端上 STT 中英混说识别质量需真机实测（SFSpeechRecognition 单 locale，中英混可能要 locale 切换开关）。
