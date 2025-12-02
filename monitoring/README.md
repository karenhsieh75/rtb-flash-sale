# 监控配置

## 监控工具

### Prometheus + Grafana

#### 启动监控服务
```bash
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

#### 访问
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

### 关键指标

#### 应用指标
- **HTTP 请求数**: 按状态码分类
- **响应时间**: p50, p95, p99
- **错误率**: 4xx, 5xx 错误比例
- **WebSocket 连接数**: 实时连接数

#### 系统指标
- **CPU 使用率**: 各服务 CPU 使用
- **内存使用率**: 各服务内存使用
- **网络流量**: 入站/出站流量

#### Redis 指标
- **连接数**: 当前连接数
- **内存使用**: Redis 内存占用
- **命令执行数**: 每秒命令数
- **键数量**: 数据库键数量

#### 数据库指标
- **连接数**: 当前连接数
- **查询数**: 每秒查询数
- **慢查询**: 慢查询数量

## Auto-scaling (HPA)

### Kubernetes HPA 配置示例

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: bidding-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: bidding-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 扩展策略
- **CPU 阈值**: 70%
- **内存阈值**: 80%
- **最小实例**: 2
- **最大实例**: 10

## 告警规则

### Prometheus 告警规则示例

```yaml
groups:
- name: bidding_service_alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 5m
    annotations:
      summary: "错误率过高"
      
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    annotations:
      summary: "响应时间过长"
      
  - alert: HighCPUUsage
    expr: rate(container_cpu_usage_seconds_total[5m]) > 0.8
    for: 5m
    annotations:
      summary: "CPU 使用率过高"
```

## 监控最佳实践

1. **设置合理的阈值**: 根据实际负载调整
2. **定期检查**: 每天检查监控面板
3. **告警通知**: 配置邮件或 Slack 通知
4. **日志聚合**: 使用 ELK 或 Loki 聚合日志
5. **性能基线**: 建立性能基线，及时发现异常

