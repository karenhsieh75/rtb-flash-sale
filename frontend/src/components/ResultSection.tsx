import { useAuth } from '../contexts/AuthContext';
import type { ProductResult } from '../types/product';

interface ResultSectionProps {
  results: ProductResult[];
  k: number;
}

export const ResultSection = ({ results, k }: ResultSectionProps) => {
  const { user } = useAuth();
  const userResult = user ? results.find((r) => r.userId === user.id) : null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">最終競標結果</h2>

      <div className="mb-4">
        <p className="text-gray-600">
          本商品最終得標 {k} 名使用者如下：
        </p>
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Rank</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">User</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-700">Final Price</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-700">Final Score</th>
              <th className="text-center py-2 px-2 font-semibold text-gray-700">是否成交</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-500">
                  尚無結果資料
                </td>
              </tr>
            ) : (
              results.map((result) => {
                const isCurrentUser = user && result.userId === user.id;
                return (
                  <tr
                    key={result.rank}
                    className={`border-b border-gray-100 ${
                      isCurrentUser ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="py-2 px-2 font-medium text-gray-800">
                      {result.rank}
                      {isCurrentUser && <span className="text-blue-600 ml-1">(You)</span>}
                    </td>
                    <td className="py-2 px-2 text-gray-700">{result.displayName}</td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      $ {result.finalPrice.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      {result.finalScore.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {result.isWinner ? (
                        <span className="text-green-600 font-semibold">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {userResult && (
        <div
          className={`p-4 rounded-md ${
            userResult.isWinner
              ? 'bg-green-50 border border-green-200'
              : 'bg-gray-50 border border-gray-200'
          }`}
        >
          {userResult.isWinner ? (
            <div>
              <p className="text-green-700 font-semibold mb-1">恭喜，你成功得標！</p>
              <p className="text-sm text-green-600">
                得標價格：$ {userResult.finalPrice.toLocaleString()}，排名：第 {userResult.rank} 名
              </p>
            </div>
          ) : (
            <p className="text-gray-700">本次未得標，歡迎參與其他商品。</p>
          )}
        </div>
      )}
    </div>
  );
};

