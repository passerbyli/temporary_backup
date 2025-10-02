CREATE OR REPLACE FUNCTION gen_uuid()
RETURNS text AS $$
DECLARE
    result text;
BEGIN
    -- 使用 md5(随机数 + 当前时间戳) 拼接为 UUID 格式
    SELECT lower(
        substr(md5(random()::text || clock_timestamp()::text), 1, 8) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 9, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 13, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 17, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 21, 12)
    )
    INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;