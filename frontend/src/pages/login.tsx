import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../contexts/AuthContext';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password, role);
      // 登录成功后会通过 AuthContext 更新状态，路由会自动跳转
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
            即時競標系統登入
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                選擇角色
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => !loading && setRole('member')}
                  disabled={loading}
                  className={`px-4 py-3 rounded-md border-2 transition-all ${
                    role === 'member'
                      ? 'bg-gray-200 border-gray-400 text-gray-900 font-semibold'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => !loading && setRole('admin')}
                  disabled={loading}
                  className={`px-4 py-3 rounded-md border-2 transition-all ${
                    role === 'admin'
                      ? 'bg-gray-200 border-gray-400 text-gray-900 font-semibold'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Admin
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="請輸入 Username"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="請輸入密碼"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '登入中...' : '登入'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

