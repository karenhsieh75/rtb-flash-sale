-- KEYS[1]: 排行榜 Key
-- ARGV[1]: 用戶 ID
-- ARGV[2]: 分數
-- ARGV[3]: 現在時間
-- ARGV[4]: 結束時間

local rank_key = KEYS[1]
local user_id = ARGV[1]
local score = tonumber(ARGV[2])
local now_time = tonumber(ARGV[3])
local end_time = tonumber(ARGV[4])

-- 檢查活動是否結束
if now_time > end_time then
    return -1
end

-- 寫入排行榜
redis.call("ZADD", rank_key, score, user_id)

return 1