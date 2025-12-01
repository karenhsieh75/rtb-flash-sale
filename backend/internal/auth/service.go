package auth

import (
	"errors"
	"math/rand"
	"rtb-backend/internal/models"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var jwtSecret = []byte("your_secret_key_change_in_production")

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// Register 註冊並隨機分配權重
func (s *Service) Register(username, password, role string) (*models.User, error) {
	var existing models.User
	if err := s.db.Where("username = ?", username).First(&existing).Error; err == nil {
		return nil, errors.New("使用者名稱已存在")
	}

	hashedPwd, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// 模擬權重分配 (1.0 ~ 1.5)
	// 管理員給較高權重
	weight := 1.0 + rand.Float64()*0.5
	if role == "admin" {
		weight = 2.0
	}

	user := models.User{
		Username: username,
		Password: string(hashedPwd),
		Role:     role,
		Weight:   weight,
	}

	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

// Login 登入並回傳 JWT
func (s *Service) Login(username, password string) (string, *models.User, error) {
	var user models.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		return "", nil, errors.New("帳號或密碼錯誤")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return "", nil, errors.New("帳號或密碼錯誤")
	}

	// 產生 JWT，將 Weight 放入 Claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":      user.ID,
		"username": user.Username,
		"role":     user.Role,
		"weight":   user.Weight, // 重要：權重存在 Token 內
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", nil, err
	}

	return tokenString, &user, nil
}