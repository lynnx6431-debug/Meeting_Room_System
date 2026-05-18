# Menu Model V4

## Overview

- `MenuCategory` is the tenant/site-scoped category contract for kiosk presentation, ordering mode, and limit semantics.
- `MenuItem` is the tenant/site-scoped sellable item contract under one `MenuCategory`.
- `MenuCategory` and `MenuItem` replace the V3 `Category` string model and the old `serviceCounterId` coupling.
- This document is the shared contract for:
  - `E1-07` room-session limit enforcement
  - `E3-07` Guest Kiosk three-column menu UI
  - future E5 menu API re-enable work

## Model Roles

### MenuCategory

- Identity:
  - `id`
  - `tenantId`
  - `siteId`
  - `key`
- Presentation:
  - `nameEn`
  - `nameTc`
  - `nameSc`
  - `imageUrl`
  - `sortOrder`
- Ordering behavior:
  - `orderMode`
  - `limitMode`
- Operations:
  - `defaultOperatorId`

### MenuItem

- Identity:
  - `id`
  - `tenantId`
  - `siteId`
  - `key`
  - `categoryId`
- Presentation:
  - `nameEn`
  - `nameTc`
  - `nameSc`
  - `descEn`
  - `descTc`
  - `descSc`
  - `imageUrl`
- Availability:
  - `isActive`
- Transitional note:
  - `stock` still exists in schema during E1, but V4 limit enforcement should pivot to `session_category_usage`

## orderMode × limitMode Matrix

| orderMode | limitMode | Guest UI 表现 | 限购校验逻辑 |
| --- | --- | --- | --- |
| `quantity` | `total_per_category` | 每个商品 `+/-` stepper；分类侧栏显示 `N/H used` | 该分类下所有商品累计数量 `<= headcount` |
| `quantity` | `per_item` | 每个商品 `+/-` stepper；每个商品独立计数 | 每个商品的累计数量 `<= headcount`，互不影响 |
| `one_off` | `total_per_category` | 商品点击切换选中/未选中，无 stepper | 同一商品一个 session 只能下单一次；分类内累计选择数 `<= headcount` |
| `one_off` | `per_item` | 商品点击切换选中/未选中 | 同一商品一个 session 只能下单一次；`per_item` 在 `one_off` 下退化为同语义 |

## session_category_usage 写入规则

### quantity 模式

- `quantity_used` 累加 `requested.qty`
- 若 `limitMode = per_item`
  - `item_id` 必填
  - 使用 `(session_id, category_id, item_id)` 唯一行累加
- 若 `limitMode = total_per_category`
  - `item_id = null`
  - 使用按分类汇总的一行记录累计

### one_off 模式

- `quantity_used` 固定写 `1`
- 记录存在即视为该商品已下单
- 若 `limitMode = per_item`
  - `item_id` 必填
  - `(session_id, category_id, item_id)` 必须唯一
- 若 `limitMode = total_per_category`
  - `item_id = null`
  - 分类累计数通过聚合分类写入/查询得到

### per_item 模式

- `item_id` 必填
- `(session_id, category_id, item_id)` 唯一
- 校验粒度是单商品，不与同分类其他商品共享计数

### total_per_category 模式

- `item_id = null`
- 逻辑上按 `(session_id, category_id)` 聚合一行
- 实现上 `item_id` 为 `null`，因为 PostgreSQL 中唯一约束 `(session_id, category_id, item_id)` 对 `null` 不参与唯一比较
- E1-07 需要在事务内显式读取并更新分类累计，不能仅依赖数据库唯一约束表达完整业务语义

## 失败响应

- `CATEGORY_FULL`
  - `total_per_category` 模式下，分类累计 `+ requested.qty > headcount`
- `ITEM_LIMIT_REACHED`
  - `per_item` 模式下，单商品累计 `+ requested.qty > headcount`
- `ITEM_TAKEN`
  - `one_off` 模式下，该商品已在当前 session 出现过

## E1-07 Implementation Notes

- 限购校验和 `session_category_usage` 写入必须放在同一个 Prisma `$transaction` 中，避免并发超卖/超用
- 并发场景下，后到请求可能因为 `session_category_usage` 唯一约束冲突抛出 `P2002`
- `P2002` 不能直接透传为数据库错误，应转换成业务错误码：
  - `ITEM_TAKEN`
  - 或按上下文转换为 `CATEGORY_FULL` / `ITEM_LIMIT_REACHED`
- 所有校验必须基于 `tenantId + siteId + sessionId` 范围，避免跨租户/跨站点污染

## E3 Guest UI Notes

- 分类侧栏显示 `N/H used`
  - `N` = 当前 session 在该分类下的累计使用量
  - `H` = 当前 session 的 `headcount`
- `quantity` 模式渲染 stepper
- `one_off` 模式渲染 toggle/选中态按钮
- 分类和商品文案显示优先级应按当前语言取 `nameSc/nameTc/nameEn`，回退到 `key`

## V3 To V4 Mapping

- `Category.name` -> `MenuCategory.key`
- `Category.nameZh` -> `MenuCategory.nameSc`
- `Category.nameHant` -> `MenuCategory.nameTc`
- `MenuItem.name` -> `MenuItem.key`
- `MenuItem.category` string -> `MenuItem.categoryId`
- `MenuItem.nameZh` -> `MenuItem.nameSc`
- `MenuItem.nameHant` -> `MenuItem.nameTc`
- `serviceCounterId` removed; operational routing now uses `MenuCategory.defaultOperatorId`
