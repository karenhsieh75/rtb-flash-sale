#!/bin/bash

# 测试数据准备脚本

set -e

echo "=========================================="
echo "准备测试数据"
echo "=========================================="

BASE_URL="${BASE_URL:-https://d28wqj892frr80.cloudfront.net}"

# 创建测试用户（Member）
echo "创建测试用户（Member）..."
for i in {1..10}; do
    curl -X POST "$BASE_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"test_member_$i\",
            \"password\": \"test123456\",
            \"role\": \"member\"
        }" || true
done

# 创建测试管理员
echo "创建测试管理员..."
curl -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"username\": \"test_admin\",
        \"password\": \"test123456\",
        \"role\": \"admin\"
    }" || true

# 登录管理员
echo "登录管理员..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"username\": \"test_admin\",
        \"password\": \"test123456\"
    }")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "无法获取管理员 token，跳过商品创建"
    exit 0
fi

# 创建测试商品
echo "创建测试商品..."
NOW=$(date +%s)000
START_TIME=$((NOW + 60000))  # 1分钟后开始
END_TIME=$((NOW + 3600000))  # 1小时后结束

curl -X POST "$BASE_URL/api/admin/products" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
        \"title\": \"测试商品\",
        \"description\": \"用于测试的商品\",
        \"basePrice\": 1000,
        \"k\": 5,
        \"startTime\": $START_TIME,
        \"endTime\": $END_TIME,
        \"alpha\": 1.0,
        \"beta\": 0.5,
        \"gamma\": 0.3
    }" || true

echo ""
echo "=========================================="
echo "测试数据准备完成"
echo "=========================================="

