# 即時競標系統 (RTB Flash Sale)

一個基於 Go + React 的即時競標/限時搶購系統，支持實時排行榜更新、出價競標、管理後台等功能。

## 🚀 功能特色

### 用戶功能
- 🔐 **用戶認證**：註冊、登入（支持 Member 和 Admin 角色）
- 📦 **商品大廳**：查看所有商品及其狀態（準備中/競標中/已結束）
- 🎯 **競標頁面**：單一商品詳細頁面，包含出價表單和即時排行榜
- 📊 **實時更新**：WebSocket 實時推送排行榜和商品狀態更新
- 🏆 **結果展示**：活動結束後顯示最終得標結果

### 管理員功能
- 👨‍💼 **商品管理**：新增、編輯商品，切換商品狀態
- ⚙️ **參數配置**：設置商品起標價、限量數量 K、動態權重參數（α, β, γ）

## 🏗️ 技術架構

### 後端 (Go)
- **框架**: Gin
- **資料庫**: PostgreSQL (持久化存儲)
- **快取**: Redis (排行榜、出價記錄)
- **認證**: JWT
- **實時通信**: WebSocket (gorilla/websocket)
- **腳本**: Lua Script (防止超賣、原子操作)

### 前端 (React)
- **框架**: React 19.2 + TypeScript
- **構建工具**: Vite 7.2
- **樣式**: Tailwind CSS 3.4
- **路由**: React Router DOM 7.1
- **狀態管理**: React Context API
- **實時通信**: WebSocket

### 基礎設施
- **容器化**: Docker + Docker Compose
- **資料庫**: PostgreSQL 13
- **快取**: Redis (Alpine)

## 📁 項目結構

```
rtb-flash-sale/
├── backend/                 # Go 後端
│   ├── internal/
│   │   ├── auth/           # 認證模組
│   │   ├── bidding/        # 競標模組
│   │   ├── product/        # 商品模組
│   │   ├── websocket/      # WebSocket 模組
│   │   ├── database/       # 資料庫配置
│   │   └── models/         # 資料模型
│   ├── scripts/
│   │   └── place_bid.lua   # Lua 腳本（防止超賣）
│   ├── main.go             # 入口文件
│   ├── Dockerfile          # 生產環境
│   └── Dockerfile.dev      # 開發環境
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/     # 共用組件
│   │   ├── pages/         # 頁面組件
│   │   ├── services/      # API 服務
│   │   ├── contexts/       # Context 提供者
│   │   └── types/         # TypeScript 類型
│   ├── Dockerfile          # 生產環境
│   └── Dockerfile.dev      # 開發環境
├── docker-compose.yml      # Docker Compose 配置
└── README.md              # 本文件
```

## 🚀 快速開始

### 前置要求

- Docker & Docker Compose
- Go 1.25+ (本地開發)
- Node.js 18+ (本地開發)

### 使用 Docker Compose（推薦）

1. **克隆項目**
```bash
git clone <repository-url>
cd rtb-flash-sale
```

2. **啟動所有服務**
```bash
docker-compose up -d
```

這會啟動：
- Redis (port 6379)
- PostgreSQL (port 5432)
- Backend API (port 8000)
- Frontend (port 5173)

3. **訪問應用**
- 前端: http://localhost:5173
- 後端 API: http://localhost:8000/api

### 本地開發

#### 後端開發

```bash
cd backend

# 安裝依賴
go mod download

# 啟動服務（需要先啟動 Redis 和 PostgreSQL）
go run main.go
```

#### 前端開發

```bash
cd frontend

# 安裝依賴
npm install

# 啟動開發服務器
npm run dev
```

## 🔧 環境變數

### 後端
- `REDIS_HOST`: Redis 主機地址（默認: localhost）
- `DB_HOST`: PostgreSQL 主機地址（默認: localhost）

### 前端
- `VITE_API_BASE_URL`: 後端 API 地址（默認: http://localhost:8000/api）
- `VITE_WS_BASE_URL`: WebSocket 地址（默認: ws://localhost:8000）

## 📊 核心功能說明

### 1. 出價系統

- 使用 **Lua Script** 在 Redis 中原子性執行出價操作
- 防止超賣：檢查活動時間、更新排行榜
- 計算 Score：`score = (α × price) + (β / (t + 1)) + (γ × weight)`

### 2. 排行榜系統

- 使用 Redis Sorted Set 維護實時排行榜
- 根據 Score 動態排序
- 只保留前 K 名（限量數量）

### 3. WebSocket 實時推送

- 商品狀態更新
- 排行榜更新
- 出價通知
- 活動狀態變更

### 4. Redis Key 結構

```
auction:{productId}:rank          # Sorted Set (排行榜)
auction:{productId}:bids          # Hash (出價詳情)
auction:{productId}:config        # Hash (商品配置)
```

## 🧪 測試流程

1. **註冊用戶**
   - 訪問 http://localhost:5173/register
   - 選擇角色（Member 或 Admin）
   - 註冊新帳號

2. **登入**
   - 使用註冊的帳號登入

3. **管理員創建商品**（需要 Admin 角色）
   - 訪問 http://localhost:5173/admin/products
   - 點擊「新增商品」
   - 填寫商品資訊並保存

4. **用戶競標**
   - 訪問 http://localhost:5173/products
   - 選擇「競標中」的商品
   - 輸入出價金額並提交
   - 查看實時排行榜更新

## 📝 API 文檔

詳細的 API 規格請參考：[frontend/API_SPEC.md](./frontend/API_SPEC.md)

## 🐳 Docker 部署

### 生產環境

```bash
# 構建並啟動
docker-compose -f docker-compose.yml up -d

# 查看日誌
docker-compose logs -f

# 停止服務
docker-compose down
```

### 開發環境

```bash
# 使用開發配置
docker-compose up -d
```

## 🔒 安全注意事項

1. **JWT Secret**: 生產環境請修改 `backend/internal/auth/service.go` 中的 `jwtSecret`
2. **資料庫密碼**: 生產環境請修改 `docker-compose.yml` 中的資料庫密碼
3. **CORS 配置**: 生產環境請更新 `backend/main.go` 中的 CORS 允許來源

## 📈 性能優化

- Redis 快取排行榜，減少資料庫查詢
- Lua Script 原子操作，避免競態條件
- WebSocket 實時推送，減少輪詢請求
- 異步寫入資料庫，提高響應速度

## 🐛 故障排除

### 後端無法連接 Redis
- 檢查 Redis 是否啟動：`docker ps | grep redis`
- 檢查環境變數 `REDIS_HOST` 是否正確

### 前端無法連接後端
- 檢查後端是否啟動：`curl http://localhost:8000/api/products`
- 檢查 CORS 配置是否正確

### WebSocket 連接失敗
- 檢查 token 是否有效
- 檢查 WebSocket URL 是否正確
- 查看瀏覽器控制台錯誤訊息

## 📄 授權

MIT License

## 👥 貢獻

歡迎提交 Issue 和 Pull Request！

## 📞 聯繫

如有問題或建議，請聯繫開發團隊。

