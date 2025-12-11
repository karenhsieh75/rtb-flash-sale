package database

import (
	"log"
	"time"
	"os"
	"fmt"
	"database/sql"
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

	user := os.Getenv("DB_USER")
	if user == "" {
		user = "admin"
	}

	password := os.Getenv("DB_PASSWORD")
	if password == "" {
		password = "password123"
	}
	
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=auction_db port=5432 sslmode=require TimeZone=Asia/Taipei", host, user, password)
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("無法連線到資料庫:", err)
	}

	// 設定連線池參數
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("取得資料庫連線失敗:", err)
	}

	// 限制最大連線數
	// t3.micro 極限約 83，我們設 70 保留一點緩衝給系統用
	sqlDB.SetMaxOpenConns(600)

	// 設定閒置連線數 (通常設為 Open 的一半或一樣)
	sqlDB.SetMaxIdleConns(100)

	// 設定連線生命週期 (避免連線過期導致的錯誤)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// 確保 sql.DB 型別被使用（避免 unused import 錯誤）
	var _ *sql.DB = sqlDB

	// 自動遷移 Schema
	if err := db.AutoMigrate(&BidLog{}, &models.User{}, &models.Product{}); err != nil {
		log.Fatal("資料庫遷移失敗:", err)
	}

	return db
}