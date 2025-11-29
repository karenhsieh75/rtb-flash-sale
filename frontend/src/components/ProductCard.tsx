import { useEffect, useState } from 'react';

interface ProductCardProps {
  productName: string;
  basePrice: number;
  currentHighestPrice: number;
  k: number;
  endTime: number | null;
  activityStatus: 'not_started' | 'active' | 'ended';
}

export const ProductCard = ({
  productName,
  basePrice,
  currentHighestPrice,
  k,
  endTime,
  activityStatus,
}: ProductCardProps) => {
  const [timeLeft, setTimeLeft] = useState<string>('--:--');

  useEffect(() => {
    if (!endTime || activityStatus !== 'active') {
      setTimeLeft('--:--');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);

      if (remaining <= 0) {
        setTimeLeft('00:00');
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endTime, activityStatus]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-800 mb-4">{productName}</h2>
      
      <div className="mb-4">
        <div className="w-full h-48 bg-gray-200 rounded-md flex items-center justify-center text-gray-400">
          商品圖片
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">限量數量 K：</span>
          <span className="font-semibold text-gray-800">{k}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">起標價：</span>
          <span className="font-semibold text-gray-800">$ {basePrice.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">目前最高出價：</span>
          <span className="font-semibold text-green-600">$ {currentHighestPrice.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">活動剩餘時間：</span>
          <span className="font-semibold text-red-600">{timeLeft}</span>
        </div>
      </div>

      {activityStatus === 'ended' && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm font-medium text-center">活動已結束</p>
        </div>
      )}
    </div>
  );
};

