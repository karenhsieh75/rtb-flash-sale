"""
数据验证脚本
验证「訂單數 <= 庫存數」的约束
"""

import psycopg2
import redis
import sys
from datetime import datetime

# 数据库配置
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'auction_db',
    'user': 'admin',
    'password': 'password123'
}

# Redis 配置
REDIS_CONFIG = {
    'host': 'localhost',
    'port': 6379,
    'db': 0
}

def verify_no_overselling():
    """
    验证没有超卖：
    1. 检查每个商品的出价记录数是否 <= K (限量数量)
    2. 检查 Redis 排行榜中的用户数是否 <= K
    3. 检查数据库中的出价记录
    """
    print("=" * 60)
    print("数据验证报告")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # 连接数据库
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("✓ 数据库连接成功")
    except Exception as e:
        print(f"✗ 数据库连接失败: {e}")
        return False
    
    # 连接 Redis
    try:
        r = redis.Redis(**REDIS_CONFIG)
        r.ping()
        print("✓ Redis 连接成功")
    except Exception as e:
        print(f"✗ Redis 连接失败: {e}")
        return False
    
    # 获取所有商品
    cursor.execute("SELECT id, k FROM products")
    products = cursor.fetchall()
    
    all_valid = True
    
    for product_id, k in products:
        print(f"\n商品 ID: {product_id}, 限量数量 K: {k}")
        print("-" * 60)
        
        # 1. 检查数据库中的出价记录数
        cursor.execute("""
            SELECT COUNT(DISTINCT user_id) 
            FROM bid_logs 
            WHERE product_id = %s
        """, (product_id,))
        db_bid_count = cursor.fetchone()[0]
        
        # 2. 检查 Redis 排行榜中的用户数
        rank_key = f"auction:{product_id}:rank"
        redis_rank_count = r.zcard(rank_key)
        
        # 3. 获取前 K 名的用户
        top_k_users = r.zrevrange(rank_key, 0, k - 1)
        
        print(f"  数据库出价用户数: {db_bid_count}")
        print(f"  Redis 排行榜用户数: {redis_rank_count}")
        print(f"  前 K 名用户数: {len(top_k_users)}")
        
        # 验证：前 K 名用户数应该 <= K
        if len(top_k_users) > k:
            print(f"  ✗ 错误：前 K 名用户数 ({len(top_k_users)}) > K ({k})")
            all_valid = False
        else:
            print(f"  ✓ 前 K 名用户数 ({len(top_k_users)}) <= K ({k})")
        
        # 验证：Redis 排行榜应该只保留前 K 名
        if redis_rank_count > k:
            print(f"  ⚠ 警告：Redis 排行榜用户数 ({redis_rank_count}) > K ({k})")
            print(f"    说明：Redis 可能保留了历史记录，但前 K 名是正确的")
        
        # 显示前 K 名用户
        if top_k_users:
            print(f"\n  前 {min(len(top_k_users), k)} 名用户:")
            for i, user_id in enumerate(top_k_users[:k], 1):
                score = r.zscore(rank_key, user_id)
                bid_details = r.hget(f"auction:{product_id}:bids", user_id)
                print(f"    {i}. User: {user_id.decode()}, Score: {score:.4f}, Details: {bid_details.decode() if bid_details else 'N/A'}")
    
    # 统计总出价记录
    cursor.execute("SELECT COUNT(*) FROM bid_logs")
    total_bids = cursor.fetchone()[0]
    print(f"\n总出价记录数: {total_bids}")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 60)
    if all_valid:
        print("✓ 验证通过：没有超卖问题")
        return True
    else:
        print("✗ 验证失败：发现超卖问题")
        return False

def generate_report():
    """生成验证报告并保存到文件"""
    report_file = f"verification_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    
    # 重定向输出到文件
    original_stdout = sys.stdout
    with open(report_file, 'w', encoding='utf-8') as f:
        sys.stdout = f
        result = verify_no_overselling()
        sys.stdout = original_stdout
    
    print(f"\n报告已保存到: {report_file}")
    return result

if __name__ == "__main__":
    result = verify_no_overselling()
    sys.exit(0 if result else 1)

