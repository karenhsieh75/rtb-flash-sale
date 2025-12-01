package bidding

// BidRequest 定義前端傳來的 JSON 格式
type BidRequest struct {
	Price float64 `json:"price" binding:"required"`
}

// BidResponse 定義回傳給前端的格式 (讓 main.go 更乾淨)
type BidResponse struct {
	ProductID string  `json:"productId"`
	UserID    string  `json:"userId"`
	Price     float64 `json:"price"`
	Score     float64 `json:"score"`
}