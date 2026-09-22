# RTB Flash Sale

English | [繁體中文](./README.zh-TW.md)

A real-time bidding / flash-sale system built with Go + React, supporting live leaderboard updates, competitive bidding, and an admin dashboard.

## 🚀 Features

### User Features
- 🔐 **Authentication**: Register and log in (supports Member and Admin roles)
- 📦 **Product Lobby**: View all products and their status (upcoming / bidding / ended)
- 🎯 **Bidding Page**: Dedicated product page with a bid form and a live leaderboard
- 📊 **Real-time Updates**: WebSocket pushes for leaderboard and product status changes
- 🏆 **Results**: Final winners are displayed once the auction ends

### Admin Features
- 👨‍💼 **Product Management**: Create and edit products
- ⚙️ **Parameter Configuration**: Set starting price, quota (K), and dynamic weight parameters (α, β, γ)
- 📅 **Schedule Management**: Set start/end times (with local timezone support)

## 🏗️ Tech Stack

### Backend (Go)
- **Framework**: Gin
- **Database**: PostgreSQL (persistent storage)
- **Cache**: Redis (leaderboard, bid records)
- **Auth**: JWT
- **Real-time**: WebSocket (gorilla/websocket)
- **Scripting**: Lua Script (prevents overselling, atomic operations)

### Frontend (React)
- **Framework**: React 19.2 + TypeScript
- **Build Tool**: Vite 7.2
- **Styling**: Tailwind CSS 3.4
- **Routing**: React Router DOM 7.1
- **State Management**: React Context API
- **Real-time**: WebSocket

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Database**: PostgreSQL 13
- **Cache**: Redis (Alpine)

## 📁 Project Structure

```
rtb-flash-sale/
├── backend/                 # Go backend
│   ├── internal/
│   │   ├── auth/           # Auth module
│   │   ├── bidding/        # Bidding module
│   │   ├── product/        # Product module
│   │   ├── websocket/      # WebSocket module
│   │   ├── database/       # Database configuration
│   │   └── models/         # Data models
│   ├── scripts/
│   │   └── place_bid.lua   # Lua script (prevents overselling)
│   ├── main.go             # Entry point
│   ├── Dockerfile          # Production
│   └── Dockerfile.dev      # Development
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/     # Shared components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── contexts/       # Context providers
│   │   └── types/         # TypeScript types
│   ├── Dockerfile          # Production
│   └── Dockerfile.dev      # Development
├── docker-compose.yml      # Docker Compose config
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Go 1.25+ (for local development)
- Node.js 18+ (for local development)

### Using Docker Compose (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd rtb-flash-sale
```

2. **Start all services**
```bash
docker-compose up -d
```

This will start:
- Redis (port 6379)
- PostgreSQL (port 5432)
- Backend API (port 8000)
- Frontend (port 5173)

3. **Access the app**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api

### Local Development

#### Backend

