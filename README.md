# Business Meeting Room Services System

完整架构设计与技术规格 (V2)

## 项目结构

```
Meeting_Room_System_Architecture_V3/
├── backend/              # 后端服务
│   ├── src/
│   │   ├── controllers/  # API 控制器
│   │   ├── middleware/   # 中间件
│   │   ├── routes/       # 路由
│   │   ├── lib/          # 工具库
│   │   └── index.js      # 主入口
│   ├── prisma/           # Prisma 配置
│   ├── package.json
│   └── .env
├── frontend/             # Flutter 前端
│   ├── lib/
│   │   ├── models/       # 数据模型
│   │   ├── providers/    # 状态管理
│   │   ├── services/     # API 服务
│   │   ├── screens/      # 页面
│   │   └── main.dart
│   └── pubspec.yaml
└── docker-compose.yml    # Docker 配置
```

## 快速开始

### 1. 启动数据库

```bash
docker compose up -d
```

### 2. 启动后端服务

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

### 3. 启动 Flutter 前端

首先需要安装 Flutter SDK，然后：

```bash
cd frontend
flutter pub get
flutter run
```

## API 文档

### POST /api/orders

创建新订单

**Headers:**
- `X-API-KEY`: meeting-room-secret-key-2024

**Body:**
```json
{
  "roomId": "Room 101",
  "items": [
    { "name": "Coffee", "qty": 2 }
  ]
}
```

### GET /api/orders

获取所有订单

### PATCH /api/orders/:id/status

更新订单状态

**Body:**
```json
{
  "status": "completed"
}
```

## WebSocket 事件

- `new_order`: 新订单创建时触发
- `order_updated`: 订单状态更新时触发

## 技术栈

### 后端
- Node.js + Express
- Prisma ORM
- PostgreSQL
- Socket.io

### 前端
- Flutter
- Provider (状态管理)
- Socket.io Client
