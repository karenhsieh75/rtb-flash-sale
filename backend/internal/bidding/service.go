package bidding

import (
	"context"
	"fmt"
	"math"
	"os"
	"rtb-backend/internal/database"
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

	// 載入腳本至 Redis
	sha, err := rdb.ScriptLoad(context.Background(), string(content)).Result()
	if err != nil {
		panic("Lua 腳本載入失敗: " + err.Error())
	}

	return &Service{
		rdb:       rdb,
		db:        db,
		bidScript: sha,
	}
}

// CalculateScore 計算排名積分
func (s *Service) CalculateScore(price float64, startTime int64, weight float64) float64 {
	alpha := 1.0
	beta := 0.5
	gamma := 0.3

	now := time.Now().UnixMilli()
	t := float64(now - startTime)
	if t < 0 {
		t = 0
	}

	score := (alpha * price) + (beta / (t + 1)) + (gamma * weight)
	return math.Round(score*10000) / 10000
}

// PlaceBid 處理出價請求
func (s *Service) PlaceBid(ctx context.Context, productID string, userID string, price float64, userWeight float64) (float64, error) {
	
	// 設定活動時間 (測試用：目前時間減 1 分鐘開始，持續 10 分鐘)
	startTime := time.Now().UnixMilli() - 60000
	endTime := startTime + (10 * 60 * 1000)
	now := time.Now().UnixMilli()

	score := s.CalculateScore(price, startTime, userWeight)
	redisKey := fmt.Sprintf("auction:%s:rank", productID)

	// 執行 Lua 腳本確保原子性
	res, err := s.rdb.EvalSha(ctx, s.bidScript, []string{redisKey}, userID, score, now, endTime).Int()
	if err != nil {
		return 0, fmt.Errorf("Redis 執行錯誤: %v", err)
	}
	if res == -1 {
		return 0, fmt.Errorf("活動已結束")
	}

	// 非同步寫入 PostgreSQL
	go func() {
		log := database.BidLog{
			UserID:    userID,
			ProductID: productID,
			Price:     price,
			Score:     score,
			CreatedAt: time.Now(),
		}
		if err := s.db.Create(&log).Error; err != nil {
			fmt.Printf("DB 寫入失敗: %v\n", err)
		} else {
			fmt.Printf("DB 寫入成功: User=%s Price=%.2f\n", userID, price)
		}
	}()

	return score, nil
}