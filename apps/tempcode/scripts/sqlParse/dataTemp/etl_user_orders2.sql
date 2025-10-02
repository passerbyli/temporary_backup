-- CREATE OR REPLACE PROCEDURE ct_cms.etl_user_orders(target_date DATE)
-- CREATE PROCEDURE ct_cms.etl_user_orders(target_date DATE)
-- CREATE FUNCTION ct_cms.etl_user_orders(target_date DATE)
CREATE OR REPLACE FUNCTION ct_cms.etl_user_orders(target_date DATE)
-- CREATE OR REPLACE PROCEDURE ct_cms.etl_user_orders(target_date DATE)
-- CREATE OR REPLACE PROCEDURE [ct_cms].[etl_user_orders](target_date DATE)
LANGUAGE plpgsql AS $$
BEGIN
    -- 阶段1：在临时Schema中创建临时表
    CREATE TEMP TABLE tmp_raw_orders ON COMMIT DROP AS
    SELECT
        o.order_id,
        u.user_id,
        o.amount::NUMERIC(12,2) AS amount,
        o.order_time
    FROM ct_cms.orders o
    JOIN ct_cms.users u USING (user_id)
    WHERE o.order_date = target_date;

    -- 阶段2：使用多层WITH处理
    WITH user_stats AS (
        SELECT
            user_id,
            COUNT(*) AS order_count,
            SUM(amount) AS total_amount
        FROM tmp_raw_orders
        GROUP BY user_id
    ),
    latest_orders AS (
        SELECT DISTINCT ON (user_id)
            user_id,
            order_time AS last_order
        FROM tmp_raw_orders
        ORDER BY user_id, order_time DESC
    )
    -- 阶段3：写入目标Schema的物理表
    INSERT INTO ct_cms.user_orders_wide
    SELECT
        u.user_id,
        u.username,
        s.order_count,
        s.total_amount,
        l.last_order
    FROM ct_cms.users u
    LEFT JOIN user_stats s USING (user_id)
    LEFT JOIN latest_orders l USING (user_id)
    WHERE u.created_at <= target_date;

    -- 阶段4：使用SELECT INTO创建临时表
    SELECT * INTO tmp_final_orders
    FROM tmp_raw_orders;

    -- 阶段5：使用MERGE INTO操作
    MERGE INTO ct_cms.user_orders_wide AS target
    USING ct_cms.user_orders_staging AS source
    ON target.user_id = source.user_id
    WHEN MATCHED THEN
        UPDATE SET order_count = source.order_count
    WHEN NOT MATCHED THEN
        INSERT (user_id, order_count) VALUES (source.user_id, source.order_count);

    -- 清理临时表（ON COMMIT DROP自动处理）
EXCEPTION WHEN others THEN
    RAISE NOTICE 'ETL失败: %', SQLERRM;
    ROLLBACK;
END;
$$;