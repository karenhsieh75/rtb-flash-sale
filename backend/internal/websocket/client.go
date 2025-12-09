package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

var jwtSecret = []byte("your_secret_key_change_in_production")

const (
	// 允许客户端写入的时间
	writeWait = 10 * time.Second

	// 允许客户端读取的时间
	pongWait = 60 * time.Second

	// 发送 ping 的间隔
	pingPeriod = (pongWait * 9) / 10

	// 最大消息大小
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // 允許所有來源連線 (解決 403 錯誤)
	},
}

// Client 代表一个 WebSocket 连接
type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	userID   string
	username string
	productID string
}

// Message 定义 WebSocket 消息格式
type Message struct {
	Type      string      `json:"type"`
	ProductID string      `json:"productId,omitempty"`
	Data      interface{} `json:"data,omitempty"`
}

// readPump 从 WebSocket 连接读取消息
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket 错误: %v", err)
			}
			break
		}

		// 解析消息
		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("解析消息失败: %v", err)
			continue
		}

		// 处理订阅消息
		if msg.Type == "subscribe" || msg.Type == "subscribe_rankings" {
			if msg.ProductID != "" {
				// 更新订阅的商品 ID
				c.hub.mu.Lock()
				// 从旧的订阅中移除
				if oldSubscribers, ok := c.hub.productSubscribers[c.productID]; ok {
					delete(oldSubscribers, c)
					if len(oldSubscribers) == 0 {
						delete(c.hub.productSubscribers, c.productID)
					}
				}
				// 添加到新的订阅
				c.productID = msg.ProductID
				if c.hub.productSubscribers[c.productID] == nil {
					c.hub.productSubscribers[c.productID] = make(map[*Client]bool)
				}
				c.hub.productSubscribers[c.productID][c] = true
				c.hub.mu.Unlock()
				log.Printf("客户端订阅商品: userID=%s, productID=%s", c.userID, c.productID)
			}
		}
	}
}

// writePump 向 WebSocket 连接写入消息
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// 批量发送队列中的消息
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// serveWS 处理 WebSocket 连接请求
func ServeWS(hub *Hub, c *gin.Context) {
	// 从查询参数获取 token
	tokenStr := c.Query("token")
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "需要 token"})
		return
	}

	// 验证 JWT token
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的 token"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的 token claims"})
		return
	}

	// sub 可能是 float64 (数字) 或 string，需要安全转换
	var userID string
	switch v := claims["sub"].(type) {
	case float64:
		userID = fmt.Sprintf("%.0f", v)
	case string:
		userID = v
	default:
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的 user ID"})
		return
	}

	username, ok := claims["username"].(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的 username"})
		return
	}

	// 升级 HTTP 连接为 WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket 升级失败: %v", err)
		return
	}

	client := &Client{
		hub:      hub,
		conn:     conn,
		send:     make(chan []byte, 256),
		userID:   userID,
		username: username,
		productID: "",
	}

	client.hub.register <- client

	// 启动读写 goroutine
	go client.writePump()
	go client.readPump()
}

