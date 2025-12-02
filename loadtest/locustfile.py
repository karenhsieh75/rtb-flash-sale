"""
Locust 压力测试脚本
支持指数型成长频率的出价测试
"""

from locust import HttpUser, task, between
import random
import json
import time

class BiddingUser(HttpUser):
    """
    模拟竞标用户行为
    """
    wait_time = between(1, 3)  # 用户操作间隔 1-3 秒
    
    def on_start(self):
        """用户登录"""
        # 注册新用户
        username = f"test_user_{random.randint(10000, 99999)}"
        password = "test123456"
        
        register_data = {
            "username": username,
            "password": password,
            "role": "member"
        }
        
        response = self.client.post("/api/auth/register", json=register_data)
        if response.status_code != 200:
            # 如果注册失败，尝试登录
            login_data = {
                "username": username,
                "password": password
            }
            response = self.client.post("/api/auth/login", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("id")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            # 如果登录失败，使用默认测试账号
            self.token = None
            self.headers = {}
    
    @task(3)
    def view_products(self):
        """查看商品列表"""
        self.client.get("/api/products", headers=self.headers, name="获取商品列表")
    
    @task(2)
    def view_product_detail(self):
        """查看商品详情"""
        # 假设有商品 ID 为 "prod_1"
        product_id = "prod_1"
        self.client.get(f"/api/products/{product_id}", headers=self.headers, name="获取商品详情")
    
    @task(5)
    def view_rankings(self):
        """查看排行榜"""
        product_id = "prod_1"
        self.client.get(f"/api/products/{product_id}/rankings", headers=self.headers, name="获取排行榜")
    
    @task(10)
    def place_bid(self):
        """提交出价（高频操作）"""
        if not self.token:
            return
        
        product_id = "prod_1"
        # 随机出价，范围在 1000-5000 之间
        price = random.randint(1000, 5000)
        
        bid_data = {"price": price}
        self.client.post(
            f"/api/products/{product_id}/bids",
            json=bid_data,
            headers=self.headers,
            name="提交出价"
        )


class ExponentialRampUpUser(BiddingUser):
    """
    指数型成长频率的用户
    出价频率随时间指数增长
    """
    wait_time = between(0.5, 2)  # 更短的等待时间
    
    def place_bid(self):
        """指数型增长的出价频率"""
        if not self.token:
            return
        
        # 计算当前运行时间（秒）
        elapsed_time = time.time() - self.environment.runner.start_time
        
        # 指数型增长：每 10 秒频率翻倍
        # 基础频率 1/10，每 10 秒翻倍
        base_rate = 0.1
        multiplier = 2 ** (elapsed_time / 10)
        current_rate = base_rate * multiplier
        
        # 限制最大频率（每秒最多 10 次）
        if current_rate > 10:
            current_rate = 10
        
        # 根据频率决定是否执行
        if random.random() < (current_rate / 10):
            product_id = "prod_1"
            price = random.randint(1000, 5000)
            
            bid_data = {"price": price}
            self.client.post(
                f"/api/products/{product_id}/bids",
                json=bid_data,
                headers=self.headers,
                name="指数型出价"
            )

