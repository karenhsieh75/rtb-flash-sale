# 压力测试与数据验证

## 压力测试工具

### Locust

#### 安装
```bash
pip install locust
```

#### 运行测试
```bash
# 基础测试
locust -f locustfile.py --host=http://localhost:8000

# 指数型成长频率测试
locust -f locustfile.py --host=http://localhost:8000 --users=1000 --spawn-rate=10

# 无 Web UI 模式
locust -f locustfile.py --host=http://localhost:8000 --headless --users=1000 --spawn-rate=10 --run-time=5m
```

#### 访问 Web UI
打开浏览器访问: http://localhost:8089

### K6

#### 安装
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D53
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

#### 运行测试
```bash
# 基础测试
k6 run k6_script.js

# 指定基础 URL
k6 run --env BASE_URL=http://localhost:8000 k6_script.js

# 输出 JSON 报告
k6 run --out json=results.json k6_script.js
```

## 数据验证

### 验证脚本

运行数据验证脚本，检查「訂單數 <= 庫存數」：

```bash
# 安装依赖
pip install psycopg2-binary redis

# 运行验证
python verify_data.py

# 生成报告
python verify_data.py > verification_report.txt
```

### 验证内容

1. **检查每个商品的出价记录数是否 <= K**
2. **检查 Redis 排行榜中的用户数是否 <= K**
3. **检查前 K 名用户是否正确**
4. **生成验证报告**

## 测试场景

### 场景 1: 基础压力测试
- 1000 并发用户
- 持续 5 分钟
- 随机出价频率

### 场景 2: 指数型成长频率
- 初始频率：0.1 次/秒
- 每 10 秒频率翻倍
- 最大频率：10 次/秒
- 测试系统在指数增长下的表现

### 场景 3: 峰值压力测试
- 快速增加到 1000 用户
- 持续 2 分钟峰值
- 观察系统响应时间和错误率

## 监控指标

### 关键指标
- **响应时间**: p95 < 500ms
- **错误率**: < 10%
- **吞吐量**: 每秒请求数 (RPS)
- **并发连接数**: WebSocket 连接数

### 系统资源
- **CPU 使用率**: < 80%
- **内存使用率**: < 80%
- **Redis 连接数**: < 最大连接数
- **数据库连接数**: < 最大连接池大小

## 预期结果

### 成功标准
1. ✅ 系统不崩溃
2. ✅ 响应时间在可接受范围内
3. ✅ 错误率低于阈值
4. ✅ 没有超卖（訂單數 <= 庫存數）
5. ✅ 排行榜数据一致性

### 性能目标
- **出价 API**: p95 < 500ms
- **排行榜 API**: p95 < 200ms
- **WebSocket 延迟**: < 100ms
- **并发支持**: 1000+ 用户

