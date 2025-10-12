CREATE OR REPLACE PROCEDURE etl()
LANGUAGE plpgsql AS $$
BEGIN
  WITH tmp AS (
    SELECT user_id, sum(amount) AS total_amt
    FROM ods.orders
    GROUP BY user_id
  )
  INSERT INTO dwd.user_orders(user_id, total_amount)
  SELECT user_id, total_amt FROM tmp;
END;
$$;