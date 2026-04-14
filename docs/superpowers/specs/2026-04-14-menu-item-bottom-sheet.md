# Menu Item Bottom Sheet

## Goal
点击菜单项不再跳转到 `/menu/[id]` 新页，而是从底部弹出一个 bottom sheet 显示 item detail，iOS 与 Android 表现一致。

## Scope
- 仅改 menu → item detail 的打开方式
- 不改 item detail 内部的表单逻辑（size / modifiers / Add to Cart）
- 路由 `/menu/[id]` 保留做深链 fallback

## Tech Decisions
- **库**：`@gorhom/bottom-sheet`（基于已装的 `reanimated` + `gesture-handler`）
- **Snap points**：`['90%']`，`enablePanDownToClose=true`
- **状态**：Zustand store 管理当前打开的 itemId

## File Changes

### 新增
1. `store/itemSheet.ts`
   ```ts
   { itemId: string | null, open(id), close() }
   ```
2. `components/menu/ItemDetailContent.tsx`
   - 纯展示组件，props: `{ itemId: string; onAdded?: () => void }`
   - 包含原 `[id].tsx` 的 fetch / state / size / modifier / Add to Cart 逻辑
   - 滚动容器由外部传入（在 sheet 里用 `BottomSheetScrollView`，在路由里用 `ScrollView`）—— 通过 `ScrollComponent` prop 注入
3. `components/menu/ItemDetailSheet.tsx`
   - 订阅 `useItemSheetStore`
   - `BottomSheetModal` + 顶部 header（Share 左 / X 右）+ `ItemDetailContent`
   - `itemId` 变化时 present / dismiss

### 修改
4. `app/_layout.tsx`
   - 根部加 `<GestureHandlerRootView style={{flex:1}}>` + `<BottomSheetModalProvider>`
   - 渲染全局 `<ItemDetailSheet />`
5. `components/menu/ItemCard.tsx`
   - `onPress` 从 `router.push('/menu/${id}')` 改为 `useItemSheetStore.getState().open(item.id)`
6. `app/menu/[id].tsx`
   - 精简为 `<ItemDetailContent itemId={id} />`（深链 fallback，保持完整页面行为）

## Sheet Header
- 左：Share 图标按钮 → `Share.share({ message: item.name, url: 'https://mandybubbletea.com/menu/' + itemId })`
- 右：X 按钮 → `store.close()`
- handle bar 用 gorhom 默认

## Add to Cart 行为
- 成功后 haptic success（保持不变）
- 按钮显示 "Added!" 1.5s（保持不变）
- **不自动关闭 sheet**（用户可连续调不同 item，但同一 item 加了就加了；如体验不好再改）

## Deep Link
- `https://…/menu/<id>` → 路由 `/menu/[id]` → 渲染同一个 `ItemDetailContent`（全屏页面形态，带 stack header 返回箭头）

## Out of Scope
- Share 文案的进一步个性化
- 拖拽多段 snap
- 从 sheet 直接深链分享到 app（Universal Link 配置不在本次）

## Acceptance
- iOS & Android 真机/模拟器：点 ItemCard 从底部弹出 sheet，顶部圆角，下滑可关
- Share 按钮触发系统分享面板，带 item 名与 URL
- X 关闭；Add to Cart 正常入购物车
- `/menu/<id>` URL 粘贴进浏览器/深链仍能打开详情页
