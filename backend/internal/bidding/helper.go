package bidding

import (
	"context"
	"fmt"
	"rtb-backend/internal/models"
	"strconv"
	"strings"
)

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

// 輔助函式：只負責去 Redis 撈資料並組裝成 RankingItem
func (s *Service) getRawRankings(ctx context.Context, productID string, k int) ([]RankingItem, error) {
	rankKey := fmt.Sprintf("auction:%s:rank", productID)
	bidsKey := fmt.Sprintf("auction:%s:bids", productID)

	// 撈取前 K 名
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

		// 從資料庫查詢使用者名稱
		var user models.User
		display := "User_" + userID // 預設值
		if userIDInt, err := strconv.ParseUint(userID, 10, 32); err == nil {
			if err := s.db.First(&user, uint(userIDInt)).Error; err == nil {
				display = user.Username
			}
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
	return items, nil
}