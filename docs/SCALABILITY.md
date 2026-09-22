# Scalability and Consistency

English | [繁體中文](./SCALABILITY.zh-TW.md)

## System Scalability

### 1. Horizontal Scaling

#### Backend Service Scaling
- **Stateless design**: every backend instance is stateless
- **Load balancing**: requests can be distributed via a load balancer
- **Session management**: JWT tokens remove the need for server-side session storage

```
┌─────────────┐
│ Load        │
│ Balancer    │
└──────┬──────┘
       │
   ┌───┴───┬─────────┬─────────┐
   │       │         │         │
┌──▼──┐ ┌──▼──┐  ┌──▼──┐  ┌──▼──┐
│ BE1 │ │ BE2 │  │ BE3 │  │ BEN │
└─────┘ └─────┘  └─────┘  └─────┘
```

#### Redis Scaling
- **Redis Cluster**: supports sharding and primary/replica replication
- **Data sharding**: can be sharded by product ID
- **Read/write splitting**: writes go to the primary, reads go to replicas

#### Database Scaling
- **Primary/replica replication**: supported by PostgreSQL
- **Read/write splitting**: writes to the primary, reads from replicas
- **Connection pooling**: manages database connections

### 2. Vertical Scaling

#### Resource Monitoring
- **CPU**: monitor usage and set threshold alerts
- **Memory**: monitor usage to prevent OOM
- **Connections**: monitor database and Redis connection counts

#### Performance Tuning
- **Connection pool size**: adjusted based on concurrency
- **Caching strategy**: optimize Redis cache hit rate
- **Database indexes**: optimize query performance

### 3. Scalability Targets

The numbers below are design targets, not measured benchmark results — `loadtest/` has Locust scripts capable of generating this kind of load, but no saved run backs these figures yet.

| Metric | Target (current setup) | Target (after scaling) |
|------|---------|-----------|
| Concurrent users | 1000+ | 10000+ |
| RPS | 1000+ | 10000+ |
| WebSocket connections | 1000+ | 10000+ |
| Response time (p95) | < 500ms | < 500ms |

## Consistency Guarantees

### 1. Strong Consistency Scenarios

#### Leaderboard Updates
- **Implementation**: atomic Lua Script operation
- **Guarantee**: single-threaded execution guarantees atomicity
- **Scenario**: updating the leaderboard when a bid is placed

```lua
-- Lua Script guarantees atomicity
local rank_key = KEYS[1]
local user_id = ARGV[1]
local score = ARGV[2]

-- Atomic update
redis.call("ZADD", rank_key, score, user_id)
```

#### Quota Checks
- **Implementation**: the auction time window is checked inside the Lua Script
- **Guarantee**: prevents bids after the auction has ended
- **Scenario**: checking auction status when a bid is placed

### 2. Eventual Consistency Scenarios

#### Database Writes
- **Implementation**: asynchronous goroutine writes
- **Guarantee**: eventually persisted to the database
- **Scenario**: bid records are persisted asynchronously

```go
// Asynchronous database write
go func() {
    s.db.Create(&database.BidLog{
        UserID: userID,
        ProductID: productID,
        Price: price,
        Score: score,
        CreatedAt: time.Now(),
    })
}()
```

#### WebSocket Push
- **Implementation**: asynchronous message broadcast
- **Guarantee**: all clients eventually receive the update
- **Scenario**: leaderboard update push

### 3. Consistency Model

#### CAP Theorem Analysis
- **Consistency**:
  - Leaderboard: strong consistency (Lua Script)
  - Database: eventual consistency (async writes)

- **Availability**:
  - High availability (multi-instance deployment)
  - Redis primary/replica replication *(target design, not yet set up — the current `docker-compose.yml` runs a single Redis node)*
  - Database primary/replica replication *(target design, not yet set up — the current `docker-compose.yml` runs a single PostgreSQL node)*

- **Partition Tolerance**:
  - Redis Cluster support *(target design; not currently deployed)*
  - Database primary/replica replication *(target design; not currently deployed)*

**Trade-off**: prioritize **Availability** and **Partition Tolerance**, while guaranteeing **Consistency** for critical paths (the leaderboard). Note: today's deployment is a single Redis instance and a single PostgreSQL instance, so the multi-node availability/partition-tolerance story above is a scaling plan, not the current state.

### 4. Data Consistency Verification

