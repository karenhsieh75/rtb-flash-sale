package product

import (
	"context"
	"fmt"
	"rtb-backend/internal/models"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type Service struct {
	rdb *redis.Client
	db  *gorm.DB
}

func NewService(rdb *redis.Client, db *gorm.DB) *Service {
	return &Service{rdb: rdb, db: db}
}

func (s *Service) fillCurrentPrice(ctx context.Context, p *models.Product) {
    redisKey := fmt.Sprintf("auction:%s:config", p.ID)
    // 從 Redis 讀取
    val, err := s.rdb.HGet(ctx, redisKey, "currentHighestPrice").Float64()
    if err == nil {
        p.CurrentHighestPrice = val
    } else {
        // 如果 Redis 讀不到 (可能過期或資料遺失)，就回傳底價
        p.CurrentHighestPrice = p.BasePrice
    }
}

func (s *Service) checkAndUpdateStatus(ctx context.Context, p *models.Product) {
	now := time.Now().UnixMilli()
	var newStatus models.ProductStatus

	// 1. 依據時間判斷正確狀態
	if now < p.StartTime {
		newStatus = models.StatusNotStarted
	} else if now >= p.StartTime && now <= p.EndTime {
		newStatus = models.StatusActive
	} else {
		newStatus = models.StatusEnded
	}

	// 2. 如果狀態變了，就更新 DB 和 Redis (Lazy Update)
	if p.Status != newStatus {
		p.Status = newStatus
		
		// 更新 DB
		s.db.Model(p).Update("status", newStatus)
		
		// 更新 Redis
		redisKey := fmt.Sprintf("auction:%s:config", p.ID)
		s.rdb.HSet(ctx, redisKey, "status", string(newStatus))
	}
}

// CreateProduct 建立商品：同時寫入 DB 與 Redis
func (s *Service) CreateProduct(ctx context.Context, p *models.Product) error {
	// 1. 產生 ID (簡單用 timestamp)
	if p.ID == "" {
		p.ID = fmt.Sprintf("prod_%d", time.Now().UnixNano())
	}
	// 預設狀態
	if p.Status == "" {
		p.Status = models.StatusNotStarted
	}

	// 2. 寫入 PostgreSQL
	if err := s.db.Create(p).Error; err != nil {
		return err
	}

	// 3. 寫入 Redis
	// Key: auction:{id}:config
	// 傳入 Lua 腳本需要的參數
	redisKey := fmt.Sprintf("auction:%s:config", p.ID)
	err := s.rdb.HSet(ctx, redisKey, map[string]interface{}{
		"startTime": p.StartTime,
		"endTime":   p.EndTime,
		"basePrice": p.BasePrice,
		"k":         p.K,
		"alpha":     p.Alpha,
		"beta":      p.Beta,
		"gamma":     p.Gamma,
		"status":    string(p.Status),
		"currentHighestPrice": p.BasePrice,
	}).Err()

	return err
}

// GetProduct 取得單一商品詳情
func (s *Service) GetProduct(ctx context.Context, id string) (*models.Product, error) {
    var p models.Product
    if err := s.db.Where("id = ?", id).First(&p).Error; err != nil {
        return nil, err
    }
    
	s.checkAndUpdateStatus(ctx, &p)
    s.fillCurrentPrice(ctx, &p)
	
    return &p, nil
}

// ListProducts 取得所有商品
func (s *Service) ListProducts(ctx context.Context) ([]models.Product, error) { // 注意：這裡要加 ctx 參數
    var products []models.Product
    if err := s.db.Order("created_at desc").Find(&products).Error; err != nil {
        return nil, err
    }

    // 逐一填入最高價
    for i := range products {
		s.checkAndUpdateStatus(ctx, &products[i])
        s.fillCurrentPrice(ctx, &products[i])
    }
    return products, nil
}

// UpdateStatus 更新狀態 (需同步 Redis)
func (s *Service) UpdateStatus(ctx context.Context, id string, status models.ProductStatus) error {
	// 1. 更新 DB
	if err := s.db.Model(&models.Product{}).Where("id = ?", id).Update("status", status).Error; err != nil {
		return err
	}

	// 2. 更新 Redis
	redisKey := fmt.Sprintf("auction:%s:config", id)
	return s.rdb.HSet(ctx, redisKey, "status", string(status)).Err()
}