import type { Product, ProductStatus, ProductResult } from '../types/product';
import type { RankingItem } from '../components/RankingTable';

class MockProductService {
  private products: Product[] = [];
  private productResults: Map<string, ProductResult[]> = new Map();
  private productRankings: Map<string, RankingItem[]> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const twoHours = 2 * 60 * 60 * 1000;

    // 创建一些假商品
    this.products = [
      {
        id: '1',
        title: '限量藍芽耳機',
        description: '高品質無線藍芽耳機，降噪功能強大',
        basePrice: 1000,
        k: 5,
        startTime: now - oneHour, // 已开始
        endTime: now + oneHour,
        status: 'active',
        currentHighestPrice: 1200,
        alpha: 1.0,
        beta: 0.5,
        gamma: 0.3,
      },
      {
        id: '2',
        title: '智能手錶',
        description: '多功能智能手錶，健康監測',
        basePrice: 2000,
        k: 3,
        startTime: now + oneHour, // 未开始
        endTime: now + twoHours,
        status: 'not_started',
        currentHighestPrice: 2000,
        alpha: 1.0,
        beta: 0.5,
        gamma: 0.3,
      },
      {
        id: '3',
        title: '無線充電器',
        description: '快速無線充電，支援多設備',
        basePrice: 500,
        k: 10,
        startTime: now - twoHours, // 已结束
        endTime: now - oneHour,
        status: 'ended',
        currentHighestPrice: 800,
        alpha: 1.0,
        beta: 0.5,
        gamma: 0.3,
      },
    ];

    // 初始化每个商品的排名数据
    this.products.forEach((product) => {
      this.productRankings.set(product.id, this.generateMockRankings(product.id, product.k));
      if (product.status === 'ended') {
        this.productResults.set(product.id, this.generateMockResults(product.id, product.k));
      }
    });

    // 定期更新商品状态和排名
    setInterval(() => {
      this.updateProductStatuses();
      this.updateRankings();
    }, 2000);
  }

  private generateMockRankings(productId: string, k: number): RankingItem[] {
    const rankings: RankingItem[] = [];
    const basePrice = this.products.find((p) => p.id === productId)?.basePrice || 1000;
    
    for (let i = 0; i < k; i++) {
      const price = basePrice + (k - i) * 50;
      const reactionTime = 100 + i * 20;
      const weight = 1.0 + i * 0.1;
      const score = price * weight - reactionTime;
      
      rankings.push({
        rank: i + 1,
        userId: `user_${productId}_${i + 1}`,
        displayName: `User_***${String(i + 1).padStart(4, '0')}`,
        price,
        reactionTime,
        weight,
        score,
      });
    }
    return rankings;
  }

  private generateMockResults(productId: string, k: number): ProductResult[] {
    const results: ProductResult[] = [];
    const basePrice = this.products.find((p) => p.id === productId)?.basePrice || 1000;
    
    for (let i = 0; i < k; i++) {
      const finalPrice = basePrice + (k - i) * 50;
      const finalScore = finalPrice * (1.0 + i * 0.1) - (100 + i * 20);
      
      results.push({
        rank: i + 1,
        userId: `user_${productId}_${i + 1}`,
        displayName: `User_***${String(i + 1).padStart(4, '0')}`,
        finalPrice,
        finalScore,
        isWinner: true,
      });
    }
    return results;
  }

  private updateProductStatuses() {
    const now = Date.now();
    this.products.forEach((product) => {
      if (product.status === 'not_started' && now >= product.startTime) {
        product.status = 'active';
      } else if (product.status === 'active' && now >= product.endTime) {
        product.status = 'ended';
        if (!this.productResults.has(product.id)) {
          this.productResults.set(product.id, this.generateMockResults(product.id, product.k));
        }
      }
    });
  }

  private updateRankings() {
    // 随机更新排名数据
    this.products.forEach((product) => {
      if (product.status === 'active' && Math.random() > 0.7) {
        const rankings = this.productRankings.get(product.id);
        if (rankings) {
          // 随机更新价格
          const updatedRankings = rankings.map((r) => ({
            ...r,
            price: r.price + Math.floor(Math.random() * 50),
          }));
          updatedRankings.sort((a, b) => b.score - a.score);
          updatedRankings.forEach((r, i) => {
            r.rank = i + 1;
            r.score = r.price * r.weight - r.reactionTime;
          });
          this.productRankings.set(product.id, updatedRankings);
          
          // 更新最高价
          const highestPrice = Math.max(...updatedRankings.map((r) => r.price));
          product.currentHighestPrice = highestPrice;
        }
      }
    });
  }

  getAllProducts(): Product[] {
    return [...this.products];
  }

  getProductById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  getProductRankings(productId: string): RankingItem[] {
    return this.productRankings.get(productId) || [];
  }

  getProductResults(productId: string): ProductResult[] {
    return this.productResults.get(productId) || [];
  }

  createProduct(product: Omit<Product, 'id' | 'status' | 'currentHighestPrice'>): Product {
    const now = Date.now();
    const newProduct: Product = {
      ...product,
      id: `product_${Date.now()}`,
      status: now >= product.startTime ? (now >= product.endTime ? 'ended' : 'active') : 'not_started',
      currentHighestPrice: product.basePrice,
    };
    
    this.products.push(newProduct);
    this.productRankings.set(newProduct.id, this.generateMockRankings(newProduct.id, newProduct.k));
    
    return newProduct;
  }

  updateProduct(id: string, updates: Partial<Product>): Product | null {
    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) return null;
    
    this.products[index] = { ...this.products[index], ...updates };
    return this.products[index];
  }

  updateProductStatus(id: string, status: ProductStatus): Product | null {
    return this.updateProduct(id, { status });
  }

  // 模拟出价
  async placeBid(productId: string, userId: string, price: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const product = this.getProductById(productId);
    if (!product) {
      throw new Error('商品不存在');
    }
    
    if (product.status !== 'active') {
      throw new Error('活動尚未開始或已結束');
    }
    
    if (price < product.basePrice) {
      throw new Error('出價需高於起標價');
    }
    
    // 更新最高价
    if (price > product.currentHighestPrice) {
      product.currentHighestPrice = price;
    }
    
    // 更新排名（简化处理）
    const rankings = this.getProductRankings(productId);
    const userRanking = rankings.find((r) => r.userId === userId);
    
    if (userRanking) {
      userRanking.price = price;
      userRanking.score = price * userRanking.weight - userRanking.reactionTime;
    } else {
      // 添加新用户到排名
      const weight = 1.2; // 默认权重
      const reactionTime = Math.floor(Math.random() * 200) + 100;
      const score = price * weight - reactionTime;
      
      rankings.push({
        rank: rankings.length + 1,
        userId,
        displayName: `User_***${userId.slice(-4)}`,
        price,
        reactionTime,
        weight,
        score,
      });
    }
    
    // 重新排序
    rankings.sort((a, b) => b.score - a.score);
    rankings.forEach((r, i) => {
      r.rank = i + 1;
    });
    
    // 只保留前 K 名
    const topK = rankings.slice(0, product.k);
    this.productRankings.set(productId, topK);
  }
}

export const mockProductService = new MockProductService();

