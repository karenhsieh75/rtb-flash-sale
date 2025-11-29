import type { RankingItem } from '../components/RankingTable';

export type ActivityStatus = 'not_started' | 'active' | 'ended';
export type WSStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface AuctionData {
  productName: string;
  basePrice: number;
  currentHighestPrice: number;
  k: number;
  endTime: number | null;
  activityStatus: ActivityStatus;
  rankings: RankingItem[];
}

type UpdateCallback = (data: AuctionData) => void;
type StatusCallback = (status: WSStatus) => void;

class MockWebSocketService {
  private updateCallback: UpdateCallback | null = null;
  private statusCallback: StatusCallback | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private status: WSStatus = 'disconnected';
  private currentData: AuctionData;
  private userId: string | null = null;

  constructor() {
    // 初始化假資料
    const now = Date.now();
    this.currentData = {
      productName: '限量藍芽耳機',
      basePrice: 1000,
      currentHighestPrice: 1200,
      k: 5,
      endTime: now + 5 * 60 * 1000, // 5 分鐘後結束
      activityStatus: 'active',
      rankings: this.generateMockRankings(),
    };
  }

  private generateMockRankings(): RankingItem[] {
    const rankings: RankingItem[] = [];
    for (let i = 0; i < 5; i++) {
      const price = 1200 - i * 50;
      const reactionTime = 100 + i * 20;
      const weight = 1.0 + i * 0.1;
      const score = price * weight - reactionTime;
      
      rankings.push({
        rank: i + 1,
        userId: `user_${i + 1}`,
        displayName: `User_***${String(i + 1).padStart(4, '0')}`,
        price,
        reactionTime,
        weight,
        score,
      });
    }
    return rankings;
  }

  connect(userId: string) {
    this.userId = userId;
    this.status = 'connected';
    this.statusCallback?.(this.status);
    
    // 模擬 WebSocket 連接成功後立即推送一次資料
    this.updateCallback?.(this.currentData);

    // 模擬定期更新資料
    this.intervalId = setInterval(() => {
      // 隨機更新最高出價和排名
      const priceChange = Math.random() > 0.7 ? Math.floor(Math.random() * 100) : 0;
      if (priceChange > 0) {
        this.currentData.currentHighestPrice += priceChange;
        // 更新排名（簡化版，實際應該由後端計算）
        this.currentData.rankings = this.generateMockRankings();
      }

      // 檢查活動狀態
      const now = Date.now();
      if (this.currentData.endTime && now >= this.currentData.endTime) {
        this.currentData.activityStatus = 'ended';
        this.currentData.endTime = null;
      }

      this.updateCallback?.(this.currentData);
    }, 2000); // 每 2 秒更新一次

    // 模擬偶爾斷線重連
    setTimeout(() => {
      if (Math.random() > 0.7) {
        this.simulateReconnect();
      }
    }, 10000);
  }

  private simulateReconnect() {
    this.status = 'reconnecting';
    this.statusCallback?.(this.status);

    this.reconnectTimeoutId = setTimeout(() => {
      this.status = 'connected';
      this.statusCallback?.(this.status);
    }, 2000);
  }

  disconnect() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.status = 'disconnected';
    this.statusCallback?.(this.status);
  }

  onUpdate(callback: UpdateCallback) {
    this.updateCallback = callback;
  }

  onStatusChange(callback: StatusCallback) {
    this.statusCallback = callback;
  }

  // 模擬送出出價
  async placeBid(price: number): Promise<void> {
    // 模擬 API 延遲
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (this.currentData.activityStatus !== 'active') {
      throw new Error('活動尚未開始或已結束');
    }

    if (price < this.currentData.basePrice) {
      throw new Error('出價需高於起標價');
    }

    // 更新最高出價
    if (price > this.currentData.currentHighestPrice) {
      this.currentData.currentHighestPrice = price;
    }

    // 模擬更新排名（實際應該由後端計算）
    // 這裡簡化處理，只是重新生成排名
    this.currentData.rankings = this.generateMockRankings();

    // 觸發更新
    this.updateCallback?.(this.currentData);
  }

  getCurrentData(): AuctionData {
    return { ...this.currentData };
  }
}

export const mockWebSocket = new MockWebSocketService();

