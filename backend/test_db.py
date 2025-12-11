import psycopg2
from psycopg2 import OperationalError

DB_HOST = "database-1.cc306cayyw9d.us-east-1.rds.amazonaws.com"
DB_PORT = "5432"
DB_NAME = "auction_db"
DB_USER = "postgres"
DB_PASSWORD = "rtbflashsale"

def create_connection():
    """嘗試連線到 PostgreSQL 資料庫"""
    connection = None
    try:
        print(f"正在嘗試連線到 {DB_HOST}...")
        connection = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        print("\n連線成功！資料庫可以正常訪問。")
    except OperationalError as e:
        print(f"\n連線失敗。錯誤訊息如下：\n{e}")
        print("\n故障排除提示：")
        print("1. 請檢查您的 Security Group 是否已允許您的 IP (Port 5432)。")
        print("2. 請確認 RDS 實例狀態是否為 'Available'。")
        print("3. 請確認 DB_NAME, DB_USER, DB_PASSWORD 是否正確。")
    return connection

def query_ended_products_rankings(conn):
    """查詢最新已結束商品的排名"""
    try:
        cursor = conn.cursor()
        
        # 1. 查詢最新的一個已結束的商品
        cursor.execute("""
            SELECT id, title, k, base_price
            FROM products
            WHERE status = 'ended'
            ORDER BY end_time DESC
            LIMIT 1;
        """)
        product = cursor.fetchone()
        
        if not product:
            print("\n目前沒有已結束的商品。")
            return
        
        product_id, title, k, base_price = product
        print("\n商品資訊：")
        print("=" * 80)
        print(f"商品 ID: {product_id}")
        print(f"商品名稱: {title}")
        print(f"限量數量 (K): {k}")
        print(f"起標價: ${base_price:,.2f}")
        print("-" * 80)
        
        # 2. 查詢該商品的出價排名（按 score 降序）
        cursor.execute("""
            SELECT 
                bl.user_id,
                COALESCE(u.username, 'User_' || bl.user_id) as display_name,
                bl.price,
                bl.score,
                bl.created_at
            FROM bid_logs bl
            LEFT JOIN users u ON u.id::text = bl.user_id
            WHERE bl.product_id = %s
            ORDER BY bl.score DESC
            LIMIT %s;
        """, (product_id, k))
        
        rankings = cursor.fetchall()
        
        if not rankings:
            print("此商品尚無出價記錄。")
        else:
            print(f"\n前 {len(rankings)} 名排名：")
            print(f"{'排名':<6} {'用戶ID':<15} {'用戶名稱':<20} {'出價':<15} {'分數':<15} {'出價時間'}")
            print("-" * 95)
            
            for rank, (user_id, display_name, price, score, created_at) in enumerate(rankings, 1):
                print(f"{rank:<6} {user_id:<15} {display_name:<20} ${price:<14,.2f} {score:<15.4f} {created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        
        cursor.close()
        
    except Exception as e:
        print(f"\n查詢排名時發生錯誤: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # 執行連線測試
    conn = create_connection()
    
    # 如果連線成功，查詢已結束商品的排名
    if conn:
        try:
            query_ended_products_rankings(conn)
            conn.close()
            print("\n連線已關閉。")
        except Exception as e:
            print(f"\n執行時發生錯誤: {e}")
            import traceback
            traceback.print_exc()
            if conn:
                conn.close()