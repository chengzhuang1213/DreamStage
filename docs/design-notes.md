# DreamStage 设计记录

## 当前架构入口

- 角色数据：`src/game/data/characters.ts`
- 小怪数据：`src/game/data/enemies.ts`
- 精英数据：`src/game/data/elites.ts`
- Boss 数据：`src/game/data/bosses.ts`
- 主羁绊与小羁绊：`src/game/data/bonds.ts`
- 节点、稀有度、队伍标签、金币奖励：`src/game/data/labels.ts`
- 图片与音频路径：`src/assets.ts`
- 战斗结算逻辑：`src/game/battle.ts`
- 战斗状态复制、运行时 flags、统计记录：`src/game/battleState.ts`
- 战斗事件快照与日志事件发射：`src/game/battleEvents.ts`
- Boss 战斗台词：`src/game/battleNarration.ts`
- 羁绊计算逻辑：`src/game/bonds.ts`
- 角色升级上限与升级规则：`src/game/upgrades.ts`
- 单局初始状态：`src/run/createRun.ts`
- 地图/问号战斗遭遇生成：`src/run/encounters.ts`
- 问号事件可用性、抽取与结算：`src/run/questionResolution.ts`
- 单局状态类型：`src/run/types.ts`
- 角色升级说明：`src/game/data/upgrades.tsx`
- 开始页组件：`src/pages/StartScreen.tsx`
- 地图页面组件：`src/pages/MapScreen.tsx`
- 地图展示子组件、弹窗、路线几何：`src/components/mapViews.tsx`
- 战斗展示子组件、气泡标签、立绘卡片：`src/components/battleViews.tsx`
- 通用头像、等级徽章、音乐按钮：`src/components/common.tsx`
- 通用角色卡：`src/components/cards.tsx`
- 紧凑角色行：`src/components/characters.tsx`
- 战斗日志、伤害统计、统计弹窗：`src/components/battleLog.tsx`
- tooltip 信息标签：`src/components/info.tsx`
- 样式入口：`src/styles.css`
- 分区样式：`src/styles/`

## 数据维护规则

- 改某个角色技能、被动、数值时，优先只改 `src/game/data/characters.ts`。
- 新增小怪或调整普通战敌人池时，优先只改 `src/game/data/enemies.ts`。
- 新增精英时，优先只改 `src/game/data/elites.ts`。
- 新增 Boss 或调整 Boss 被动时，优先只改 `src/game/data/bosses.ts`。
- 新增羁绊时，主羁绊写入 `BOND_GROUPS`，小羁绊写入 `SECONDARY_BONDS`。
- 新增图标、头像、卡面、BGM、SFX 时，先把路径登记到 `src/assets.ts`，组件只引用这个集中入口。

## 战斗逻辑边界

`src/game/battle.ts` 负责集中管理：

- 普通战、精英 2v1、Boss 3v1 的出战槽位与自动战斗结算。
- 技能触发、护盾削减、毒层伤害、暴击、斩杀、Boss 保底 1HP 等规则。
- 单场战斗统计，包括造成伤害、承受伤害、暴击次数。

页面组件不直接写战斗规则，只调用 `resolveBattleGroup`、`resolveBattleSegment`、`getBattleSlots`。

## 地图页面规则

- 队伍面板固定在地图左上，只显示头像与 HP，并保留一个“详细”按钮。
- 羁绊面板固定在地图左下，每行一个 logo 加人数，例如 `logo 1/3`，并保留一个“详细”按钮。
- 节点说明固定在地图右下。
- 地图节点本体只显示图标，不显示文字说明，给后续增加更多节点留空间。
- 地图区域允许向下延伸，避免后续节点密度增加后挤压顶部 UI。

## 资源命名规则

- 主角头像：`/cards/...` 下保留角色英文名或官方资源名。
- 主角特殊卡面：`/cards/heroes/skins/{character-id}-{rarity}.png`
- 节点图标：`/ui/node-icons/{node-type}.png`
- 羁绊 logo：`/ui/bond-logos/{bond-id}.png`
- 路线纹理：`/ui/route-lines/{style-name}.png`
- BGM：`/audio/{scene-name}.mp3`
- SFX：`/audio/{action-name}.mp3`

新增资源后先统一命名，再在 `src/assets.ts` 里登记，避免组件里到处散落路径字符串。

## 后续清洁清单

- 后续如果继续清洁，优先把 `src/styles/components.css` 中的通用卡片、羁绊、日志样式再细分。

