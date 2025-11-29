import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface BidFormProps {
  userWeight: number;
  userRank: number | null;
  basePrice: number;
  activityStatus: 'not_started' | 'active' | 'ended';
  onBidSubmit: (price: number) => Promise<void>;
}

export const BidForm = ({
  userWeight,
  userRank,
  basePrice,
  activityStatus,
  onBidSubmit,
}: BidFormProps) => {
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const bidPrice = parseFloat(price);
    
    if (isNaN(bidPrice) || bidPrice <= 0) {
      setMessage({ type: 'error', text: '請輸入有效的出價金額' });
      return;
    }

    if (bidPrice < basePrice) {
      setMessage({ type: 'error', text: '出價需高於起標價' });
      return;
    }

    setLoading(true);
    try {
      await onBidSubmit(bidPrice);
      setMessage({ type: 'success', text: `出價成功！以 $${bidPrice.toLocaleString()} 參與競標` });
      setPrice('');
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '出價失敗' });
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = activityStatus !== 'active' || loading;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-800 mb-4">我要出價</h2>

      <div className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">你的會員權重 W：</span>
          <span className="font-semibold text-gray-800">{userWeight}</span>
        </div>
        {userRank !== null ? (
          <div className="flex justify-between">
            <span className="text-gray-600">你目前暫定排名：</span>
            <span className="font-semibold text-blue-600">第 {userRank} 名</span>
          </div>
        ) : (
          <div className="text-gray-500 text-xs">尚未進入前 K 名</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="bid-price" className="block text-sm font-medium text-gray-700 mb-1">
            出價金額 P
          </label>
          <input
            id="bid-price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="請輸入出價金額"
            min={basePrice}
            step="0.01"
            disabled={isDisabled}
            required
          />
        </div>

        {message && (
          <div
            className={`p-2 rounded-md text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {activityStatus === 'not_started' && (
          <p className="text-sm text-gray-500">活動尚未開始，請稍候。</p>
        )}

        {activityStatus === 'ended' && (
          <p className="text-sm text-gray-500">活動已結束，無法再出價。</p>
        )}

        <button
          type="submit"
          disabled={isDisabled}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '送出中...' : '送出出價'}
        </button>
      </form>
    </div>
  );
};

