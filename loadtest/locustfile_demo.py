"""
Locust 壓力測試腳本（Demo 視覺化增強版）
專為 Demo 影片設計，提供清晰的視覺化輸出和實時統計

功能：
1. 自動創建多個商品（預設 3 個）
2. 分階段執行：先註冊所有用戶，然後開始競標（指數成長）
3. 修復失敗率問題（增加出價增量，動態獲取最高價）
4. 自動停止：測試會在指定時間後自動停止

使用方式：
locust -f locustfile_demo.py --host=https://d28wqj892frr80.cloudfront.net --run-time=3m --users=1000 --spawn-rate=50

或者使用 Web UI：
locust -f locustfile_demo.py --host=https://d28wqj892frr80.cloudfront.net
然後在 Web UI 中設置運行時間（例如 3 分鐘）
"""

from locust import HttpUser, task, between, events, LoadTestShape
import random
import json
import time
import statistics
import os
import threading
import requests
from collections import defaultdict
from datetime import datetime

# 全域變數儲存統計資訊
response_times = defaultdict(list)
error_counts = defaultdict(int)
product_ids = []
current_highest_prices = {}
product_end_times = {}  # 儲存每個商品的結束時間（毫秒）
bid_count = 0
start_time = None
bidding_start_time = None  # 競標開始時間
registration_phase = True  # 註冊階段標記
registration_complete = threading.Event()  # 註冊完成事件
environment_ref = None  # 保存 environment 引用，用於停止測試
init_done = False  # 確保 test_start 只執行一次
init_lock = threading.Lock()  # 序列化初始化流程

# Demo 模式：更詳細的輸出
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"

# 測試配置
REGISTRATION_DURATION = 30  # 註冊階段持續時間（秒）
BIDDING_DURATION = 120  # 競標階段持續時間（秒）
NUM_PRODUCTS = 3  # 創建的商品數量


class SmoothRampShape(LoadTestShape):
    """
    平滑用戶增長：
      - 線性從 0 漸進到目標用戶數，減少明顯的週期波動
      - 可配置總用戶、爬升時間、保持時間
    """
    max_users = 1400        # 目標用戶數
    ramp_time = 180         # 爬升時間（秒），線性增加
    hold_time = 60          # 保持時間（秒），達標後維持
    spawn_rate = 50         # 生成速率（用戶/秒），平滑即可

    def tick(self):
        run_time = self.get_run_time()

        if run_time > self.ramp_time + self.hold_time:
            return None

        if run_time <= self.ramp_time:
            # 線性增加用戶
            users = int(self.max_users * (run_time / self.ramp_time))
        else:
            users = self.max_users

        # 至少要有 1 個用戶，避免 0
        users = max(users, 1)
        return users, self.spawn_rate


def print_demo_header(title):
    """打印 Demo 標題（美化版）"""
    if DEMO_MODE:
        print("\n" + "=" * 70)
        print(f"  {title}")
        print("=" * 70)


