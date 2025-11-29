import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  showBackButton?: boolean;
  backTo?: string;
}

export const Header = ({ showBackButton = false, backTo = '/products' }: HeaderProps) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            {showBackButton && (
              <Link
                to={backTo}
                className="text-gray-600 hover:text-gray-800 px-3 py-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                ← 返回商品列表
              </Link>
            )}
            <h1 className="text-xl font-bold text-gray-800">即時競標系統</h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span>Hi, {user.username}</span>
            </div>

            {user.role === 'admin' && (
              <Link
                to="/admin/products"
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
              >
                管理介面
              </Link>
            )}

            <button
              onClick={logout}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

