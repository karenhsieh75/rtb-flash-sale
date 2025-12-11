#!/bin/bash

# 压力测试运行脚本

set -e

echo "=========================================="
echo "压力测试运行脚本"
echo "=========================================="
echo ""
echo "请选择要运行的测试："
echo "1. Locust 压力测试（Web UI 模式）"
echo "2. Locust 压力测试（无头模式，1000用户，5分钟）"
echo "3. K6 压力测试"
echo "4. 一致性测试（防超卖）"
echo "5. WebSocket 压力测试"
echo "6. 更新出价场景测试"
echo "7. 安装所有依赖"
echo ""
read -p "请输入选项 (1-7): " choice

cd "$(dirname "$0")"

case $choice in
    1)
        echo "启动 Locust Web UI..."
        echo "访问 http://localhost:8089 开始测试"
        locust -f locustfile.py
        ;;
    2)
        echo "运行 Locust 无头模式测试..."
        locust -f locustfile.py --headless --users=1000 --spawn-rate=50 --run-time=5m
        ;;
    3)
        echo "运行 K6 压力测试..."
        k6 run k6_script.js
        ;;
    4)
        echo "运行一致性测试..."
        python3 consistency_test.py
        ;;
    5)
        echo "运行 WebSocket 压力测试..."
        python3 websocket_test.py
        ;;
    6)
        echo "运行更新出价场景测试..."
        locust -f locust_update_bid.py --headless --users=100 --spawn-rate=10 --run-time=2m
        ;;
    7)
        echo "安装依赖..."
        pip install -r requirements.txt
        echo "✓ 依赖安装完成"
        ;;
    *)
        echo "无效选项"
        exit 1
        ;;
esac

