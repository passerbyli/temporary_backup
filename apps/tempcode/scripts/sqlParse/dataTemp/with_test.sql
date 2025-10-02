WITH
    aaa_table AS (
        SELECT
            user_id,
            COUNT(*) AS order_count
        FROM
            tmp_raw_orders
        GROUP BY
            user_id
    ),
    bbb_table AS (
        SELECT DISTINCT
            ON (user_id) user_id,
            order_time AS last_order
        FROM
            tmp_raw_orders
        ORDER BY
            user_id,
            order_time DESC
    ),
    ccc_table AS (
        SELECT
            user_id,
            SUM(amount) AS total_amount
        FROM
            tmp_raw_orders
        GROUP BY
            user_id
    )
    -- 阶段3：写入目标Schema的物理表
INSERT INTO
    ct_cms.user_orders_wide
SELECT
    u.user_id,
    u.username,
    s.order_count,
    s.total_amount,
    l.last_order
FROM
    ct_cms.users u
    LEFT JOIN aaa_table s USING (user_id)
    LEFT JOIN bbb_table l USING (user_id)
    LEFT JOIN ccc_table t USING (user_id)
WHERE
    u.created_at <= target_date;