def print_demo_info(message, value=None):
    """打印 Demo 資訊（美化版）"""
    if DEMO_MODE:
        if value is not None:
            print(f"  → {message:30s} {value}")
        else:
            print(f"  → {message}")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """測試開始時自動創建商品"""
    global product_ids, current_highest_prices, product_end_times, start_time, environment_ref, init_done

    # 防止重複初始化（Locust shape 更新或多 worker 場景）
    with init_lock:
        if init_done:
            return
        # 一旦進入初始化即標記完成，避免重入
        init_done = True
    
    start_time = time.time()
    environment_ref = environment  # 保存引用，用於後續停止測試
    
    print_demo_header("壓力測試開始")
    print_demo_info("正在初始化測試環境...")
    
    # 使用 requests 庫而不是 HttpSession（參考 locustfile.py 的實現方式）
    import requests
    default_url = os.getenv("BASE_URL", "https://d28wqj892frr80.cloudfront.net")
    base_url = environment.host or default_url
    
    print_demo_info("API 地址", base_url)
    
    # 1. 創建管理員並登入
    print_demo_info("正在創建管理員帳號...")
    admin_username = f"demo_admin_{int(time.time())}"
    admin_password = "admin123456"
    
    admin_register_res = requests.post(f"{base_url}/api/auth/register", json={
        "username": admin_username,
        "password": admin_password,
        "role": "admin"
    }, timeout=10)
    
    if admin_register_res.status_code not in [200, 201]:
        admin_login_res = requests.post(f"{base_url}/api/auth/login", json={
            "username": admin_username,
            "password": admin_password
        }, timeout=10)
        if admin_login_res.status_code == 200:
            admin_token = admin_login_res.json().get("token")
        else:
            print_demo_info("警告: 無法創建管理員，將使用現有商品")
            admin_token = None
    else:
        # 註冊成功後需要登入
        admin_login_res = requests.post(f"{base_url}/api/auth/login", json={
            "username": admin_username,
            "password": admin_password
        }, timeout=10)
        if admin_login_res.status_code == 200:
            admin_token = admin_login_res.json().get("token")
        else:
            admin_token = None
    
    # 2. 自動創建多個測試商品
    if admin_token:
        print_demo_info(f"正在創建 {NUM_PRODUCTS} 個測試商品...")
        now = int(time.time() * 1000)
        start_time_ms = now + 2000  # 2 秒後開始（給系統一點時間處理）
        end_time_ms = now + (REGISTRATION_DURATION + BIDDING_DURATION + 10) * 1000
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        created_products = []
        
        for i in range(NUM_PRODUCTS):
            product_data = {
                "title": f"Demo 壓力測試商品 {i+1}",
                "description": f"自動創建的壓力測試商品 #{i+1}",
                "basePrice": 1000.0 + (i * 100),
                "k": 5,
                "startTime": start_time_ms,
                "endTime": end_time_ms,
                "alpha": 1.0,
                "beta": 0.5,
                "gamma": 0.3
            }
            
            create_res = requests.post(f"{base_url}/api/admin/products", json=product_data, headers=headers, timeout=10)
            
            if create_res.status_code in [200, 201]:
                product = create_res.json()
                product_id = product.get("id")
                created_products.append(product_id)
                current_highest_prices[product_id] = product_data["basePrice"]
                product_end_times[product_id] = end_time_ms
                print_demo_info(f"商品 {i+1} 創建成功", f"ID: {product_id}, 底價: {product_data['basePrice']}")
        
        if created_products:
            product_ids = created_products
            print_demo_info(f"共創建 {len(product_ids)} 個商品")
            print_demo_info("活動時間", f"開始: {datetime.fromtimestamp(start_time_ms/1000).strftime('%H:%M:%S')}, 結束: {datetime.fromtimestamp(end_time_ms/1000).strftime('%H:%M:%S')}")
            
            # 簡化等待：快速確認一次，失敗則直接開始，不阻塞
            print_demo_info("等待商品狀態變為 active", "快速檢查一次後開始")
            try:
                test_user = {
                    "username": f"test_check_{random.randint(100000, 999999)}",
                    "password": "test123456",
                    "role": "member"
                }
                requests.post(f"{base_url}/api/auth/register", json=test_user, timeout=5)
                login_res = requests.post(f"{base_url}/api/auth/login", json={
                    "username": test_user["username"],
                    "password": test_user["password"]
                }, timeout=5)
                if login_res.status_code == 200:
                    token = login_res.json().get("token")
                    headers = {"Authorization": f"Bearer {token}"}
                    products_res = requests.get(f"{base_url}/api/products", headers=headers, timeout=5)
                    if products_res.status_code == 200:
                        products = products_res.json().get("products", [])
                        active_count = sum(1 for p in products if p.get("id") in product_ids and p.get("status") == "active")
                        print_demo_info("商品狀態", f"{active_count}/{len(product_ids)} 個商品 active（未 active 也直接開始）")
            except Exception as e:
                print_demo_info("檢查商品狀態時發生錯誤", str(e))
            print_demo_info("商品準備完成", "直接開始競標")
        else:
            print_demo_info("警告: 商品創建失敗，嘗試使用現有商品")
            # 嘗試獲取現有商品
            test_user = {
                "username": f"test_setup_{random.randint(100000, 999999)}",
                "password": "test123456",
                "role": "member"
            }
            requests.post(f"{base_url}/api/auth/register", json=test_user, timeout=10)
            login_res = requests.post(f"{base_url}/api/auth/login", json={
                "username": test_user["username"],
                "password": test_user["password"]
            }, timeout=10)
            if login_res.status_code == 200:
                token = login_res.json().get("token")
                headers = {"Authorization": f"Bearer {token}"}
                products_res = requests.get(f"{base_url}/api/products", headers=headers, timeout=10)
                if products_res.status_code == 200:
                    products = products_res.json().get("products", [])
                    active_products = [p for p in products if p.get("status") == "active"]
                    if active_products:
                        product_ids = [p["id"] for p in active_products]
                        for product in active_products:
                            product_id = product["id"]
                            current_highest_prices[product_id] = product.get("currentHighestPrice", product.get("basePrice", 1000))
                            product_end_times[product_id] = product.get("endTime", 0)  # 保存結束時間
                    else:
                        product_ids = ["prod_1"]
                        current_highest_prices["prod_1"] = 1000.0
    else:
        # 沒有管理員 token，嘗試獲取現有商品
        print_demo_info("無法創建商品，嘗試使用現有商品...")
        test_user = {
            "username": f"test_setup_{random.randint(100000, 999999)}",
            "password": "test123456",
            "role": "member"
        }
        requests.post(f"{base_url}/api/auth/register", json=test_user, timeout=10)
        login_res = requests.post(f"{base_url}/api/auth/login", json={
            "username": test_user["username"],
            "password": test_user["password"]
        }, timeout=10)
        if login_res.status_code == 200:
            token = login_res.json().get("token")
            headers = {"Authorization": f"Bearer {token}"}
            products_res = requests.get(f"{base_url}/api/products", headers=headers, timeout=10)
            if products_res.status_code == 200:
                products = products_res.json().get("products", [])
                active_products = [p for p in products if p.get("status") == "active"]
                if active_products:
                    product_ids = [p["id"] for p in active_products]
                    for product in active_products:
                        current_highest_prices[product["id"]] = product.get("currentHighestPrice", product.get("basePrice", 1000))
                else:
                    product_ids = ["prod_1"]
                    current_highest_prices["prod_1"] = 1000.0
    
    print_demo_header("初始化完成")
    print_demo_info("註冊階段", f"{REGISTRATION_DURATION} 秒")
    print_demo_info("競標階段", f"{BIDDING_DURATION} 秒（指數成長）")
    print_demo_info("商品數量", f"{len(product_ids)} 個")
    if product_ids:
        print_demo_info("商品 ID", ", ".join(product_ids[:3]))  # 只顯示前 3 個
    print("=" * 70)
    # 初始化只執行一次
    init_done = True
    
    # 啟動監控線程，檢查商品結束時間並自動停止測試
    if product_end_times:
        def monitor_and_stop():
            """監控商品結束時間，當所有商品都結束時自動停止測試"""
            while True:
                time.sleep(5)  # 每 5 秒檢查一次
                
                if not environment_ref or not environment_ref.runner:
                    break
                
                now_ms = int(time.time() * 1000)
                all_ended = True
                
                for product_id, end_time_ms in product_end_times.items():
                    if now_ms < end_time_ms:
                        all_ended = False
                        break
                
                if all_ended and product_end_times:
                    print_demo_header("所有商品競標已結束")
                    print_demo_info("正在停止測試", "等待最後的出價完成...")
                    time.sleep(2)  # 等待 2 秒讓最後的出價完成
                    if environment_ref and environment_ref.runner:
                        environment_ref.runner.quit()
                    break
        
        monitor_thread = threading.Thread(target=monitor_and_stop, daemon=True)
        monitor_thread.start()
        print_demo_info("自動停止監控", "已啟動（當所有商品結束時自動停止）")


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """記錄每個請求"""
    global bid_count
    
    if exception:
        error_counts[type(exception).__name__] += 1
    elif response_time:
        response_times[name].append(response_time)
        if response_length == 0:
            error_counts["Empty Response"] += 1
    
    # 如果是出價請求，更新計數
    if "出價" in name or "bid" in name.lower():
        bid_count += 1
        if DEMO_MODE and bid_count % 50 == 0:
            elapsed = time.time() - (bidding_start_time if bidding_start_time else start_time)
            print(f"  [進度] 已執行出價: {bid_count:5d} 次 | 競標時間: {elapsed:6.1f} 秒")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """測試結束時輸出統計資訊"""
    global start_time, bidding_start_time
    
    elapsed = time.time() - start_time if start_time else 0
    
    print_demo_header("測試結果統計")
    print_demo_info("總運行時間", f"{elapsed:.2f} 秒")
    print_demo_info("總出價次數", bid_count)
    
    print("\n" + "=" * 70)
    print("  響應時間統計 (ms)")
    print("=" * 70)
    
    for name, times in response_times.items():
        if times:
            p50 = statistics.median(times)
            p95 = statistics.quantiles(times, n=20)[18] if len(times) > 1 else times[0]
            p99 = statistics.quantiles(times, n=100)[98] if len(times) > 1 else times[0]
            avg = statistics.mean(times)
            min_time = min(times)
            max_time = max(times)
            
            success_count = len(times)
            total_requests = success_count + error_counts.get(name, 0)
            success_rate = (success_count / total_requests * 100) if total_requests > 0 else 0
            
            print(f"\n  {name}:")
            print(f"    平均: {avg:8.2f}ms  p50: {p50:8.2f}ms  p95: {p95:8.2f}ms  p99: {p99:8.2f}ms")
            print(f"    最小: {min_time:8.2f}ms  最大: {max_time:8.2f}ms")
            print(f"    請求數: {len(times):6d}  成功率: {success_rate:5.1f}%")
    
    print("\n" + "=" * 70)
    print("  錯誤統計")
    print("=" * 70)
    
    if error_counts:
        for error_type, count in error_counts.items():
            print(f"  {error_type}: {count}")
    else:
        print("  無錯誤")


