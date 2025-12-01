package bidding

import (
	"fmt"
	"net/http"
	"time"

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

	now := time.Now().UnixMilli()
	bidID := fmt.Sprintf("bid_%d_%s", now, userID)

	c.JSON(http.StatusOK, gin.H{
		"message": "出價成功",
		"bid": BidResponse{
			ID:        bidID,
			ProductID: productID,
			UserID:    userID,
			Price:     req.Price,
			Timestamp: now,
			Score:     score,
		},
	})
}
	
func (h *Handler) GetRankings(c *gin.Context) {
	productID := c.Param("id")
	
	resp, err := h.service.GetRankings(c.Request.Context(), productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetResults(c *gin.Context) {
	productID := c.Param("id")
	
	results, err := h.service.GetResults(c.Request.Context(), productID)
	if err != nil {
        // 區分錯誤類型給予不同 Status Code
        if err.Error() == "活動尚未結束" {
		    c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        } else {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        }
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}