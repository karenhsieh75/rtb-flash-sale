package bidding

import (
	"context"
	"fmt"
	"math"
	"os"
	"rtb-backend/internal/database"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type Service struct {
	rdb       *redis.Client
	db        *gorm.DB
	bidScript string
}

func NewService(rdb *redis.Client, db *gorm.DB) *Service {
	// 讀取 Lua 腳本
	content, err := os.ReadFile("scripts/place_bid.lua")
	if err != nil {
		panic("無法讀取 Lua 腳本: " + err.Error())
	}
	sha, err := rdb.ScriptLoad(context.Background(), string(content)).Result()
	if err != nil {
		panic("Lua 腳本載入失敗: " + err.Error())
	}
	return &Service{rdb: rdb, db: db, bidScript: sha}
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

// 輔助函式：從 Map 讀取 float64
func getFloat(m map[string]string, key string, defaultVal float64) float64 {
	if val, ok := m[key]; ok {
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		}
	}
	return defaultVal
}

// 輔助函式：從 Map 讀取 int64
func getInt64(m map[string]string, key string, defaultVal int64) int64 {
	if val, ok := m[key]; ok {
		if i, err := strconv.ParseInt(val, 10, 64); err == nil {
			return i
		}
	}
	return defaultVal
}

// 輔助函式：從 Map 讀取 int
func getInt(m map[string]string, key string, defaultVal int) int {
	if val, ok := m[key]; ok {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
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

	return score, nil
}

// GetRankings: 根據 K 動態回傳
func (s *Service) GetRankings(ctx context.Context, productID string) (*RankingResponse, error) {
	// 1. 先讀取 Config 拿到 K
	configKey := fmt.Sprintf("auction:%s:config", productID)
	// 我們只需要 K，用 HMGet 比較省
	vals, err := s.rdb.HMGet(ctx, configKey, "k", "currentHighestPrice").Result()
    if err != nil {
        return nil, err
    }
	
	// 解析 K
    k := 5
    if len(vals) > 0 && vals[0] != nil {
        if valStr, ok := vals[0].(string); ok {
            if parsedK, err := strconv.Atoi(valStr); err == nil {
                k = parsedK
            }
        }
    }

    // 解析 HighestPrice
    var globalHighestPrice float64 = 0
    if len(vals) > 1 && vals[1] != nil {
        if valStr, ok := vals[1].(string); ok {
            globalHighestPrice, _ = strconv.ParseFloat(valStr, 64)
        }
    }

	rankKey := fmt.Sprintf("auction:%s:rank", productID)
	bidsKey := fmt.Sprintf("auction:%s:bids", productID)

	// 2. 讀取 Top K (Redis index 是 0 到 k-1)
	// ZRevRangeWithScores: 分數由高到低
	zlist, err := s.rdb.ZRevRangeWithScores(ctx, rankKey, 0, int64(k-1)).Result()
	if err != nil {
		return nil, err
	}

	items := []RankingItem{}

	for i, z := range zlist {
		userID := z.Member.(string)
		score := z.Score

		// 讀取詳細資訊
		detailsStr, _ := s.rdb.HGet(ctx, bidsKey, userID).Result()
		
		var price, weight float64
		var rTime int64
		
		parts := strings.Split(detailsStr, ",")
		if len(parts) >= 3 {
			price, _ = strconv.ParseFloat(parts[0], 64)
			rTime, _ = strconv.ParseInt(parts[1], 10, 64)
			weight, _ = strconv.ParseFloat(parts[2], 64)
		}

		display := "User_***"
		if len(userID) > 4 {
			display += userID[len(userID)-4:]
		} else {
			display += userID
		}

		items = append(items, RankingItem{
			Rank:         i + 1,
			UserID:       userID,
			DisplayName:  display,
			Price:        price,
			ReactionTime: rTime,
			Weight:       weight,
			Score:        score,
		})
	}

	// 3. 計算動態門檻分數 (第 K 名的分數)
	// 因為我們只撈了 Top K，所以如果滿了，最後一名就是門檻
	var threshold float64 = 0
	if len(items) >= k {
		threshold = items[k-1].Score
	} else if len(items) > 0 {
		// 如果還沒滿 K 人，門檻設最後一名
		threshold = items[len(items)-1].Score
	}

	return &RankingResponse{
		Rankings:            items,
		ThresholdScore:      threshold,
		CurrentHighestPrice: globalHighestPrice,
	}, nil
}