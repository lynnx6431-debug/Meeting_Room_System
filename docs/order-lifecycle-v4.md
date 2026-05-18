# Order Lifecycle V4

## Overview

- Scope: V4 order lifecycle contract for backend refactor and Counter Portal rebuild.
- Status enum: `pending -> acknowledged -> done`
- Order rows are tenant/site scoped and may optionally attach to a room session.

## State Machine

```text
pending -> acknowledged -> done
```

- `pending`
  - Trigger: kiosk creates an order
  - Meaning: order is submitted and waiting for operator acknowledgement
- `acknowledged`
  - Trigger: counter/operator accepts the order
  - Meaning: work has started or ownership has been taken
- `done`
  - Trigger: counter/operator marks the order completed
  - Meaning: fulfillment is complete

## Field Usage By Transition

### Create Order

- Trigger: kiosk places a new order
- Required fields written:
  - `tenantId`
  - `siteId`
  - `roomId`
  - `items`
  - `status = pending`
- Optional fields written:
  - `sessionId`
- Must remain `null` on create:
  - `acknowledgedAt`
  - `acknowledgedBy`
  - `completedAt`
  - `completedBy`

### Pending To Acknowledged

- Trigger: counter/operator accepts the order
- Fields updated:
  - `status = acknowledged`
  - `acknowledgedAt = now()`
  - `acknowledgedBy = currentUser.id`
- Fields unchanged:
  - `completedAt`
  - `completedBy`

### Acknowledged To Done

- Trigger: counter/operator completes the order
- Fields updated:
  - `status = done`
  - `completedAt = now()`
  - `completedBy = currentUser.id`
- Fields preserved:
  - `acknowledgedAt`
  - `acknowledgedBy`

## V3 To V4 Mapping

- `status: pending` stays `pending`
- `status: completed` is renamed to `done`
- `status: acknowledged` is new in V4
- `tenantId` and `siteId` are new required fields
- `sessionId`, `acknowledgedAt`, `acknowledgedBy`, `completedAt`, `completedBy` are new optional fields
- V3 logic that directly decremented `menu_items.stock` on order creation is no longer the V4 contract
- V4 fulfillment and entitlement checks should move to `session_category_usage` and tenant/site-aware services

## Implementation Notes For E4

- Counter Portal rebuild should treat `acknowledged` as the active working state
- Audit displays should show both acknowledgement and completion actors/timestamps
- Any future analytics should group by `tenantId`, `siteId`, and optionally `sessionId`
- Re-enabled order APIs should reject legacy `completed` writes and normalize callers to `done`
