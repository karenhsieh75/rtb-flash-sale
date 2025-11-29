# 後端 API 規格說明

本文檔說明前端需要後端提供的所有 API 端點、請求格式和響應格式。

## 基礎資訊

- **Base URL**: `http://localhost:8000/api` (開發環境)
- **認證方式**: Bearer Token (JWT)
- **Content-Type**: `application/json`
- **時間格式**: Unix timestamp (毫秒) 或 ISO 8601 字符串

## 認證相關 API

### 1. 用戶登入

**端點**: `POST /auth/login`

**請求體**:
```json
{
  "username": "string",
  "password": "string",
  "role": "member" | "admin"
}
```

**響應** (200 OK):
```json
{
  "token": "string",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "weight": 1.2,
    "role": "member" | "admin"
  }
}
```

**錯誤響應** (401 Unauthorized):
```json
{
  "error": "帳號或密碼錯誤"
}
```

---

### 2. 用戶登出

**端點**: `POST /auth/logout`

**請求頭**: 
```
Authorization: Bearer {token}
```

**響應** (200 OK):
```json
{
  "message": "登出成功"
}
```

---

### 3. 驗證 Token

**端點**: `GET /auth/verify`

**請求頭**: 
```
Authorization: Bearer {token}
```

**響應** (200 OK):
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "weight": 1.2,
    "role": "member" | "admin"
  }
}
```

---

## 商品相關 API

### 4. 獲取所有商品列表

**端點**: `GET /products`

**請求頭**: 
```
Authorization: Bearer {token}
```

**響應** (200 OK):
```json
{
  "products": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "basePrice": 1000,
      "k": 5,
      "startTime": 1234567890000,
      "endTime": 1234567890000,
      "status": "not_started" | "active" | "ended",
      "currentHighestPrice": 1200,
      "alpha": 1.0,
      "beta": 0.5,
      "gamma": 0.3
    }
  ]
}
```

---

### 5. 獲取單一商品詳情

**端點**: `GET /products/:productId`

**請求頭**: 
```
Authorization: Bearer {token}
```

**響應** (200 OK):
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "basePrice": 1000,
  "k": 5,
  "startTime": 1234567890000,
  "endTime": 1234567890000,
  "status": "not_started" | "active" | "ended",
  "currentHighestPrice": 1200,
  "alpha": 1.0,
  "beta": 0.5,
  "gamma": 0.3
}
```

**錯誤響應** (404 Not Found):
```json
{
  "error": "商品不存在"
}
```

---

### 6. 獲取商品排行榜

**端點**: `GET /products/:productId/rankings`

**請求頭**: 
```
Authorization: Bearer {token}
```

**響應** (200 OK):
```json
{
  "rankings": [
    {
      "rank": 1,
      "userId": "string",
      "displayName": "User_***1234",
      "price": 1200,
      "reactionTime": 100,
      "weight": 1.2,
      "score": 1340.0
    }
  ],
  "thresholdScore": 1200.0,
  "currentHighestPrice": 1200
}
```

---

### 7. 提交出價

**端點**: `POST /products/:productId/bids`

**請求頭**: 
```
Authorization: Bearer {token}
```

**請求體**:
```json
{
  "price": 1500
}
```

**響應** (200 OK):
```json
{
  "message": "出價成功",
  "bid": {
    "id": "string",
    "productId": "string",
    "userId": "string",
    "price": 1500,
    "timestamp": 1234567890000
  }
}
```

**錯誤響應** (400 Bad Request):
```json
{
  "error": "出價需高於起標價"
}
```

**錯誤響應** (400 Bad Request):
```json
{
  "error": "活動尚未開始或已結束"
}
```

---

### 8. 獲取商品競標結果

**端點**: `GET /products/:productId/results`

**請求頭**: 
```
Authorization: Bearer {token}
```

**響應** (200 OK):
```json
{
  "results": [
    {
      "rank": 1,
      "userId": "string",
      "displayName": "User_***1234",
      "finalPrice": 1500,
      "finalScore": 1700.0,
      "isWinner": true
    }
  ]
}
```

**錯誤響應** (400 Bad Request):
```json
{
  "error": "活動尚未結束"
}
```

---

## 管理員 API (需要 Admin 角色)

### 9. 創建商品

**端點**: `POST /admin/products`

**請求頭**: 
```
Authorization: Bearer {token}
```

**請求體**:
```json
{
  "title": "string",
  "description": "string",
  "basePrice": 1000,
  "k": 5,
  "startTime": 1234567890000,
  "endTime": 1234567890000,
  "alpha": 1.0,
  "beta": 0.5,
  "gamma": 0.3
}
```

**響應** (201 Created):
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "basePrice": 1000,
  "k": 5,
  "startTime": 1234567890000,
  "endTime": 1234567890000,
  "status": "not_started",
  "currentHighestPrice": 1000,
  "alpha": 1.0,
  "beta": 0.5,
  "gamma": 0.3
}
```

---

### 10. 更新商品

**端點**: `PUT /admin/products/:productId`

**請求頭**: 
```
Authorization: Bearer {token}
```

**請求體**:
```json
{
  "title": "string",
  "description": "string",
  "basePrice": 1000,
  "k": 5,
  "startTime": 1234567890000,
  "endTime": 1234567890000,
  "alpha": 1.0,
  "beta": 0.5,
  "gamma": 0.3,
  "status": "not_started" | "active" | "ended"
}
```

**響應** (200 OK):
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "basePrice": 1000,
  "k": 5,
  "startTime": 1234567890000,
  "endTime": 1234567890000,
  "status": "active",
  "currentHighestPrice": 1000,
  "alpha": 1.0,
  "beta": 0.5,
  "gamma": 0.3
}
```

