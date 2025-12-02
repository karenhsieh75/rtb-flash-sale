import { productAPI, biddingAPI } from './api';
import type { Product, ProductResult } from '../types/product';
import type { RankingItem } from '../components/RankingTable';

class ProductService {
  // 获取所有商品
  async getAllProducts(): Promise<Product[]> {
    return productAPI.getAllProducts();
  }

  // 获取单个商品
  async getProductById(id: string): Promise<Product> {
    return productAPI.getProductById(id);
  }

  // 获取排行榜
  async getProductRankings(productId: string): Promise<RankingItem[]> {
    const data = await biddingAPI.getRankings(productId);
    return data.rankings;
  }

  // 获取结果
  async getProductResults(productId: string): Promise<ProductResult[]> {
    return biddingAPI.getResults(productId);
  }

  // 创建商品（管理员）
  async createProduct(product: {
    title: string;
    description: string;
    basePrice: number;
    k: number;
    startTime: number;
    endTime: number;
    alpha: number;
    beta: number;
    gamma: number;
  }): Promise<Product> {
    return productAPI.createProduct(product);
  }

  // 更新商品（管理员）
  async updateProduct(
    id: string,
    updates: {
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
    }
  ): Promise<Product> {
    return productAPI.updateProduct(id, updates);
  }

  // 更新商品状态（管理员）
  async updateProductStatus(
    id: string,
    status: 'not_started' | 'active' | 'ended'
  ): Promise<void> {
    await productAPI.updateProductStatus(id, status);
  }

  // 提交出价
  async placeBid(productId: string, price: number): Promise<void> {
    await biddingAPI.placeBid(productId, price);
  }
}

export const productService = new ProductService();

