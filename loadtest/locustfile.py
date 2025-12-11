"""
Locust 壓力測試腳本（增強版）
支援：
- 動態獲取商品 ID
- 基於當前最高價的出價
- 響應時間統計（p50, p95, p99）
- 錯誤分類統計
- 更新出價場景
- 截止前瘋狂出價場景

預設使用遠端服務：https://d28wqj892frr80.cloudfront.net
可通過環境變數 BASE_URL 或 --host 參數覆蓋
"""

from locust import HttpUser, task, between, events
import random
import json
import time
import statistics
import os
from collections import defaultdict

# 全域變數儲存統計資訊
response_times = defaultdict(list)
error_counts = defaultdict(int)
product_ids = []  # 動態獲取的商品 ID
current_highest_prices = {}  # 每個商品的當前最高價


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """測試開始時獲取商品列表"""
    global product_ids, current_highest_prices
    
    # 創建臨時客戶端獲取商品列表
    from locust.clients import HttpSession
    import os
    # 優先使用環境變數，然後是命令行參數，最後是預設遠端 URL
    default_url = os.getenv("BASE_URL", "https://d28wqj892frr80.cloudfront.net")
    client = HttpSession(base_url=environment.host or default_url)
    
    # 先註冊一個測試用戶
    test_user = {
        "username": f"test_setup_{random.randint(100000, 999999)}",
        "password": "test123456",
        "role": "member"
    }
    register_res = client.post("/api/auth/register", json=test_user)
    if register_res.status_code != 200:
        login_res = client.post("/api/auth/login", json={
            "username": test_user["username"],
            "password": test_user["password"]
        })
        if login_res.status_code == 200:
            token = login_res.json().get("token")
            headers = {"Authorization": f"Bearer {token}"}
        else:
            headers = {}
    else:
        token = register_res.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
    
    # 獲取商品列表
    products_res = client.get("/api/products", headers=headers)
    if products_res.status_code == 200:
        products = products_res.json().get("products", [])
        product_ids = [p["id"] for p in products if p.get("status") == "active"]
        
        # 初始化每個商品的當前最高價
        for product_id in product_ids:
            product_res = client.get(f"/api/products/{product_id}", headers=headers)
            if product_res.status_code == 200:
                product = product_res.json()
                current_highest_prices[product_id] = product.get("currentHighestPrice", product.get("basePrice", 1000))
    
    print(f"[Setup] Found {len(product_ids)} active products: {product_ids}")
    if not product_ids:
        print("[Warning] No active products found, using default 'prod_1'")
        product_ids = ["prod_1"]
        current_highest_prices["prod_1"] = 1000.0


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """記錄每個請求的響應時間和錯誤"""
    if exception:
        error_counts[type(exception).__name__] += 1
    elif response_time:
        response_times[name].append(response_time)
        if response_length == 0:
            error_counts["Empty Response"] += 1


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """測試結束時輸出統計資訊"""
    print("\n" + "="*60)
    print("響應時間統計 (ms)")
    print("="*60)
    
    for name, times in response_times.items():
        if times:
            p50 = statistics.median(times)
            p95 = statistics.quantiles(times, n=20)[18] if len(times) > 1 else times[0]
            p99 = statistics.quantiles(times, n=100)[98] if len(times) > 1 else times[0]
            avg = statistics.mean(times)
            print(f"{name}:")
            print(f"  平均: {avg:.2f}ms, p50: {p50:.2f}ms, p95: {p95:.2f}ms, p99: {p99:.2f}ms")
            print(f"  請求數: {len(times)}")
    
    print("\n" + "="*60)
    print("錯誤統計")
    print("="*60)
    for error_type, count in error_counts.items():
        print(f"{error_type}: {count}")


