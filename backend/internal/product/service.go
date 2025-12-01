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

	// 3. 寫入 Redis (關鍵！)
	// Key: auction:{id}:config
	// 我們把 Lua 腳本需要的參數都塞進去
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
	}).Err()

	return err
}

// ListProducts 取得所有商品 (讀 DB 即可)
func (s *Service) ListProducts() ([]models.Product, error) {
	var products []models.Product
	// 依建立時間倒序
	if err := s.db.Order("created_at desc").Find(&products).Error; err != nil {
		return nil, err
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