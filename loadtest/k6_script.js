/**
 * K6 压力测试脚本
 * 支持指数型成长频率的出价测试
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');

// 测试配置
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // 30秒内增加到50个用户
    { duration: '1m', target: 100 },   // 1分钟内增加到100个用户
    { duration: '2m', target: 200 },   // 2分钟内增加到200个用户
    { duration: '3m', target: 500 },   // 3分钟内增加到500个用户
    { duration: '2m', target: 1000 },  // 2分钟内增加到1000个用户（峰值）
    { duration: '1m', target: 0 },      // 1分钟内降回0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% 的请求在 500ms 内完成
    errors: ['rate<0.1'],              // 错误率低于 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
let tokens = {}; // 存储每个虚拟用户的 token

// 初始化函数（每个虚拟用户执行一次）
export function setup() {
  return {
    baseUrl: BASE_URL,
  };
}

// 默认测试函数
export default function (data) {
  const userId = __VU; // 虚拟用户 ID
  const baseUrl = data.baseUrl;
  
  // 获取或创建 token
  if (!tokens[userId]) {
    const username = `test_user_${userId}_${Date.now()}`;
    const password = 'test123456';
    
    // 注册
    let registerRes = http.post(`${baseUrl}/api/auth/register`, JSON.stringify({
      username: username,
      password: password,
      role: 'member'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    // 如果注册失败，尝试登录
    if (registerRes.status !== 200) {
      registerRes = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({
        username: username,
        password: password
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (registerRes.status === 200) {
      const loginData = JSON.parse(registerRes.body);
      tokens[userId] = loginData.token;
    }
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokens[userId]}`,
  };
  
  // 查看商品列表
  let res = http.get(`${baseUrl}/api/products`, { headers });
  check(res, {
    '获取商品列表成功': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(1);
  
  // 假设商品 ID 为 prod_1
  const productId = 'prod_1';
  
  // 查看商品详情
  res = http.get(`${baseUrl}/api/products/${productId}`, { headers });
  check(res, {
    '获取商品详情成功': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(0.5);
  
  // 查看排行榜
  res = http.get(`${baseUrl}/api/products/${productId}/rankings`, { headers });
  check(res, {
    '获取排行榜成功': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(0.5);
  
  // 提交出价（高频操作）
  if (tokens[userId]) {
    const price = Math.floor(Math.random() * 4000) + 1000; // 1000-5000
    
    res = http.post(
      `${baseUrl}/api/products/${productId}/bids`,
      JSON.stringify({ price: price }),
      { headers }
    );
    
    check(res, {
      '出价成功': (r) => r.status === 200,
      '出价响应时间 < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);
  }
  
  sleep(1);
}

// 指数型成长频率测试
export function exponentialBidTest(data) {
  const userId = __VU;
  const baseUrl = data.baseUrl;
  const elapsedTime = __ITER * 1; // 假设每次迭代 1 秒
  
  // 指数型增长：每 10 秒频率翻倍
  const baseRate = 0.1;
  const multiplier = Math.pow(2, elapsedTime / 10);
  const currentRate = Math.min(baseRate * multiplier, 10); // 限制最大频率
  
  // 根据频率决定是否执行
  if (Math.random() < (currentRate / 10)) {
    if (!tokens[userId]) {
      // 登录逻辑（同上）
      return;
    }
    
    const productId = 'prod_1';
    const price = Math.floor(Math.random() * 4000) + 1000;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens[userId]}`,
    };
    
    const res = http.post(
      `${baseUrl}/api/products/${productId}/bids`,
      JSON.stringify({ price: price }),
      { headers }
    );
    
    check(res, {
      '指数型出价成功': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
}

