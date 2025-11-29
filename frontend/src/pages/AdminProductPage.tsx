import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { mockProductService } from '../services/mockProductService';
import type { Product, ProductStatus } from '../types/product';

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AdminProductPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isStatusChange, setIsStatusChange] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    basePrice: 0,
    k: 0,
    startTime: '',
    endTime: '',
    alpha: 1.0,
    beta: 0.5,
    gamma: 0.3,
    status: 'not_started' as ProductStatus,
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = () => {
    setProducts(mockProductService.getAllProducts());
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsCreating(false);
    setIsStatusChange(false);
    setFormData({
      title: product.title,
      description: product.description,
      basePrice: product.basePrice,
      k: product.k,
      startTime: new Date(product.startTime).toISOString().slice(0, 16),
      endTime: new Date(product.endTime).toISOString().slice(0, 16),
      alpha: product.alpha || 1.0,
      beta: product.beta || 0.5,
      gamma: product.gamma || 0.3,
      status: product.status,
    });
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setIsCreating(true);
    setIsStatusChange(false);
    setFormData({
      title: '',
      description: '',
      basePrice: 0,
      k: 0,
      startTime: '',
      endTime: '',
      alpha: 1.0,
      beta: 0.5,
      gamma: 0.3,
      status: 'not_started',
    });
  };

  const handleSave = () => {
    if (isCreating) {
      mockProductService.createProduct({
        title: formData.title,
        description: formData.description,
        basePrice: formData.basePrice,
        k: formData.k,
        startTime: new Date(formData.startTime).getTime(),
        endTime: new Date(formData.endTime).getTime(),
        alpha: formData.alpha,
        beta: formData.beta,
        gamma: formData.gamma,
      });
    } else if (editingProduct) {
      mockProductService.updateProduct(editingProduct.id, {
        title: formData.title,
        description: formData.description,
        basePrice: formData.basePrice,
        k: formData.k,
        startTime: new Date(formData.startTime).getTime(),
        endTime: new Date(formData.endTime).getTime(),
        alpha: formData.alpha,
        beta: formData.beta,
        gamma: formData.gamma,
        status: formData.status,
      });
    }
    loadProducts();
    setEditingProduct(null);
    setIsCreating(false);
    setIsStatusChange(false);
  };

  const handleStatusChange = (product: Product) => {
    // 编辑该商品并更新状态
    setEditingProduct(product);
    setIsCreating(false);
    setIsStatusChange(true);
    let newStatus: ProductStatus;
    if (product.status === 'not_started') {
      newStatus = 'active';
    } else if (product.status === 'active') {
      newStatus = 'ended';
    } else {
      newStatus = 'not_started';
    }
    setFormData({
      title: product.title,
      description: product.description,
      basePrice: product.basePrice,
      k: product.k,
      startTime: new Date(product.startTime).toISOString().slice(0, 16),
      endTime: new Date(product.endTime).toISOString().slice(0, 16),
      alpha: product.alpha || 1.0,
      beta: product.beta || 0.5,
      gamma: product.gamma || 0.3,
      status: newStatus,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">商品管理</h2>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            新增商品
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 商品列表 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        商品名稱
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        狀態
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        起標價
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        K
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {product.title}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {product.status === 'not_started'
                            ? '準備中'
                            : product.status === 'active'
                            ? '競標中'
                            : '已結束'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          $ {product.basePrice.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{product.k}</td>
                        <td className="px-4 py-3 text-sm space-x-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => handleStatusChange(product)}
                            className="text-green-600 hover:text-green-800"
                          >
                            切換狀態
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 表單 */}
          <div className="lg:col-span-1">
            {(isCreating || editingProduct) && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  {isCreating ? '新增商品' : '編輯商品'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      商品名稱
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      商品描述
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      起標價
                    </label>
                    <input
                      type="number"
                      value={formData.basePrice}
                      onChange={(e) =>
                        setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      限量數量 K
                    </label>
                    <input
                      type="number"
                      value={formData.k}
                      onChange={(e) =>
                        setFormData({ ...formData, k: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      開始時間
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      結束時間
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">α</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.alpha}
                      onChange={(e) =>
                        setFormData({ ...formData, alpha: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">β</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.beta}
                      onChange={(e) =>
                        setFormData({ ...formData, beta: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">γ</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.gamma}
                      onChange={(e) =>
                        setFormData({ ...formData, gamma: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  {!isCreating && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        狀態
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value as ProductStatus })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="not_started">準備中</option>
                        <option value="active">競標中</option>
                        <option value="ended">已結束</option>
                      </select>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <button
                      onClick={handleSave}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {isCreating ? '新增商品' : '儲存變更'}
                    </button>
                    {!isCreating && !isStatusChange && (
                      <button
                        onClick={() => {
                          setEditingProduct(null);
                          setIsCreating(false);
                          setIsStatusChange(false);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

