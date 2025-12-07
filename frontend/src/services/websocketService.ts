const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

export type WSStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface WSMessage {
  type: 'product_update' | 'rankings_update' | 'bid_notification' | 'activity_status_change';
  productId?: string;
  data?: any;
}

type MessageCallback = (message: WSMessage) => void;
type StatusCallback = (status: WSStatus) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private productId: string | null = null;
  private messageCallback: MessageCallback | null = null;
  private statusCallback: StatusCallback | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: WSStatus = 'disconnected';

  constructor() {
    // 从 localStorage 获取 token
    this.updateToken();
  }

  private updateToken() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.token = user.token || null;
      } catch {
        this.token = null;
      }
    } else {
      this.token = null;
    }
  }

  connect(productId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.productId === productId) {
      // 已经连接到相同的商品
      return;
    }

    this.disconnect();
    this.productId = productId;
    this.updateToken();

    if (!this.token) {
      console.error('WebSocket: 没有 token，无法连接');
      this.setStatus('error');
      return;
    }

    this.setStatus('connecting');
    this.reconnectAttempts = 0;

    try {
      const wsUrl = `${WS_BASE_URL}/ws?token=${encodeURIComponent(this.token)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket 连接成功');
        this.setStatus('connected');
        this.reconnectAttempts = 0;

        // 订阅商品更新
        this.subscribe(productId);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('WebSocket 消息解析失败:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        this.setStatus('error');
      };

      this.ws.onclose = () => {
        console.log('WebSocket 连接关闭');
        this.setStatus('disconnected');
        this.ws = null;

        // 尝试重连
        if (this.productId && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`WebSocket 将在 ${delay}ms 后重连 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          this.reconnectTimer = setTimeout(() => {
            if (this.productId) {
              this.connect(this.productId);
            }
          }, delay);
        }
      };
    } catch (err) {
      console.error('WebSocket 连接失败:', err);
      this.setStatus('error');
    }
  }

  private subscribe(productId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // 订阅商品更新
    this.ws.send(
      JSON.stringify({
        type: 'subscribe',
        productId: productId,
      })
    );

    // 订阅排行榜更新
    this.ws.send(
      JSON.stringify({
        type: 'subscribe_rankings',
        productId: productId,
      })
    );
  }

  private handleMessage(message: WSMessage) {
    if (this.messageCallback) {
      this.messageCallback(message);
    }
  }

  private setStatus(status: WSStatus) {
    if (this.status !== status) {
      this.status = status;
      if (this.statusCallback) {
        this.statusCallback(status);
      }
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.productId = null;
    this.setStatus('disconnected');
  }

  onMessage(callback: MessageCallback) {
    this.messageCallback = callback;
  }

  onStatusChange(callback: StatusCallback) {
    this.statusCallback = callback;
  }

  getStatus(): WSStatus {
    return this.status;
  }
}

export const websocketService = new WebSocketService();

