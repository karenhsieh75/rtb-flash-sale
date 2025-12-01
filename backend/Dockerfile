# --- 第一階段：建置 (Builder) ---
# 使用官方 Go 映像檔作為基底
FROM golang:1.25-alpine AS builder

# 設定工作目錄
WORKDIR /app

# 1. 先複製依賴描述檔 (利用 Docker Cache 機制加速)
COPY go.mod go.sum ./
RUN go mod download

# 2. 複製所有程式碼
COPY . .

# 3. 編譯 Go 程式
# -o server: 輸出檔名叫做 server
RUN go build -o server main.go

# --- 第二階段：執行 (Runner) ---
# 使用超輕量級的 Alpine Linux
FROM alpine:latest

# 安裝時區資料
RUN apk add --no-cache tzdata

WORKDIR /root/

# 1. 從第一階段把編譯好的執行檔複製過來
COPY --from=builder /app/server .

# 2. 重要：把 Lua 腳本也複製過來！
# 因為你的 service.go 是用 os.ReadFile("scripts/place_bid.lua") 讀取的
# 如果沒複製，程式跑起來會找不到檔案而崩潰
COPY --from=builder /app/scripts ./scripts

# 3. 暴露 8000 Port
EXPOSE 8000

# 4. 啟動指令
CMD ["./server"]