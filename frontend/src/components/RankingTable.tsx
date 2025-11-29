import { useAuth } from '../contexts/AuthContext';

export interface RankingItem {
  rank: number;
  userId: string;
  displayName: string;
  price: number;
  reactionTime: number;
  weight: number;
  score: number;
}

interface RankingTableProps {
  rankings: RankingItem[];
  currentHighestPrice: number;
  k: number;
  userRank: number | null;
  userScore: number | null;
}

export const RankingTable = ({
  rankings,
  currentHighestPrice,
  k,
  userRank,
  userScore,
}: RankingTableProps) => {
  const { user } = useAuth();
  const thresholdScore = rankings.length >= k ? rankings[k - 1]?.score : null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-800 mb-4">即時戰況</h2>

      <div className="mb-4 space-y-2 text-sm">
        {thresholdScore !== null && (
          <div className="flex justify-between">
            <span className="text-gray-600">目前最低得標門檻 Score：</span>
            <span className="font-semibold text-blue-600">{thresholdScore.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-600">目前最高出價：</span>
          <span className="font-semibold text-green-600">$ {currentHighestPrice.toLocaleString()}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-semibold text-gray-700">Rank</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700">User</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-700">Bid Price P</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-700">Reaction Time T</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-700">Weight W</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-700">Score</th>
            </tr>
          </thead>
          <tbody>
            {rankings.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-gray-500">
                  尚無排名資料
                </td>
              </tr>
            ) : (
              rankings.map((item) => {
                const isCurrentUser = user && item.userId === user.id;
                return (
                  <tr
                    key={item.rank}
                    className={`border-b border-gray-100 ${
                      isCurrentUser ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="py-2 px-2 font-medium text-gray-800">
                      {item.rank}
                      {isCurrentUser && <span className="text-blue-600 ml-1">(You)</span>}
                    </td>
                    <td className="py-2 px-2 text-gray-700">{item.displayName}</td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      $ {item.price.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      {item.reactionTime} ms
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">{item.weight}</td>
                    <td className="py-2 px-2 text-right font-semibold text-gray-800">
                      {item.score.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {userRank !== null && userRank > k && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-sm text-gray-700">
            你的暫定排名：第 <span className="font-semibold">{userRank}</span> 名，Score:{' '}
            <span className="font-semibold">{userScore?.toFixed(2) || 'N/A'}</span>（尚未進入前 K 名）
          </p>
        </div>
      )}
    </div>
  );
};

