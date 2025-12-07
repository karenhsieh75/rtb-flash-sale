import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { productService } from '../services/productService';
import type { Product, ProductStatus } from '../types/product';

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusText = (status: ProductStatus): string => {
  switch (status) {
    case 'not_started':
      return '準備中';
    case 'active':
      return '競標中';
    case 'ended':
      return '已結束';
    default:
      return '未知';
  }
};

const getStatusColor = (status: ProductStatus): string => {
  switch (status) {
    case 'not_started':
      return 'bg-yellow-100 text-yellow-800';
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'ended':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const CountdownTimer = ({ startTime, endTime, status }: { startTime: number; endTime: number; status: ProductStatus }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      let remaining = 0;
      let prefix = '';

      if (status === 'not_started') {
        remaining = Math.max(0, startTime - now);
        prefix = '距開始：';
      } else if (status === 'active') {
        remaining = Math.max(0, endTime - now);
        prefix = '距結束：';
      } else {
        setTimeLeft('已結束');
        return;
      }

      if (remaining <= 0) {
        setTimeLeft('已結束');
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${prefix}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startTime, endTime, status]);

  return <span className="text-sm font-medium">{timeLeft}</span>;
};

export const ProductLobbyPage = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await productService.getAllProducts();
        setProducts(data);
      } catch (err) {
        console.error('載入商品失敗:', err);
      }
    };

    loadProducts();
    // 每 5 秒輪詢一次更新商品列表
    const interval = setInterval(loadProducts, 5000);

    return () => clearInterval(interval);
  }, []);

  const getActionButton = (product: Product) => {
    if (product.status === 'not_started') {
      return (
        <Link
          to={`/auction/${product.id}`}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
        >
          查看
        </Link>
      );
    } else if (product.status === 'active') {
      return (
        <Link
          to={`/auction/${product.id}`}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          立即競標
        </Link>
      );
    } else {
      return (
        <Link
          to={`/auction/${product.id}`}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          查看結果
        </Link>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">目前活動商品</h2>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    商品名稱
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    起標價
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    限量數量 K
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    開始時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    結束時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    倒數時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                      目前沒有商品
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{product.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(product.status)}`}>
                          {getStatusText(product.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        $ {product.basePrice.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.k}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(product.startTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(product.endTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <CountdownTimer
                          startTime={product.startTime}
                          endTime={product.endTime}
                          status={product.status}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getActionButton(product)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

