import { useEffect, useState } from 'react';
import type { Product } from '../types/product';

interface ProductInfoProps {
  product: Product;
}

export const ProductInfo = ({ product }: ProductInfoProps) => {
  const [timeLeft, setTimeLeft] = useState<string>('--:--');

  useEffect(() => {
    if (product.status === 'ended') {
      setTimeLeft('已結束');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      let remaining = 0;
      let prefix = '';

      if (product.status === 'not_started') {
        remaining = Math.max(0, product.startTime - now);
        prefix = '距開始：';
      } else if (product.status === 'active') {
        remaining = Math.max(0, product.endTime - now);
        prefix = '距結束：';
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
  }, [product]);

  const getStatusText = () => {
    switch (product.status) {
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{product.title}</h2>
      
      <div className="mb-4">
        <div className="w-full h-64 bg-gray-200 rounded-md flex items-center justify-center text-gray-400">
          商品圖片
        </div>
      </div>

      <div className="mb-4">
        <p className="text-gray-600">{product.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">起標價：</span>
          <span className="font-semibold text-gray-800 ml-2">$ {product.basePrice.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-600">限量數量 K：</span>
          <span className="font-semibold text-gray-800 ml-2">{product.k}</span>
        </div>
        <div>
          <span className="text-gray-600">目前最高出價：</span>
          <span className="font-semibold text-green-600 ml-2">$ {product.currentHighestPrice.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-600">活動狀態：</span>
          <span className="font-semibold text-gray-800 ml-2">{getStatusText()}</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-600">倒數時間：</span>
          <span className="font-semibold text-red-600 ml-2">{timeLeft}</span>
        </div>
      </div>
    </div>
  );
};

