const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// 获取 token
const getToken = (): string | null => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.token || null;
    } catch {
      return null;
    }
  }
  return null;
};

// 通用 API 请求函数
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// 认证相关 API
export const authAPI = {
  // 注册
  register: async (username: string, password: string, role: 'member' | 'admin') => {
    return apiRequest<{ message: string; userId: string; weight: number }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
      }
    );
  },

  // 登录
  login: async (username: string, password: string) => {
    return apiRequest<{
      token: string;
      user: {
        id: string;
        username: string;
        weight: number;
        role: 'member' | 'admin';
      };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
};

// 商品相关 API
export const productAPI = {
  // 获取所有商品
  getAllProducts: async () => {
    const data = await apiRequest<{ products: any[] }>('/products');
    return data.products;
  },

  // 获取单个商品
  getProductById: async (id: string) => {
    return apiRequest<any>(`/products/${id}`);
  },

  // 创建商品（管理员）
  createProduct: async (product: {
    title: string;
    description: string;
    basePrice: number;
    k: number;
    startTime: number;
    endTime: number;
    alpha: number;
    beta: number;
    gamma: number;
  }) => {
    return apiRequest<any>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  },

  // 更新商品（管理员）
  updateProduct: async (id: string, product: {
    title: string;
    description: string;
    basePrice: number;
    k: number;
    startTime: number;
    endTime: number;
    alpha: number;
    beta: number;
    gamma: number;
    status?: string;
  }) => {
    return apiRequest<any>(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
  },

  // 更新商品状态（管理员）
  updateProductStatus: async (id: string, status: 'not_started' | 'active' | 'ended') => {
    return apiRequest<{ id: string; status: string }>(`/admin/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

// 竞标相关 API
export const biddingAPI = {
  // 提交出价
  placeBid: async (productId: string, price: number) => {
    return apiRequest<{
      message: string;
      bid: {
        id: string;
        productId: string;
        userId: string;
        price: number;
        timestamp: number;
        score: number;
      };
    }>(`/products/${productId}/bids`, {
      method: 'POST',
      body: JSON.stringify({ price }),
    });
  },

  // 获取排行榜
  getRankings: async (productId: string) => {
    return apiRequest<{
      rankings: any[];
      thresholdScore: number;
      currentHighestPrice: number;
    }>(`/products/${productId}/rankings`);
  },

  // 获取结果
  getResults: async (productId: string) => {
    const data = await apiRequest<{ results: any[] }>(`/products/${productId}/results`);
    return data.results;
  },
};

