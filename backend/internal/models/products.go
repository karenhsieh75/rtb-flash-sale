package models

import "time"

// ProductStatus 定義商品狀態常數
type ProductStatus string

const (
	StatusNotStarted ProductStatus = "not_started"
	StatusActive     ProductStatus = "active"
	StatusEnded      ProductStatus = "ended"
)

// Product 對應資料庫中的 products 表
type Product struct {
	ID          string        `gorm:"primaryKey;type:varchar(64)" json:"id"` // 這裡用 String ID (UUID 或 Timestamp 產生的字串)
	Title       string        `gorm:"not null" json:"title"`
	Description string        `json:"description"`
	BasePrice   float64       `gorm:"not null" json:"basePrice"`
	K           int           `gorm:"not null" json:"k"` // 限量數量
	StartTime   int64         `gorm:"not null" json:"startTime"` // Unix timestamp (毫秒)
	EndTime     int64         `gorm:"not null" json:"endTime"`   // Unix timestamp (毫秒)
	Status      ProductStatus `gorm:"default:'not_started'" json:"status"`
	
	// 動態權重參數
	Alpha float64 `gorm:"default:1.0" json:"alpha"`
	Beta  float64 `gorm:"default:0.5" json:"beta"`
	Gamma float64 `gorm:"default:0.3" json:"gamma"`

	// 關聯: 一個商品有多個出價紀錄 (Optional, 視需求加)
	// Bids []BidLog `gorm:"foreignKey:ProductID" json:"-"`
	
	CreatedAt time.Time `json:"-"`
	UpdatedAt time.Time `json:"-"`
}