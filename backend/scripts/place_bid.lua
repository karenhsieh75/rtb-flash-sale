-- KEYS[1]: auction:{id}:rank   (排行榜 ZSET)
-- KEYS[2]: auction:{id}:bids   (詳細資訊 HASH)
-- ARGV[1]: user_id
-- ARGV[2]: score
-- ARGV[3]: now_time
-- ARGV[4]: end_time
-- ARGV[5]: bid_details (字串: "price,reactionTime,weight")

local rank_key = KEYS[1]
local bids_key = KEYS[2]
local user_id = ARGV[1]
local score = tonumber(ARGV[2])
local now_time = tonumber(ARGV[3])
local end_time = tonumber(ARGV[4])
local bid_details = ARGV[5]

-- 檢查活動是否結束
if now_time > end_time then
    return -1
end

-- 寫入排行榜 (分數)
redis.call("ZADD", rank_key, score, user_id)

-- 寫入詳細資訊 (價格、時間、權重)
-- 逗號分隔的字串，省空間
redis.call("HSET", bids_key, user_id, bid_details)

return 1