import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { ProductInfo } from '../components/ProductInfo';
import { BidForm } from '../components/BidForm';
import { RankingTable } from '../components/RankingTable';
import { ResultSection } from '../components/ResultSection';
import { productService } from '../services/productService';
import { websocketService } from '../services/websocketService';
import { useAuth } from '../contexts/AuthContext';
import type { Product } from '../types/product';
import type { RankingItem } from '../components/RankingTable';
import type { ProductResult } from '../types/product';

export const AuctionDetailPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [results, setResults] = useState<ProductResult[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userScore, setUserScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始加载数据
  useEffect(() => {
    if (!productId) return;

    const loadData = async () => {
      try {
        setError(null);
        const [productData, rankingData] = await Promise.all([
          productService.getProductById(productId),
          productService.getProductRankings(productId),
        ]);

        setProduct(productData);
        setRankings(rankingData);

        if (productData.status === 'ended') {
          const resultData = await productService.getProductResults(productId);
          setResults(resultData);
        }

        // 计算用户排名
        if (user) {
          const userRanking = rankingData.find((r) => r.userId === user.id);
          if (userRanking) {
            setUserRank(userRanking.rank);
            setUserScore(userRanking.score);
          } else {
            setUserRank(null);
            setUserScore(null);
          }
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '載入失敗');
        setLoading(false);
      }
    };

    loadData();
  }, [productId, user]);

  // WebSocket 连接和消息处理
  useEffect(() => {
    if (!productId || !user) return;

    // 连接 WebSocket
    websocketService.connect(productId);

    // 处理 WebSocket 消息
    const handleMessage = (message: any) => {
      if (message.type === 'rankings_update' && message.data) {
        const rankings = message.data.rankings || [];
        setRankings(rankings);

        // 更新商品最高价
        if (product && message.data.currentHighestPrice !== undefined) {
          setProduct({
            ...product,
            currentHighestPrice: message.data.currentHighestPrice,
          });
        }

        // 更新用户排名
        if (user) {
          const userRanking = rankings.find((r: RankingItem) => r.userId === user.id);
          if (userRanking) {
            setUserRank(userRanking.rank);
            setUserScore(userRanking.score);
          } else {
            setUserRank(null);
            setUserScore(null);
          }
        }
      } else if (message.type === 'product_update' && message.data) {
        if (product) {
          setProduct({
            ...product,
            status: message.data.status || product.status,
            currentHighestPrice: message.data.currentHighestPrice || product.currentHighestPrice,
          });
        }
      } else if (message.type === 'bid_notification') {
        // 出价通知，可以显示提示或更新 UI
        console.log('收到出价通知:', message.data);
      }
    };

    websocketService.onMessage(handleMessage);

    // 清理函数
    return () => {
      websocketService.disconnect();
    };
  }, [productId, user, product]);

  const handleBidSubmit = async (price: number) => {
    if (!productId || !user) return;
    try {
      await productService.placeBid(productId, price);
      // WebSocket 会自动推送更新，不需要手动刷新
    } catch (err) {
      throw err;
    }
  };

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showBackButton backTo="/products" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-600">載入中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showBackButton backTo="/products" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBackButton backTo="/products" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 商品資訊 */}
        <div className="mb-6">
          <ProductInfo product={product} />
        </div>

        {/* 出價和排行榜 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 左側：出價表單 */}
          <div>
            <BidForm
              userWeight={user?.weight || 1.2}
              userRank={userRank}
              basePrice={product.basePrice}
              activityStatus={product.status}
              onBidSubmit={handleBidSubmit}
            />
          </div>

          {/* 右側：排行榜 */}
          <div>
            <RankingTable
              rankings={rankings}
              currentHighestPrice={product.currentHighestPrice}
              k={product.k}
              userRank={userRank}
              userScore={userScore}
            />
          </div>
        </div>

        {/* 結果區塊（僅在已結束時顯示） */}
        {product.status === 'ended' && (
          <div>
            <ResultSection results={results} k={product.k} />
          </div>
        )}
      </div>
    </div>
  );
};