class BiddingUser(HttpUser):
    """模擬競標用戶行為（改進版）"""
    wait_time = between(1, 3)
    
    def on_start(self):
        """用戶註冊和登入"""
        global product_ids, registration_phase, registration_complete, bidding_start_time
        
        # 生成唯一用戶名（使用更長的時間戳確保唯一性）
        username = f"user_{int(time.time() * 1000000)}_{random.randint(10000, 99999)}_{random.randint(1000, 9999)}"
        password = "test123456"
        
        self.token = None
        self.headers = {}
        
        # 嘗試註冊和登入（最多重試 3 次）
        for attempt in range(3):
            register_data = {
                "username": username,
                "password": password,
                "role": "member"
            }
            
            # 註冊用戶
            register_response = self.client.post("/api/auth/register", json=register_data, name="註冊用戶", catch_response=True)
            
            # 無論註冊成功與否，都嘗試登入
            login_data = {
                "username": username,
                "password": password
            }
            login_response = self.client.post("/api/auth/login", json=login_data, name="登入用戶", catch_response=True)
            
            if login_response.status_code == 200:
                try:
                    data = login_response.json()
                    self.token = data.get("token")
                    if self.token:
                        self.user_id = data.get("user", {}).get("id")
                        self.headers = {"Authorization": f"Bearer {self.token}"}
                        break  # 成功獲取 token，退出重試循環
                except:
                    pass
            
            # 如果失敗，稍微等待後重試（避免並發衝突）
            if attempt < 2:
                time.sleep(0.1 * (attempt + 1))
        
        # 如果還是沒有 token，標記為失敗用戶
        if not self.token:
            # 這個用戶將無法執行需要認證的操作
            return
        
        # 更新商品資訊
        self.update_product_info()
        
        # 檢查是否進入競標階段
        global registration_phase, bidding_start_time
        elapsed = time.time() - start_time if start_time else 0
        if elapsed >= REGISTRATION_DURATION:
            # 使用簡單的標記，避免多線程問題
            if registration_phase:  # 再次檢查
                registration_phase = False
                bidding_start_time = time.time()
                registration_complete.set()
                print_demo_header("進入競標階段")
                print_demo_info("開始競標", "出價頻率將指數成長")
                print("=" * 70)
    
    def update_product_info(self):
        """更新商品資訊（參考 locustfile.py 的實現）"""
        global product_ids, current_highest_prices, product_end_times
        
        if not self.token:
            return
        
        response = self.client.get("/api/products", headers=self.headers, name="獲取商品列表")
        if response.status_code == 200:
            products = response.json().get("products", [])
            # 不限制狀態，只要商品存在就可以（後端會自動更新狀態）
            # 這樣可以確保剛創建的商品也能被找到
            if products:
                product_ids = [p["id"] for p in products]
                for product in products:
                    product_id = product["id"]
                    current_highest_prices[product_id] = product.get("currentHighestPrice", product.get("basePrice", 1000))
                    # 保存結束時間
                    if product_id not in product_end_times:
                        product_end_times[product_id] = product.get("endTime", 0)
    
    def get_product_id(self):
        """獲取商品 ID"""
        global product_ids
        if product_ids:
            return random.choice(product_ids)
        return "prod_1"
    
    def get_current_highest_price(self, product_id):
        """獲取當前最高價（參考 locustfile.py 的簡單實現）"""
        global current_highest_prices
        # 直接返回緩存的值，避免每次出價都查詢（提高性能）
        # 最高價會在成功出價後更新，或在查看排行榜時更新
        return current_highest_prices.get(product_id, 1000.0)
    
    def update_highest_price(self, product_id, new_price):
        """更新最高價"""
        global current_highest_prices
        if new_price > current_highest_prices.get(product_id, 0):
            current_highest_prices[product_id] = new_price
    
    @task(3)
    def view_products(self):
        """查看商品列表（任何階段都可以查看）"""
        if not self.token:
            return
        
        # 任何階段都可以查看商品列表，避免響應時間突然為 0
        self.client.get("/api/products", headers=self.headers, name="獲取商品列表")
        self.update_product_info()
    
    @task(2)
    def view_product_detail(self):
        """查看商品詳情（任何階段都可以查看）"""
        if not self.token:
            return
        
        # 任何階段都可以查看商品詳情
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
        """查看排行榜（即使商品結束也可以查看）"""
        if not self.token:
            return
        
        product_id = self.get_product_id()
        # 即使商品結束，也可以查看排行榜和結果
        response = self.client.get(
            f"/api/products/{product_id}/rankings",
            headers=self.headers,
            name="獲取排行榜"
        )
        
        if response.status_code == 200:
            data = response.json()
            self.update_highest_price(product_id, data.get("currentHighestPrice", 1000))
        
        # 如果商品已結束，嘗試獲取結果
        global product_end_times
        end_time_ms = product_end_times.get(product_id, 0)
        now_ms = int(time.time() * 1000)
        if end_time_ms > 0 and now_ms >= end_time_ms:
            # 商品已結束，嘗試獲取結果
            try:
                result_response = self.client.get(
                    f"/api/products/{product_id}/results",
                    headers=self.headers,
                    name="獲取競標結果"
                )
            except:
                pass
    
    @task(8)  # 略降權重，初期更平緩
    def place_bid(self):
        """提交出價（只在競標階段，接近結束時頻率指數上升）"""
        global product_end_times
        
        if not self.token:
            return
        
        # 檢查是否進入競標階段
        elapsed = time.time() - start_time if start_time else 0
        if elapsed < REGISTRATION_DURATION:
            return  # 還在註冊階段，不出價
        
        product_id = self.get_product_id()
        end_time_ms = product_end_times.get(product_id, 0)
        
        # 計算距離結束的時間（秒）
        now_ms = int(time.time() * 1000)
        time_until_end = (end_time_ms - now_ms) / 1000 if end_time_ms > 0 else 999
        
        # 如果活動已結束，不出價
        if time_until_end <= 0:
            return
        
        # 接近結束時（最後 30 秒），出價頻率指數上升
        # 最後 30 秒：頻率 = 基礎頻率 * 2^(30 - 剩餘時間) / 5
        # 最後 10 秒：頻率 = 基礎頻率 * 2^(10 - 剩餘時間) / 2
        if time_until_end <= 30:
            # 指數上升：剩餘時間越少，頻率越高
            # 每 5 秒頻率翻倍，但限制最大頻率避免過濾太多請求
            urgency_factor = 2 ** ((30 - time_until_end) / 5)
            urgency_factor = min(urgency_factor, 6.0)  # 限制最大頻率
            if random.random() > (1.0 / urgency_factor):
                return  # 根據頻率決定是否出價
        elif time_until_end <= 60:
            # 最後 60 秒開始加速
            urgency_factor = 1.5
            if random.random() > (1.0 / urgency_factor):
                return
        
        # 動態獲取最新最高價（參考 locustfile.py，使用更簡單的方式）
        # 先嘗試從排行榜獲取，如果失敗則使用緩存
        current_highest = self.get_current_highest_price(product_id)
        
        # 使用更大的增量範圍，避免並發時出價金額相同（參考 locustfile.py 但增加增量）
        # 接近結束時，增量更大（更積極）
        if time_until_end <= 10:
            increment = random.uniform(200, 800)  # 最後 10 秒，更積極
        elif time_until_end <= 30:
            increment = random.uniform(150, 600)  # 最後 30 秒，中等積極
        else:
            increment = random.uniform(100, 500)  # 正常情況（比 locustfile.py 的 10-100 更大）
        
        price = current_highest + increment
        
        bid_data = {"price": price}
        response = self.client.post(
            f"/api/products/{product_id}/bids",
            json=bid_data,
            headers=self.headers,
            name="提交出價"
        )
        
        if response.status_code == 200:
            self.update_highest_price(product_id, price)
        elif response.status_code == 400:
            # 出價太低，重新獲取最高價並重試一次
            try:
                current_highest = self.get_current_highest_price(product_id)
                retry_price = current_highest + random.uniform(200, 600)
                retry_response = self.client.post(
                    f"/api/products/{product_id}/bids",
                    json={"price": retry_price},
                    headers=self.headers,
                    name="提交出價（重試）"
                )
                if retry_response.status_code == 200:
                    self.update_highest_price(product_id, retry_price)
            except:
                pass