---

### 11. 更新商品狀態

**端點**: `PATCH /admin/products/:productId/status`

**請求頭**: 
```
Authorization: Bearer {token}
```

**請求體**:
```json
{
  "status": "not_started" | "active" | "ended"
}
```

**響應** (200 OK):
```json
{
  "id": "string",
  "status": "active"
}
```

---

### 12. 刪除商品

**端點**: `DELETE /admin/products/:productId`

**請求頭**: 
```
Authorization: Bearer {token}
```

**響應** (200 OK):
```json
{
  "message": "商品已刪除"
}
```

---

## WebSocket 連接

### 連接端點

**URL**: `ws://localhost:8000/ws`

**認證**: 連接時需要在 URL 參數中傳遞 token
```
ws://localhost:8000/ws?token={token}
```

### 消息格式

#### 1. 訂閱商品更新

**發送**:
```json
{
  "type": "subscribe",
  "productId": "string"
}
```

**接收** (商品狀態更新):
```json
{
  "type": "product_update",
  "product": {
    "id": "string",
    "status": "active",
    "currentHighestPrice": 1200
  }
}
```

---

#### 2. 訂閱排行榜更新

**發送**:
```json
{
  "type": "subscribe_rankings",
  "productId": "string"
}
```

**接收** (排行榜更新):
```json
{
  "type": "rankings_update",
  "productId": "string",
  "rankings": [
    {
      "rank": 1,
      "userId": "string",
      "displayName": "User_***1234",
      "price": 1200,
      "reactionTime": 100,
      "weight": 1.2,
      "score": 1340.0
    }
  ],
  "thresholdScore": 1200.0,
  "currentHighestPrice": 1200
}
```

---

#### 3. 出價通知

**接收** (當其他用戶出價時):
```json
{
  "type": "bid_notification",
  "productId": "string",
  "bid": {
    "userId": "string",
    "displayName": "User_***5678",
    "price": 1500,
    "timestamp": 1234567890000
  }
}
```

---

#### 4. 活動狀態變更

**接收** (當活動開始或結束時):
```json
{
  "type": "activity_status_change",
  "productId": "string",
  "status": "active" | "ended",
  "timestamp": 1234567890000
}
```

---

## 錯誤處理

所有 API 錯誤響應遵循以下格式：

```json
{
  "error": "錯誤訊息",
  "code": "ERROR_CODE",
  "details": {}
}
```

### 常見錯誤碼

- `UNAUTHORIZED` (401): 未授權，需要登入
- `FORBIDDEN` (403): 權限不足，需要特定角色
- `NOT_FOUND` (404): 資源不存在
- `BAD_REQUEST` (400): 請求參數錯誤
- `INTERNAL_ERROR` (500): 伺服器內部錯誤

---

## 數據類型定義

### ProductStatus
```typescript
type ProductStatus = "not_started" | "active" | "ended"
```

### UserRole
```typescript
type UserRole = "member" | "admin"
```

### Product
```typescript
interface Product {
  id: string
  title: string
  description: string
  basePrice: number
  k: number
  startTime: number  // Unix timestamp (毫秒)
  endTime: number    // Unix timestamp (毫秒)
  status: ProductStatus
  currentHighestPrice: number
  alpha?: number
  beta?: number
  gamma?: number
}
```

### RankingItem
```typescript
interface RankingItem {
  rank: number
  userId: string
  displayName: string
  price: number
  reactionTime: number  // 毫秒
  weight: number
  score: number
}
```

### ProductResult
```typescript
interface ProductResult {
  rank: number
  userId: string
  displayName: string
  finalPrice: number
  finalScore: number
  isWinner: boolean
}
```

---

## 注意事項

1. **認證**: 除了登入 API，所有 API 都需要在請求頭中攜帶 `Authorization: Bearer {token}`
2. **權限**: 管理員 API 需要用戶角色為 `admin`
3. **時間格式**: 所有時間戳使用 Unix timestamp (毫秒)
4. **分頁**: 商品列表和排行榜可能需要分頁，但目前前端未實現，後端可先返回所有數據
5. **實時更新**: 排行榜和商品狀態建議通過 WebSocket 推送，減少輪詢請求
6. **用戶 ID 隱私**: 排行榜中的 `displayName` 應該隱藏部分用戶 ID，例如 `User_***1234`

---

## 整合範例

### 前端 API 調用範例

```typescript
// 登入
const response = await fetch('http://localhost:8000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'user123',
    password: 'password',
    role: 'member'
  })
});

const data = await response.json();
localStorage.setItem('token', data.token);

// 獲取商品列表
const productsResponse = await fetch('http://localhost:8000/api/products', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

// WebSocket 連接
const ws = new WebSocket(`ws://localhost:8000/ws?token=${token}`);
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // 處理消息
};
```

---

如有疑問或需要補充，請聯繫前端開發團隊。

