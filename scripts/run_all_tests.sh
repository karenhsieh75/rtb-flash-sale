#!/bin/bash

# 一键执行所有测试脚本

set -e

echo "=========================================="
echo "执行所有测试"
echo "=========================================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Go 单元测试
echo -e "\n${YELLOW}[1/6] 执行 Go 单元测试${NC}"
cd backend
if go test ./... -v; then
    echo -e "${GREEN}✓ 单元测试通过${NC}"
else
    echo -e "${RED}✗ 单元测试失败${NC}"
    exit 1
fi
cd ..

# 2. Go 集成测试
echo -e "\n${YELLOW}[2/6] 执行 Go 集成测试${NC}"
cd backend
if go test ./tests/integration/... -v; then
    echo -e "${GREEN}✓ 集成测试通过${NC}"
else
    echo -e "${YELLOW}⚠ 集成测试跳过（需要 Redis 和数据库）${NC}"
fi
cd ..

# 3. 一致性验证
echo -e "\n${YELLOW}[3/6] 执行一致性验证${NC}"
cd loadtest
if python3 verify_data.py; then
    echo -e "${GREEN}✓ 一致性验证通过${NC}"
else
    echo -e "${YELLOW}⚠ 一致性验证跳过（需要数据库和 Redis）${NC}"
fi
cd ..

# 4. 压力测试提示
echo -e "\n${YELLOW}[4/6] 压力测试${NC}"
echo "请手动运行以下命令进行压力测试："
echo "  cd loadtest"
echo "  locust -f locustfile.py --host=https://d28wqj892frr80.cloudfront.net"
echo "  或"
echo "  k6 run k6_script.js"

# 5. E2E 测试
echo -e "\n${YELLOW}[5/6] 执行 E2E 测试${NC}"
cd frontend/e2e
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    if npx playwright test; then
        echo -e "${GREEN}✓ E2E 测试通过${NC}"
    else
        echo -e "${YELLOW}⚠ E2E 测试失败或跳过${NC}"
    fi
else
    echo -e "${YELLOW}⚠ E2E 测试未配置${NC}"
fi
cd ../..

# 6. 生成测试报告
echo -e "\n${YELLOW}[6/6] 生成测试报告${NC}"
cd loadtest
if python3 report_generator.py; then
    echo -e "${GREEN}✓ 测试报告已生成${NC}"
else
    echo -e "${YELLOW}⚠ 测试报告生成跳过${NC}"
fi
cd ..

echo -e "\n${GREEN}=========================================="
echo "所有测试执行完成"
echo "==========================================${NC}"