class BiddingUser(HttpUser):
    """
    模擬競標用戶行為（增強版）
    """
    wait_time = between(1, 3)  # 用戶操作間隔 1-3 秒
    
    def on_start(self):
        """用戶登入"""
        global product_ids
        
        # 註冊新用戶
        username = f"test_user_{random.randint(10000, 99999)}"
        password = "test123456"
        
        register_data = {
            "username": username,
            "password": password,
            "role": "member"
        }
        
        response = self.client.post("/api/auth/register", json=register_data, name="註冊用戶")
        if response.status_code != 200:
            # 如果註冊失敗，嘗試登入
            login_data = {
                "username": username,
                "password": password
            }
            response = self.client.post("/api/auth/login", json=login_data, name="登入用戶")
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("id")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.token = None
            self.headers = {}
        
        # 獲取當前商品列表和最高價
        self.update_product_info()
    
    def update_product_info(self):
        """更新商品資訊和當前最高價"""
        global product_ids, current_highest_prices
        
        if not self.token:
            return
        
        response = self.client.get("/api/products", headers=self.headers, name="獲取商品列表")
        if response.status_code == 200:
            products = response.json().get("products", [])
            active_products = [p for p in products if p.get("status") == "active"]
            
            if active_products:
                product_ids = [p["id"] for p in active_products]
                for product in active_products:
                    current_highest_prices[product["id"]] = product.get("currentHighestPrice", product.get("basePrice", 1000))
    
    def get_product_id(self):
        """獲取一個可用的商品 ID"""
        global product_ids
        if product_ids:
            return random.choice(product_ids)
        return "prod_1"  # 預設值
    
    def get_current_highest_price(self, product_id):
        """獲取商品的當前最高價"""
        global current_highest_prices
        return current_highest_prices.get(product_id, 1000.0)
    
    def update_highest_price(self, product_id, new_price):
        """更新商品的當前最高價"""
        global current_highest_prices
        if new_price > current_highest_prices.get(product_id, 0):
            current_highest_prices[product_id] = new_price
    
    @task(3)
    def view_products(self):
        """查看商品列表"""
        self.client.get("/api/products", headers=self.headers, name="獲取商品列表")
        self.update_product_info()
    
    @task(2)
    def view_product_detail(self):
        """查看商品詳情"""
        product_id = self.get_product_id()
        response = self.client.get(
            f"/api/products/{product_id}",
            headers=self.headers,
            name="獲取商品詳情"
        )
        
        if response.status_code == 200:
            product = response.json()
            self.update_highest_price(product_id, product.get("currentHighestPrice", product.get("basePrice", 1000)))
    
    @task(5)
    def view_rankings(self):
        """查看排行榜"""
        product_id = self.get_product_id()
        response = self.client.get(
            f"/api/products/{product_id}/rankings",
            headers=self.headers,
            name="獲取排行榜"
        )
        
        if response.status_code == 200:
            data = response.json()
            self.update_highest_price(product_id, data.get("currentHighestPrice", 1000))
    
    @task(10)
    def place_bid(self):
        """提交出價（基於當前最高價）"""
        if not self.token:
            return
        
        product_id = self.get_product_id()
        current_highest = self.get_current_highest_price(product_id)
        
        # 出價必須高於當前最高價，增加 10-100 的隨機增量
        price = current_highest + random.uniform(10, 100)
        
        bid_data = {"price": price}
        response = self.client.post(
            f"/api/products/{product_id}/bids",
            json=bid_data,
            headers=self.headers,
            name="提交出價"
        )
        
        if response.status_code == 200:
            # 更新當前最高價
            self.update_highest_price(product_id, price)
    
    @task(5)
    def update_bid(self):
        """更新出價（同一用戶多次出價）"""
        if not self.token:
            return
        
        product_id = self.get_product_id()
        current_highest = self.get_current_highest_price(product_id)
        
        # 出價必須高於當前最高價
        price = current_highest + random.uniform(10, 50)
        
        bid_data = {"price": price}
        response = self.client.post(
            f"/api/products/{product_id}/bids",
            json=bid_data,
            headers=self.headers,
            name="更新出價"
        )
        
        if response.status_code == 200:
            self.update_highest_price(product_id, price)


class ExponentialRampUpUser(BiddingUser):
    """
    指數型成長頻率的用戶
    出價頻率隨時間指數增長
    """
    wait_time = between(0.5, 2)  # 更短的等待時間
    
    def place_bid(self):
        """指數型增長的出價頻率"""
        if not self.token:
            return
        
        # 計算當前運行時間（秒）
        elapsed_time = time.time() - self.environment.runner.start_time
        
        # 指數型增長：每 10 秒頻率翻倍
        base_rate = 0.1
        multiplier = 2 ** (elapsed_time / 10)
        current_rate = min(base_rate * multiplier, 10)  # 限制最大頻率
        
        # 根據頻率決定是否執行
        if random.random() < (current_rate / 10):
            product_id = self.get_product_id()
            current_highest = self.get_current_highest_price(product_id)
            price = current_highest + random.uniform(10, 100)
            
            bid_data = {"price": price}
            response = self.client.post(
                f"/api/products/{product_id}/bids",
                json=bid_data,
                headers=self.headers,
                name="指數型出價"
            )
            
            if response.status_code == 200:
                self.update_highest_price(product_id, price)


class FinalRushUser(BiddingUser):
    """
    截止前瘋狂出價的用戶
    在活動結束前最後 2 秒大量出價
    """
    wait_time = between(0.1, 0.5)  # 非常短的等待時間
    
    def on_start(self):
        """初始化時獲取活動結束時間"""
        super().on_start()
        self.end_times = {}  # 儲存每個商品的結束時間
        
        if self.token:
            response = self.client.get("/api/products", headers=self.headers)
            if response.status_code == 200:
                products = response.json().get("products", [])
                for product in products:
                    if product.get("status") == "active":
                        self.end_times[product["id"]] = product.get("endTime", 0)
    
    @task(20)
    def final_rush_bid(self):
        """截止前瘋狂出價"""
        if not self.token:
            return
        
        product_id = self.get_product_id()
        end_time = self.end_times.get(product_id, 0)
        
        # 檢查是否在最後 2 秒
        current_time = int(time.time() * 1000)  # 轉換為毫秒
        time_until_end = (end_time - current_time) / 1000  # 轉換為秒
        
        if 0 < time_until_end <= 2:
            # 在最後 2 秒內，瘋狂出價
            current_highest = self.get_current_highest_price(product_id)
            price = current_highest + random.uniform(1, 50)
            
            bid_data = {"price": price}
            response = self.client.post(
                f"/api/products/{product_id}/bids",
                json=bid_data,
                headers=self.headers,
                name="截止前出價"
            )
            
            if response.status_code == 200:
                self.update_highest_price(product_id, price)
