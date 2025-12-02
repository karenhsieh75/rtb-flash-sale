package bidding

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"rtb-backend/internal/database"
	"rtb-backend/internal/websocket"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type Service struct {
	rdb       *redis.Client
	db        *gorm.DB
	bidScript string
	hub       *websocket.Hub
}

func NewService(rdb *redis.Client, db *gorm.DB, hub *websocket.Hub) *Service {
	// 讀取 Lua 腳本
	content, err := os.ReadFile("scripts/place_bid.lua")
	if err != nil {
		panic("無法讀取 Lua 腳本: " + err.Error())
	}
	sha, err := rdb.ScriptLoad(context.Background(), string(content)).Result()
	if err != nil {
		panic("Lua 腳本載入失敗: " + err.Error())
	}
	return &Service{rdb: rdb, db: db, bidScript: sha, hub: hub}
}

// 修改 CalculateScore 讓它接收動態參數
func (s *Service) CalculateScore(price float64, startTime int64, weight, alpha, beta, gamma float64) float64 {
	now := time.Now().UnixMilli()
	t := float64(now - startTime)
	if t < 0 {
		t = 0
	}
	score := (alpha * price) + (beta / (t + 1)) + (gamma * weight)
	return math.Round(score*10000) / 10000
}



// PlaceBid
func (s *Service) PlaceBid(ctx context.Context, productID string, userID string, price float64, userWeight float64) (float64, error) {
	// 1. 從 Redis 讀取商品設定 (Config)
	configKey := fmt.Sprintf("auction:%s:config", productID)
	config, err := s.rdb.HGetAll(ctx, configKey).Result()
	if err != nil {
		return 0, fmt.Errorf("讀取商品設定失敗: %v", err)
	}
	if len(config) == 0 {
		return 0, fmt.Errorf("商品不存在或未設定")
	}

	// 2. 解析參數
	startTime := getInt64(config, "startTime", 0)
	endTime := getInt64(config, "endTime", 0)
	alpha := getFloat(config, "alpha", 1.0)
	beta := getFloat(config, "beta", 0.5)
	gamma := getFloat(config, "gamma", 0.3)

	now := time.Now().UnixMilli()
	
	// 檢查基本時間 (雖然 Lua 也會檢查，但這裡可以先擋掉不必要的運算)
	if now < startTime {
		return 0, fmt.Errorf("活動尚未開始")
	}

	// 3. 計算分數 (帶入 Redis 讀到的參數)
	score := s.CalculateScore(price, startTime, userWeight, alpha, beta, gamma)
	reactionTime := now - startTime

	// Redis Keys
	rankKey := fmt.Sprintf("auction:%s:rank", productID)
	bidsKey := fmt.Sprintf("auction:%s:bids", productID)

	// 組合詳細資訊字串
	details := fmt.Sprintf("%f,%d,%f", price, reactionTime, userWeight)

	// 4. 執行 Lua
	fmt.Printf("[Debug] 正在寫入 Redis Key: %s, User: %s, Score: %f\n", rankKey, userID, score)
	res, err := s.rdb.EvalSha(ctx, s.bidScript, 
        []string{rankKey, bidsKey, configKey}, // KEYS[1], [2], [3]
        userID, score, now, endTime, details, price, // ARGV[1] ~ [6]
    ).Int()
	if err != nil {
		return 0, fmt.Errorf("Redis 執行錯誤: %v", err)
	}
	if res == -1 {
		return 0, fmt.Errorf("活動已結束")
	}

	// 5. 異步寫入 DB
	go func() {
		s.db.Create(&database.BidLog{
			UserID: userID, ProductID: productID, Price: price, Score: score, CreatedAt: time.Now(),
		})
	}()

	// 6. 广播出价通知和排行榜更新
	go func() {
		s.broadcastBidNotification(productID, userID, price, score)
		// 延迟一点再更新排行榜，确保 Redis 数据已更新
		time.Sleep(100 * time.Millisecond)
		s.BroadcastRankingsUpdate(context.Background(), productID)
	}()

	return score, nil
}