#### Verification Methods
1. **Bid record count <= K**: guaranteed by the Lua Script
2. **Leaderboard user count <= K**: automatically maintained by the Redis Sorted Set
3. **Database/Redis consistency**: would need a periodic verification script

> No such verification script exists in this repo yet (`loadtest/` currently only has `demo_script.py`, `locustfile.py`, `locustfile_demo.py`). This is a proposed check, not an implemented one.

## Performance Optimization Strategy

### 1. Caching Strategy

#### Redis Cache
- **Product config**: caches product parameters (K, alpha, beta, gamma)
- **Leaderboard**: live leaderboard (Sorted Set)
- **Highest bid**: caches the current highest bid

#### Cache Updates
- **Write-through**: cache is updated alongside the source of truth
- **Invalidation**: cache is cleared once the auction ends

### 2. Database Optimization

#### Indexes
```sql
-- Users table index
CREATE INDEX idx_users_username ON users(username);

-- Bid log indexes
CREATE INDEX idx_bid_logs_product ON bid_logs(product_id);
CREATE INDEX idx_bid_logs_user ON bid_logs(user_id);
```

#### Query Optimization
- **Pagination**: avoids full table scans
- **Connection pooling**: reuses database connections
- **Batch operations**: bulk writes for bid records

### 3. Network Optimization

#### HTTP
- **Compression**: Gzip-compressed responses
- **Keep-Alive**: reused HTTP connections
- **CDN**: static assets served via CDN

#### WebSocket
- **Heartbeat**: periodic Ping/Pong
- **Reconnection**: exponential backoff
- **Message compression**: large messages are compressed

## Monitoring and Alerting

### 1. Key Metrics

#### Performance Metrics
- **Response time**: p50, p95, p99
- **Throughput**: RPS (Requests Per Second)
- **Error rate**: 4xx/5xx ratio

#### System Metrics
- **CPU usage**: < 80%
- **Memory usage**: < 80%
- **Connections**: database and Redis connection counts

#### Business Metrics
- **Bid success rate**: > 95%
- **Leaderboard update latency**: < 100ms
- **WebSocket connections**: monitored in real time

### 2. Alert Rules

#### Thresholds
- **Response time p95 > 1s**: alert
- **Error rate > 5%**: alert
- **CPU usage > 90%**: alert
- **Memory usage > 90%**: alert

## Failure Recovery

### 1. Failure Scenarios

#### Redis Failure
- **Impact**: the leaderboard can't be updated
- **Recovery**: rebuild the leaderboard from the database
- **Prevention (planned)**: Redis primary/replica replication — not yet deployed

#### Database Failure
- **Impact**: data can't be persisted
- **Recovery**: recover data from Redis
- **Prevention (planned)**: database primary/replica replication — not yet deployed

#### Service Failure
- **Impact**: the service becomes unavailable
- **Recovery**: automatic restart or instance failover
- **Prevention**: multi-instance deployment with health checks

### 2. Data Recovery

> The two snippets below sketch the recovery approach; neither `RecoverRankingsFromRedis` nor `RebuildRankingsFromDB` exists in the codebase yet — this is a proposed design, not a shipped feature.

#### Recovering from Redis (proposed)
```go
// Recover the leaderboard from Redis into the database
func RecoverRankingsFromRedis(productID string) {
    // Read the leaderboard from Redis
    // Write it to the database
}
```

#### Recovering from the Database (proposed)
```go
// Rebuild the Redis leaderboard from the database
func RebuildRankingsFromDB(productID string) {
    // Read bid records from the database
    // Rebuild the Redis leaderboard
}
```

## Summary

### Scalability
- ✅ **Horizontal scaling**: the API is stateless, so multiple backend instances can be run behind a load balancer (not yet deployed that way)
- 🔲 **Cluster/replica scaling**: Redis Cluster and PostgreSQL replicas are a planned next step, not yet set up
- ✅ **Cache optimization**: Redis caches hot data (leaderboard, product config)
- ✅ **Database optimization**: indexing and connection pooling in place

### Consistency
- ✅ **Strong consistency**: leaderboard updates (Lua Script)
- ✅ **Eventual consistency**: database writes (async)
- 🔲 **Data validation**: a periodic verification script is proposed but not implemented
- 🔲 **Failure recovery**: the recovery functions above are a design sketch, not implemented

### Performance
- 🔲 **Response time / throughput / WebSocket latency targets above**: design goals only — no load-test results in this repo currently confirm them
