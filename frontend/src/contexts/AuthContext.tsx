import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type UserRole = 'member' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  weight: number;
  token: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    // 从 localStorage 恢复登录状态
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = async (username: string, password: string, role: UserRole) => {
    // 模拟 API 调用
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Mock 登录逻辑
    if (username && password) {
      const mockUser: User = {
        id: `user_${Date.now()}`,
        username,
        email: `${username}@example.com`,
        weight: role === 'admin' ? 1.5 : 1.2, // 管理员权重更高
        token: `mock_token_${Date.now()}`,
        role,
      };
      
      setUser(mockUser);
      localStorage.setItem('user', JSON.stringify(mockUser));
    } else {
      throw new Error('帳號或密碼錯誤');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

