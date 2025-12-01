package bidding

// BidRequest 定義前端傳來的 JSON 格式
type BidRequest struct {
	Price float64 `json:"price" binding:"required"`
}

// BidResponse 定義回傳給前端的格式
type BidResponse struct {
	ID        string  `json:"id"`
	ProductID string  `json:"productId"`
	UserID    string  `json:"userId"`
	Price     float64 `json:"price"`
	Timestamp int64   `json:"timestamp"`
	Score     float64 `json:"score"`
}

// RankingItem 單一排名項目
type RankingItem struct {
	Rank         int     `json:"rank"`
	UserID       string  `json:"userId"`
	DisplayName  string  `json:"displayName"`
	Price        float64 `json:"price"`
	ReactionTime int64   `json:"reactionTime"`
	Weight       float64 `json:"weight"`
	Score        float64 `json:"score"`
}

// RankingResponse API 回傳格式
type RankingResponse struct {
	Rankings            []RankingItem `json:"rankings"`
	ThresholdScore      float64       `json:"thresholdScore"`      // 第 K 名的分數
	CurrentHighestPrice float64       `json:"currentHighestPrice"` // 目前最高價
}

// ResultItem 最終結果項目
type ResultItem struct {
	Rank        int     `json:"rank"`
	UserID      string  `json:"userId"`
	DisplayName string  `json:"displayName"`
	FinalPrice  float64 `json:"finalPrice"`
	FinalScore  float64 `json:"finalScore"`
	IsWinner    bool    `json:"isWinner"`
}