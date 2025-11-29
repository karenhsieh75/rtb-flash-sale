import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { ProductInfo } from '../components/ProductInfo';
import { BidForm } from '../components/BidForm';
import { RankingTable } from '../components/RankingTable';
import { ResultSection } from '../components/ResultSection';
import { mockProductService } from '../services/mockProductService';
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

  useEffect(() => {
    if (!productId) return;

    const loadData = () => {
      const productData = mockProductService.getProductById(productId);
      if (productData) {
        setProduct(productData);
        const rankingData = mockProductService.getProductRankings(productId);
        setRankings(rankingData);

        if (productData.status === 'ended') {
          const resultData = mockProductService.getProductResults(productId);
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
      }
    };

    loadData();
    const interval = setInterval(loadData, 2000);

    return () => clearInterval(interval);
  }, [productId, user]);

  const handleBidSubmit = async (price: number) => {
    if (!productId || !user) return;
    await mockProductService.placeBid(productId, user.id, price);
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showBackButton backTo="/products" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-600">載入中...</div>
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

