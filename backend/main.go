package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/gin-contrib/cors"

	"rtb-backend/internal/auth"
	"rtb-backend/internal/bidding"
	"rtb-backend/internal/database"
	"rtb-backend/internal/product"
)

var ctx = context.Background()

func main() {
	// 1. 基礎建設初始化
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost"
	}
	
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:6379", redisHost),
		Password: "",
		DB:       0,
	})
	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Fatal("Redis 連線失敗:", err)
	}

	db := database.InitDB()

	// 2. 服務層初始化 (Service Layer)
	authService := auth.NewService(db)
	bidService := bidding.NewService(rdb, db)
	productService := product.NewService(rdb, db)

	// 3. 處理層初始化 (Handler Layer)
	authHandler := auth.NewHandler(authService)
	bidHandler := bidding.NewHandler(bidService)
	productHandler := product.NewHandler(productService)

	// 4. 路由設定
	r := gin.Default()

	r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"http://localhost:5173"},
        AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
        AllowCredentials: true,
        MaxAge: 12 * time.Hour,
    }))

	// Auth Routes
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
	}

	// API Routes (受保護)
	api := r.Group("/api")
	api.Use(auth.AuthMiddleware())
	{
		// Bidding
		api.POST("/products/:id/bids", bidHandler.PlaceBid)

		// Product (Public Read)
		api.GET("/products", productHandler.List)

		// Product (Admin Write)
		admin := api.Group("/admin")
		{
			admin.POST("/products", productHandler.Create)
			admin.PATCH("/products/:id/status", productHandler.UpdateStatus)
		}
	}

	fmt.Println("Server running on port 8000")
	r.Run(":8000")
}