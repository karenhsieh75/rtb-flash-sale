import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';
import { ProductLobbyPage } from './pages/ProductLobbyPage';
import { AuctionDetailPage } from './pages/AuctionDetailPage';
import { AdminProductPage } from './pages/AdminProductPage';
import { ProtectedRoute } from './components/ProtectedRoute';

const AppContent = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/products" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/products" replace /> : <RegisterPage />}
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <ProductLobbyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/auction/:productId"
        element={
          <ProtectedRoute>
            <AuctionDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/products"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminProductPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={user ? '/products' : '/login'} replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
