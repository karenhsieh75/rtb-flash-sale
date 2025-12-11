#!/usr/bin/env python3
"""
Demo 影片專用腳本
清晰展示所有測試場景，適合錄製影片
"""

import requests
import time
import random
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

BASE_URL = "https://d28wqj892frr80.cloudfront.net"


def print_section(title):
    """打印章節標題"""
    print(f"\n{title}")
    print("-" * 60)


def print_info(message, value=None):
    """打印資訊"""
    if value is not None:
        print(f"  {message}: {value}")
    else:
        print(f"  {message}")


def print_success(message):
    """打印成功訊息"""
    print(f"  [OK] {message}")


def print_warning(message):
    """打印警告訊息"""
    print(f"  [WARN] {message}")


def print_error(message):
    """打印錯誤訊息"""
    print(f"  [ERROR] {message}")


def print_progress(current, total, prefix="進度"):
    """打印進度"""
    percent = (current / total) * 100 if total > 0 else 0
    print(f"  {prefix}: {percent:.1f}% ({current}/{total})", end='\r')
    if current == total:
        print()


class DemoTest:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.product_id = None
        self.k = None
        self.users = []
        self.stats = {
            "total_bids": 0,
            "successful_bids": 0,
            "failed_bids": 0,
            "start_time": None,
            "end_time": None,
        }
    
    def step1_setup_product(self):
        """步驟 1: 系統啟動、商品上架設定"""
        print_section("步驟 1: 系統啟動與商品上架設定")
        
        print_info("正在創建管理員帳號...")
        username = f"demo_admin_{int(time.time())}"
        password = "admin123456"
        
        # 註冊管理員
        register_res = requests.post(
            f"{self.base_url}/api/auth/register",
            json={
                "username": username,
                "password": password,
                "role": "admin"
            },
            timeout=10
        )
        
        if register_res.status_code != 200:
            login_res = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"username": username, "password": password},
                timeout=10
            )
            if login_res.status_code == 200:
                self.admin_token = login_res.json().get("token")
            else:
                print_error("無法創建管理員帳號")
                return False
        else:
            # 註冊成功後需要登入獲取 token
            login_res = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"username": username, "password": password},
                timeout=10
            )
            if login_res.status_code == 200:
                self.admin_token = login_res.json().get("token")
        
        if not self.admin_token:
            print_error("無法獲取管理員 token")
            return False
        
        print_success("管理員帳號創建成功")
        
        # 創建測試商品
        print_info("正在創建測試商品...")
        now = int(time.time() * 1000)
        start_time = now + 10000  # 10 秒後開始
        end_time = now + 300000   # 5 分鐘後結束
        
        product_data = {
            "title": "Demo 測試商品",
            "description": "用於 Demo 影片的測試商品",
            "basePrice": 1000.0,
            "k": 5,  # 限量 5 個
            "startTime": start_time,
            "endTime": end_time,
            "alpha": 1.0,
            "beta": 0.5,
            "gamma": 0.3
        }
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        create_res = requests.post(
            f"{self.base_url}/api/admin/products",
            json=product_data,
            headers=headers,
            timeout=10
        )
        
        if create_res.status_code in [200, 201]:
            product_response = create_res.json()
            self.product_id = product_response.get("id")
            self.k = product_data["k"]
            print_success(f"商品創建成功！商品 ID: {self.product_id}")
            print_info("商品參數", f"底價: {product_data['basePrice']}, K值: {self.k}")
            print_info("活動時間", f"開始: {datetime.fromtimestamp(start_time/1000).strftime('%H:%M:%S')}, 結束: {datetime.fromtimestamp(end_time/1000).strftime('%H:%M:%S')}")
            return True
        else:
            print_error(f"商品創建失敗 (狀態碼: {create_res.status_code}): {create_res.text}")
            return False
    
    def step2_user_operation(self):
        """步驟 2: 使用者操作：登入、出價、即時看到排名變化"""
        print_section("步驟 2: 使用者操作演示")
        
        print_info("創建測試用戶...")
        username = f"demo_user_{int(time.time())}"
        password = "test123456"
        
        # 註冊
        register_res = requests.post(
            f"{self.base_url}/api/auth/register",
            json={
                "username": username,
                "password": password,
                "role": "member"
            },
            timeout=10
        )
        
        if register_res.status_code != 200:
            login_res = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"username": username, "password": password},
                timeout=10
            )
            if login_res.status_code == 200:
                token = login_res.json().get("token")
                user = login_res.json().get("user", {})
            else:
                print_error("無法創建用戶")
                return False
        else:
            # 註冊成功後登入
            login_res = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"username": username, "password": password},
                timeout=10
            )
            if login_res.status_code == 200:
                token = login_res.json().get("token")
                user = login_res.json().get("user", {})
            else:
                print_error("無法登入")
                return False
        
        print_success(f"用戶登入成功: {user.get('username')}")
        print_info("用戶權重", user.get("weight"))
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # 查看商品
        print_info("查看商品詳情...")
        product_res = requests.get(
            f"{self.base_url}/api/products/{self.product_id}",
            headers=headers,
            timeout=10
        )
        
        if product_res.status_code == 200:
            product = product_res.json()
            print_success("商品資訊獲取成功")
            print_info("商品標題", product.get("title"))
            print_info("當前最高價", product.get("currentHighestPrice", product.get("basePrice")))
        
        # 查看排行榜
        print_info("查看排行榜...")
        rankings_res = requests.get(
            f"{self.base_url}/api/products/{self.product_id}/rankings",
            headers=headers,
            timeout=10
        )
        
        if rankings_res.status_code == 200:
            rankings = rankings_res.json()
            print_success("排行榜獲取成功")
            print_info("排行榜人數", len(rankings.get("rankings", [])))
            print_info("當前最高價", rankings.get("currentHighestPrice"))
        
        # 出價
        print_info("提交出價...")
        current_highest = rankings.get("currentHighestPrice", 1000)
        bid_price = current_highest + 50
        
        bid_res = requests.post(
            f"{self.base_url}/api/products/{self.product_id}/bids",
            json={"price": bid_price},
            headers=headers,
            timeout=10
        )
        
        if bid_res.status_code == 200:
            bid_data = bid_res.json().get("bid", {})
            print_success(f"出價成功！出價金額: {bid_price}, 分數: {bid_data.get('score', 0)}")
            
            # 等待一下讓系統更新
            time.sleep(1)
            
            # 再次查看排行榜
            print_info("再次查看排行榜（即時更新）...")
            rankings_res = requests.get(
                f"{self.base_url}/api/products/{self.product_id}/rankings",
                headers=headers,
                timeout=10
            )
            
            if rankings_res.status_code == 200:
                updated_rankings = rankings_res.json()
                print_success("排行榜已更新")
                print_info("更新後排行榜人數", len(updated_rankings.get("rankings", [])))
                print_info("更新後最高價", updated_rankings.get("currentHighestPrice"))
                
                # 顯示前 3 名
                top_3 = updated_rankings.get("rankings", [])[:3]
                if top_3:
                    print_info("前 3 名排行榜:")
                    for i, rank in enumerate(top_3, 1):
                        print(f"    {i}. {rank.get('displayName')} - 價格: {rank.get('price')}, 分數: {rank.get('score'):.4f}")
        
        return True
    
    def step3_load_test(self, num_users=1000):
        """步驟 3: 模擬搶購過程（壓力測試）"""
        print_section(f"步驟 3: 壓力測試 - {num_users} 個並發用戶")
        
        print_info("正在創建測試用戶...")
        print_progress(0, num_users, "創建用戶")
        
        def create_user(i):
            username = f"loadtest_user_{i}_{int(time.time())}"
            password = "test123456"
            
            register_res = requests.post(
                f"{self.base_url}/api/auth/register",
                json={
                    "username": username,
                    "password": password,
                    "role": "member"
                },
                timeout=10
            )
            
            if register_res.status_code != 200:
                login_res = requests.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": username, "password": password},
                    timeout=10
                )
                if login_res.status_code == 200:
                    return {
                        "username": username,
                        "token": login_res.json().get("token"),
                        "user_id": login_res.json().get("user", {}).get("id")
                    }
            else:
                # 註冊成功後登入
                login_res = requests.post(
                    f"{self.base_url}/api/auth/login",
                    json={"username": username, "password": password},
                    timeout=10
                )
                if login_res.status_code == 200:
                    return {
                        "username": username,
                        "token": login_res.json().get("token"),
                        "user_id": login_res.json().get("user", {}).get("id")
                    }
            return None
        
        # 創建用戶
        with ThreadPoolExecutor(max_workers=50) as executor:
            futures = [executor.submit(create_user, i) for i in range(num_users)]
            created = 0
            for future in as_completed(futures):
                user = future.result()
                if user:
                    self.users.append(user)
                    created += 1
                    if created % 100 == 0:
                        print_progress(created, num_users, "創建用戶")
        
        print_progress(len(self.users), num_users, "創建用戶")
        print_success(f"成功創建 {len(self.users)} 個用戶")
        
        # 獲取當前最高價
        if self.users:
            headers = {"Authorization": f"Bearer {self.users[0]['token']}"}
            rankings_res = requests.get(
                f"{self.base_url}/api/products/{self.product_id}/rankings",
                headers=headers,
                timeout=10
            )
            current_highest = 1000
            if rankings_res.status_code == 200:
                rankings = rankings_res.json()
                current_highest = rankings.get("currentHighestPrice", 1000)
        
        print_info("開始壓力測試...")
        print_info("當前最高價", current_highest)
        print_info("目標並發數", num_users)
        
        self.stats["start_time"] = time.time()
        
        # 使用鎖來追蹤當前最高價（簡化版，實際並發時可能不準確，但可以減少失敗率）
        price_lock = threading.Lock()
        dynamic_highest = current_highest
        
        def place_bid_worker(user, bid_index):
            """出價工作函數 - 改進版：使用更大的增量並添加隨機性"""
            headers = {"Authorization": f"Bearer {user['token']}"}
            
            # 獲取當前最高價（帶鎖保護）
            with price_lock:
                base_price = dynamic_highest
                # 使用更大的增量：基礎增量 100 + 索引增量 50 + 隨機增量 0-200
                increment = 100 + (bid_index * 50) + random.randint(0, 200)
                price = base_price + increment
            
            try:
                res = requests.post(
                    f"{self.base_url}/api/products/{self.product_id}/bids",
                    json={"price": price},
                    headers=headers,
                    timeout=5
                )
                
                if res.status_code == 200:
                    # 更新最高價（如果成功）
                    with price_lock:
                        if price > dynamic_highest:
                            dynamic_highest = price
                    return True, None
                else:
                    # 嘗試解析錯誤訊息
                    try:
                        error_data = res.json()
                        error_msg = error_data.get("error", res.text)
                    except:
                        error_msg = res.text
                    
                    # 如果是因為價格太低，嘗試重新獲取最高價並重試一次
                    if "必須高於" in error_msg or "高於目前最高" in error_msg:
                        # 重新獲取最高價
                        try:
                            rankings_res = requests.get(
                                f"{self.base_url}/api/products/{self.product_id}/rankings",
                                headers=headers,
                                timeout=3
                            )
                            if rankings_res.status_code == 200:
                                rankings = rankings_res.json()
                                new_highest = rankings.get("currentHighestPrice", base_price)
                                with price_lock:
                                    dynamic_highest = max(dynamic_highest, new_highest)
                                    base_price = dynamic_highest
                                
                                # 重試一次，使用更高的價格
                                retry_price = base_price + 200 + random.randint(0, 300)
                                retry_res = requests.post(
                                    f"{self.base_url}/api/products/{self.product_id}/bids",
                                    json={"price": retry_price},
                                    headers=headers,
                                    timeout=5
                                )
                                if retry_res.status_code == 200:
                                    with price_lock:
                                        if retry_price > dynamic_highest:
                                            dynamic_highest = retry_price
                                    return True, None
                        except:
                            pass
                    
                    return False, f"狀態碼 {res.status_code}: {error_msg}"
            except Exception as e:
                return False, f"異常: {str(e)}"
        
        # 並發出價
        print_info("正在執行並發出價...")
        print_progress(0, len(self.users), "出價進度")
        
        successful = 0
        failed = 0
        
        with ThreadPoolExecutor(max_workers=200) as executor:
            futures = []
            for i, user in enumerate(self.users):
                futures.append(executor.submit(place_bid_worker, user, i))
            
            completed = 0
            for future in as_completed(futures):
                success, error = future.result()
                if success:
                    successful += 1
                    self.stats["successful_bids"] += 1
                else:
                    failed += 1
                    self.stats["failed_bids"] += 1
                
                completed += 1
                self.stats["total_bids"] += 1
                
                if completed % 100 == 0:
                    print_progress(completed, len(self.users), "出價進度")
        
        print_progress(len(self.users), len(self.users), "出價進度")
        
        self.stats["end_time"] = time.time()
        elapsed = self.stats["end_time"] - self.stats["start_time"]
        
        print_success(f"壓力測試完成！")
        print_info("總耗時", f"{elapsed:.2f} 秒")
        print_info("成功出價", successful)
        print_info("失敗出價", failed)
        if failed > 0:
            print_warning(f"失敗率: {(failed/len(self.users)*100):.2f}%")
        print_info("成功率", f"{(successful/len(self.users)*100):.2f}%")
        print_info("平均 RPS", f"{(len(self.users)/elapsed):.2f} 請求/秒")
        
        # 如果失敗率過高，顯示提示
        if failed > 0 and failed / len(self.users) > 0.1:
            print_warning("注意: 失敗率超過 10%，可能原因：")
            print_warning("  - 活動尚未開始或已結束")
            print_warning("  - 出價金額低於當前最高價（並發時可能發生）")
            print_warning("  - 網路延遲或超時")
        
        # 等待數據同步
        print_info("等待數據同步...")
        time.sleep(3)
        
        return True
    
    def step4_exponential_growth(self):
        """步驟 4: 指數型成長頻率展示"""
        print_section("步驟 4: 指數型成長頻率展示")
        
        print_info("此場景需要使用 Locust 的 ExponentialRampUpUser 類別")
        print_info("運行命令", "locust -f locustfile_demo.py --headless --users=1000 --spawn-rate=10 --run-time=2m")
        print_warning("請在另一個終端運行上述命令以展示指數型成長")
        
        return True
    
    def step5_scalability(self):
        """步驟 5: Scalability 展示"""
        print_section("步驟 5: Scalability 展示")
        
        print_info("此場景需要監控系統資源")
        print_info("運行命令", "python3 scalability_test.py")
        print_info("或使用 Grafana 查看 Prometheus 指標")
        print_warning("請在另一個終端運行監控腳本")
        
        return True
    
    def step6_consistency_check(self):
        """步驟 6: 一致性驗證"""
        print_section("步驟 6: 一致性驗證（防超賣）")
        
        if not self.users:
            print_warning("沒有測試用戶數據，跳過驗證")
            return False
        
        print_info("正在驗證最終結果...")
        
        # 獲取排行榜
        headers = {"Authorization": f"Bearer {self.users[0]['token']}"}
        rankings_res = requests.get(
            f"{self.base_url}/api/products/{self.product_id}/rankings",
            headers=headers,
            timeout=10
        )
        
        if rankings_res.status_code == 200:
            rankings = rankings_res.json()
            ranking_count = len(rankings.get("rankings", []))
            
            print_info("最終排行榜人數", ranking_count)
            print_info("商品 K 值", self.k)
            
            if ranking_count <= self.k:
                print_success(f"✅ 驗證通過：排行榜人數 ({ranking_count}) <= K ({self.k})")
                print_success("✅ 沒有超賣問題！")
            else:
                print_error(f"❌ 驗證失敗：排行榜人數 ({ranking_count}) > K ({self.k})")
                print_error("❌ 發現超賣問題！")
                return False
            
            # 顯示最終排行榜
            if rankings.get("rankings"):
                print_info("最終排行榜（前 K 名）:")
                for i, rank in enumerate(rankings.get("rankings", [])[:self.k], 1):
                    print(f"    {i}. {rank.get('displayName')} - 價格: {rank.get('price')}, 分數: {rank.get('score'):.4f}")
            
            return True
        else:
            print_error("無法獲取排行榜")
            return False
    
    def run_full_demo(self):
        """運行完整 Demo"""
        print_section("Demo 影片腳本開始")
        print_info("此腳本將展示所有測試場景")
        print_info("API 地址", self.base_url)
        print()
        
        # 步驟 1
        if not self.step1_setup_product():
            print_error("步驟 1 失敗，退出")
            return False
        
        time.sleep(2)
        
        # 步驟 2
        if not self.step2_user_operation():
            print_error("步驟 2 失敗，退出")
            return False
        
        time.sleep(2)
        
        # 步驟 3
        print_warning("即將開始壓力測試，這可能需要一些時間...")
        input("按 Enter 繼續壓力測試...")
        
        if not self.step3_load_test(num_users=1000):
            print_error("步驟 3 失敗")
            return False
        
        time.sleep(2)
        
        # 步驟 4
        self.step4_exponential_growth()
        input("按 Enter 繼續...")
        
        # 步驟 5
        self.step5_scalability()
        input("按 Enter 繼續...")
        
        # 步驟 6
        if not self.step6_consistency_check():
            print_error("步驟 6 失敗")
            return False
        
        print_section("Demo 完成")
        print_success("所有測試場景已展示完成")
        print_info("總出價次數", self.stats["total_bids"])
        print_info("成功出價", self.stats["successful_bids"])
        print_info("失敗出價", self.stats["failed_bids"])
        
        return True


if __name__ == "__main__":
    demo = DemoTest()
    demo.run_full_demo()

