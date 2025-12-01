package bidding

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(s *Service) *Handler {
	return &Handler{service: s}
}

func (h *Handler) PlaceBid(c *gin.Context) {
	productID := c.Param("id")
	
	var req BidRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "參數錯誤"})
		return
	}

	// 從 Context 取得 Middleware 解析的 User 資料
	userIDFloat, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授權"})
		return
	}
	userWeightFloat, _ := c.Get("weight")

	// 型別轉換 (JWT Claims 預設是 float64)
	userID := fmt.Sprintf("%d", int(userIDFloat.(float64)))
	weight := userWeightFloat.(float64)

	// 呼叫 Service
	score, err := h.service.PlaceBid(c.Request.Context(), productID, userID, req.Price, weight)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "出價成功",
		"data": BidResponse{
			ProductID: productID,
			UserID:    userID,
			Price:     req.Price,
			Score:     score,
		},
	})
}