// GetRankings: 根據 K 動態回傳
func (s *Service) GetRankings(ctx context.Context, productID string) (*RankingResponse, error) {
	// 1. 讀取 Config (K, HighestPrice)
	configKey := fmt.Sprintf("auction:%s:config", productID)
	vals, err := s.rdb.HMGet(ctx, configKey, "k", "currentHighestPrice").Result()
	if err != nil {
		return nil, err
	}

	k := 5
	if len(vals) > 0 && vals[0] != nil {
		if valStr, ok := vals[0].(string); ok {
			if parsedK, err := strconv.Atoi(valStr); err == nil {
				k = parsedK
			}
		}
	}

	var globalHighestPrice float64 = 0
	if len(vals) > 1 && vals[1] != nil {
		if valStr, ok := vals[1].(string); ok {
			globalHighestPrice, _ = strconv.ParseFloat(valStr, 64)
		}
	}

	// 2. 呼叫共用邏輯
	items, err := s.getRawRankings(ctx, productID, k)
	if err != nil {
		return nil, err
	}

	// 3. 計算門檻
	var threshold float64 = 0
	if len(items) >= k {
		threshold = items[k-1].Score
	} else if len(items) > 0 {
		threshold = items[len(items)-1].Score
	}

	return &RankingResponse{
		Rankings:            items,
		ThresholdScore:      threshold,
		CurrentHighestPrice: globalHighestPrice,
	}, nil
}

// GetResults: 取得最終結果
func (s *Service) GetResults(ctx context.Context, productID string) ([]ResultItem, error) {
	// 1. 檢查狀態
	configKey := fmt.Sprintf("auction:%s:config", productID)
	vals, err := s.rdb.HMGet(ctx, configKey, "status", "k").Result()
	if err != nil {
		return nil, err
	}

	status := "not_started"
	if len(vals) > 0 && vals[0] != nil {
		status = vals[0].(string)
	}

	if status != "ended" {
		return nil, fmt.Errorf("活動尚未結束")
	}

	k := 5
	if len(vals) > 1 && vals[1] != nil {
		if valStr, ok := vals[1].(string); ok {
			if parsedK, err := strconv.Atoi(valStr); err == nil {
				k = parsedK
			}
		}
	}

	// 2. 呼叫共用邏輯
	rankingItems, err := s.getRawRankings(ctx, productID, k)
	if err != nil {
		return nil, err
	}

	// 3. 轉換型別 (RankingItem -> ResultItem)
	results := []ResultItem{}
	for _, item := range rankingItems {
		results = append(results, ResultItem{
			Rank:        item.Rank,
			UserID:      item.UserID,
			DisplayName: item.DisplayName,
			FinalPrice:  item.Price, // 對應欄位
			FinalScore:  item.Score, // 對應欄位
			IsWinner:    true,       // 這裡的邏輯是前 K 名就是贏家
		})
	}

	return results, nil
}

// broadcastBidNotification 广播出价通知
func (s *Service) broadcastBidNotification(productID, userID string, price, score float64) {
	message := websocket.Message{
		Type:      "bid_notification",
		ProductID: productID,
		Data: map[string]interface{}{
			"userId":    userID,
			"price":     price,
			"score":     score,
			"timestamp": time.Now().UnixMilli(),
		},
	}
	data, _ := json.Marshal(message)
	s.hub.BroadcastToProduct(productID, data)
}

// BroadcastRankingsUpdate 广播排行榜更新
func (s *Service) BroadcastRankingsUpdate(ctx context.Context, productID string) {
	rankings, err := s.GetRankings(ctx, productID)
	if err != nil {
		return
	}

	// 获取当前最高价
	configKey := fmt.Sprintf("auction:%s:config", productID)
	currentHighestPrice, _ := s.rdb.HGet(ctx, configKey, "currentHighestPrice").Float64()

	message := websocket.Message{
		Type:      "rankings_update",
		ProductID: productID,
		Data: map[string]interface{}{
			"rankings":            rankings.Rankings,
			"thresholdScore":      rankings.ThresholdScore,
			"currentHighestPrice": currentHighestPrice,
		},
	}
	data, _ := json.Marshal(message)
	s.hub.BroadcastToProduct(productID, data)
}

// BroadcastProductUpdate 广播商品状态更新
func (s *Service) BroadcastProductUpdate(productID string, status string, currentHighestPrice float64) {
	message := websocket.Message{
		Type:      "product_update",
		ProductID: productID,
		Data: map[string]interface{}{
			"id":                  productID,
			"status":              status,
			"currentHighestPrice": currentHighestPrice,
		},
	}
	data, _ := json.Marshal(message)
	s.hub.BroadcastToProduct(productID, data)
}