class ExponentialRampUpUser(BiddingUser):
    """
    指數型成長頻率的用戶（Demo 重點展示）
    出價頻率隨時間指數增長
    """
    wait_time = between(0.3, 1.0)  # 更短的等待時間，讓指數成長更明顯
    
    @task(30)  # 更高的任務權重，確保指數成長明顯
    def place_bid(self):
        """指數型增長的出價頻率（接近結束時頻率指數上升）"""
        global bidding_start_time, start_time, product_end_times
        
        if not self.token:
            return
        
        # 檢查是否進入競標階段
        elapsed = time.time() - (start_time if start_time else time.time())
        if elapsed < REGISTRATION_DURATION:
            return  # 還在註冊階段，不出價
        
        product_id = self.get_product_id()
        end_time_ms = product_end_times.get(product_id, 0)
        
        # 計算距離結束的時間（秒）
        now_ms = int(time.time() * 1000)
        time_until_end = (end_time_ms - now_ms) / 1000 if end_time_ms > 0 else 999
        
        # 如果活動已結束，不出價
        if time_until_end <= 0:
            return
        
        # 指數型增長：基於運行時間（放慢前期，後期加速）
        elapsed_time = time.time() - (bidding_start_time if bidding_start_time else start_time)

        # 前期慢：每 12 秒翻倍，基礎頻率較低
        base_rate = 0.1
        multiplier = 2 ** (elapsed_time / 12)  # 放慢增長
        current_rate = min(base_rate * multiplier, 12.0)  # 前期上限較低

        # 接近結束時，頻率進一步指數上升
        if time_until_end <= 30:
            # 最後 30 秒：額外增加緊急倍數
            urgency_multiplier = 2 ** ((30 - time_until_end) / 5)  # 每 5 秒翻倍
            urgency_multiplier = min(urgency_multiplier, 5.0)
            current_rate = min(current_rate * urgency_multiplier, 18.0)  # 最後階段上限
        elif time_until_end <= 60:
            # 最後 60 秒：開始加速
            current_rate = min(current_rate * 1.5, 15.0)
        
        # 根據當前頻率決定是否出價（簡化邏輯，讓指數成長更明顯）
        # 使用更高的概率，確保指數成長能被看到
        if random.random() < min(current_rate / 15.0, 0.95):  # 最高 95% 概率
            # 動態獲取最新最高價
            current_highest = self.get_current_highest_price(product_id)
            
            # 使用更大的增量，接近結束時更積極
            if time_until_end <= 10:
                increment = random.uniform(200, 800)  # 最後 10 秒，最積極
            elif time_until_end <= 30:
                increment = random.uniform(150, 600)  # 最後 30 秒，中等積極
            else:
                increment = random.uniform(100, 500)  # 正常情況
            
            price = current_highest + increment
            
            bid_data = {"price": price}
            response = self.client.post(
                f"/api/products/{product_id}/bids",
                json=bid_data,
                headers=self.headers,
                name="指數型出價"
            )
            
            if response.status_code == 200:
                self.update_highest_price(product_id, price)
                
                # Demo 模式：每 20 次出價顯示一次頻率資訊（更頻繁）
                global bid_count
                if DEMO_MODE and bid_count % 20 == 0:
                    print(f"  [指數成長] 頻率: {current_rate:5.2f}/秒 | 競標時間: {elapsed_time:6.1f}秒 | 剩餘: {time_until_end:5.1f}秒 | 倍數: {multiplier:5.2f}x")
            elif response.status_code == 400:
                # 出價太低，重新獲取最高價並重試
                try:
                    current_highest = self.get_current_highest_price(product_id)
                    retry_price = current_highest + random.uniform(200, 600)
                    retry_response = self.client.post(
                        f"/api/products/{product_id}/bids",
                        json={"price": retry_price},
                        headers=self.headers,
                        name="指數型出價（重試）"
                    )
                    if retry_response.status_code == 200:
                        self.update_highest_price(product_id, retry_price)
                except:
                    pass