```bash
cd backend

# Install dependencies
go mod download

# Run the server (Redis and PostgreSQL must be running first)
go run main.go
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

## 🔧 Environment Variables

### Backend
- `REDIS_HOST`: Redis host (default: localhost)
- `DB_HOST`: PostgreSQL host (default: localhost)

### Frontend
- `VITE_API_BASE_URL`: Backend API base URL (default: http://localhost:8000/api)
- `VITE_WS_BASE_URL`: WebSocket base URL (default: ws://localhost:8000)

## 📊 Core Features

### 1. Bidding System

- Atomic bid placement in Redis via a **Lua Script**
- Prevents overselling: checks the auction time window and updates the leaderboard
- **Bid validation**: a bid must exceed the current highest bid (validated on both frontend and backend)
- Score formula: `score = (α × price) + (β / (t + 1)) + (γ × weight)`
- Real-time updates: the current highest bid and leaderboard update immediately after a bid

### 2. Leaderboard System

- Uses a Redis Sorted Set to maintain the live leaderboard
- Dynamically ranked by score
- Keeps only the top K entries (the quota)
- **Real usernames**: usernames are looked up from the database instead of being masked
- Real-time updates: leaderboard changes are pushed via WebSocket

### 3. WebSocket Real-time Push

- **Product status updates**: auction status and current highest bid synced in real time
- **Leaderboard updates**: pushed immediately after each bid
- **Bid notifications**: subscribers are notified instantly of new bids
- **Auction status changes**: pushed automatically when an auction starts/ends
- **Automatic results**: final results load and display automatically when the auction ends, no refresh needed

### 4. Redis Key Structure

```
auction:{productId}:rank          # Sorted Set (leaderboard)
auction:{productId}:bids          # Hash (bid details)
auction:{productId}:config        # Hash (product config)
```

## 🧪 Testing & Load Testing

### Functional / Manual Testing
1. **Register**
   - Visit http://localhost:5173/register, choose Member or Admin
2. **Log in**
   - Log in with your registered account
3. **Admin creates a product** (requires Admin role)
   - Visit http://localhost:5173/admin/products → Add Product
4. **User bidding**
   - Visit http://localhost:5173/products → select a product that is "bidding" → place a bid (must exceed the current highest bid)
   - The leaderboard and current highest bid update in real time via WebSocket
5. **View results**
   - Results are shown automatically once the auction ends (top K winners)

### Load Testing (Locust)
- Install dependencies: `pip install -r loadtest/requirements.txt`
- Demo script (auto-creates a product, staged/exponential ramp-up):
  ```bash
  cd loadtest
  locust -f locustfile_demo.py --host=https://d28wqj892frr80.cloudfront.net --run-time=3m
  # Open http://localhost:8089 to adjust users / spawn-rate
  ```
- Base script (no auto product creation):
  ```bash
  cd loadtest
  locust -f locustfile.py --host=https://d28wqj892frr80.cloudfront.net \
    --users=500 --spawn-rate=50 --run-time=3m --headless
  ```
- One-shot script: `loadtest/run_loadtest.sh` (extend as needed)

## 📝 Documentation

- [API Spec](./frontend/API_SPEC.md)
- [System Architecture](./docs/ARCHITECTURE.md)
- [Scalability & Consistency](./docs/SCALABILITY.md)

## 🐳 Docker Deployment

### Production

```bash
# Build and start
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Development

```bash
# Use the development config
docker-compose up -d
```

## 🔒 Security Notes

1. **JWT Secret**: change `jwtSecret` in `backend/internal/auth/service.go` before production use
2. **Database Password**: change the database password in `docker-compose.yml` before production use
3. **CORS Configuration**: update the allowed origins in `backend/main.go` before production use

## 📈 Performance Optimizations

- Redis caches the leaderboard, reducing database queries
- Lua Script atomic operations avoid race conditions
- WebSocket real-time push reduces polling requests
- Asynchronous database writes improve response times
- Smart status updates: auction status is checked and updated automatically when it ends
- Result loading retry mechanism ensures results display correctly once the auction ends

## ✨ Latest Updates

### v1.1.0
- ✅ **Stronger bid validation**: double validation on frontend and backend to ensure bids exceed the current highest price
- ✅ **Improved real-time updates**: current highest bid and leaderboard stay in sync in real time
- ✅ **Auction end automation**: results are shown automatically when an auction ends, no manual refresh needed
- ✅ **Real usernames**: leaderboard shows real usernames instead of masked ones
- ✅ **Timezone fix**: product editing correctly handles local timezones
- ✅ **Admin UI improvements**: admins can return to the product list from the admin page

## 🐛 Troubleshooting

### Backend can't connect to Redis
- Check that Redis is running: `docker ps | grep redis`
- Check that the `REDIS_HOST` environment variable is correct

### Frontend can't connect to the backend
- Check that the backend is running: `curl http://localhost:8000/api/products`
- Check the CORS configuration
- Make sure `VITE_API_BASE_URL` is set to `http://localhost:8000/api`

### WebSocket connection fails
- Check that the token is valid
- Check that the WebSocket URL is correct (should be `ws://localhost:8000/ws`)
- Check the browser console for errors
- Make sure the backend's WebSocket route is set up correctly

### Bid validation issues
- Make sure the bid amount exceeds the current highest bid
- Check that frontend and backend validation logic match
- Check the browser console and backend logs for errors

### Results don't display when the auction ends
- Make sure the auction end time has actually passed
- Check that the backend status has been updated to `ended`
- Check the browser console for errors while loading results
- The system retries loading results automatically; refresh the page if the issue persists

### Timezone issues
- When editing a product, times are shown in the local timezone
- Times are correctly converted to timestamps on save
- If times look wrong, check your browser's timezone settings

## 📄 License

MIT License

## 👥 Contributing

Issues and Pull Requests are welcome!

## 📞 Contact

Please contact the development team with any questions or suggestions.
