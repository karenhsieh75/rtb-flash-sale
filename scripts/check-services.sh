#!/bin/bash

echo "=========================================="
echo "检查服务状态"
echo "=========================================="
echo ""

echo "📦 Docker 容器状态:"
docker-compose ps
echo ""

echo "🔍 检查端口:"
echo "  - Backend API: http://localhost:8000"
echo "  - Frontend: http://localhost:5173"
echo "  - Redis: localhost:6379"
echo "  - PostgreSQL: localhost:5432"
echo ""

echo "🧪 测试后端 API:"
curl -s http://localhost:8000/api/products -H "Authorization: Bearer test" 2>&1 | head -3
echo ""
echo ""

echo "🧪 测试前端:"
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "  ✅ 前端服务正常"
else
  echo "  ❌ 前端服务无法访问"
fi
echo ""

echo "📋 查看日志 (最近 10 行):"
echo "  使用以下命令查看详细日志:"
echo "  docker-compose logs -f [service_name]"
echo "  例如: docker-compose logs -f backend"
echo ""

