package websocket

import (
	"log"
	"sync"
)

// Hub 管理所有 WebSocket 连接
type Hub struct {
	// 订阅特定商品的客户端
	productSubscribers map[string]map[*Client]bool

	// 广播消息到所有客户端
	broadcast chan []byte

	// 注册新客户端
	register chan *Client

	// 注销客户端
	unregister chan *Client

	// 互斥锁保护并发访问
	mu sync.RWMutex
}

// NewHub 创建新的 Hub
func NewHub() *Hub {
	return &Hub{
		productSubscribers: make(map[string]map[*Client]bool),
		broadcast:          make(chan []byte),
		register:           make(chan *Client),
		unregister:         make(chan *Client),
	}
}

// Run 启动 Hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if h.productSubscribers[client.productID] == nil {
				h.productSubscribers[client.productID] = make(map[*Client]bool)
			}
			h.productSubscribers[client.productID][client] = true
			h.mu.Unlock()
			log.Printf("客户端已连接: productID=%s, total=%d", client.productID, len(h.productSubscribers[client.productID]))

		case client := <-h.unregister:
			h.mu.Lock()
			if subscribers, ok := h.productSubscribers[client.productID]; ok {
				if _, ok := subscribers[client]; ok {
					delete(subscribers, client)
					close(client.send)
					if len(subscribers) == 0 {
						delete(h.productSubscribers, client.productID)
					}
				}
			}
			h.mu.Unlock()
			log.Printf("客户端已断开: productID=%s", client.productID)

		case message := <-h.broadcast:
			// 广播到所有客户端（如果需要）
			h.mu.RLock()
			for _, subscribers := range h.productSubscribers {
				for client := range subscribers {
					select {
					case client.send <- message:
					default:
						close(client.send)
						delete(subscribers, client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastToProduct 向特定商品的所有订阅者广播消息
func (h *Hub) BroadcastToProduct(productID string, message []byte) {
	h.mu.RLock()
	subscribers, ok := h.productSubscribers[productID]
	h.mu.RUnlock()

	if !ok {
		return
	}

	for client := range subscribers {
		select {
		case client.send <- message:
		default:
			close(client.send)
			h.mu.Lock()
			delete(subscribers, client)
			if len(subscribers) == 0 {
				delete(h.productSubscribers, productID)
			}
			h.mu.Unlock()
		}
	}
}

