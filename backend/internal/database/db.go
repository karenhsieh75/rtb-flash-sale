package database

import (
	"log"
	"time"
	"os"
	"fmt"
	"rtb-backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// BidLog 對應資料庫中的 bid_logs 資料表
type BidLog struct {
	ID        uint      `gorm:"primaryKey"`
	UserID    string    `gorm:"index"`
	ProductID string    `gorm:"index"`
	Price     float64
	Score     float64
	CreatedAt time.Time
}

// InitDB 初始化資料庫連線
func InitDB() *gorm.DB {
	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	
	dsn := fmt.Sprintf("host=%s user=admin password=password123 dbname=auction_db port=5432 sslmode=disable TimeZone=Asia/Taipei", host)
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("無法連線到資料庫:", err)
	}

	// 自動遷移 Schema
	if err := db.AutoMigrate(&BidLog{}, &models.User{}, &models.Product{}); err != nil {
		log.Fatal("資料庫遷移失敗:", err)
	}

	return db
}