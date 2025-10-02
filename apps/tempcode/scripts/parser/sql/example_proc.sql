-- sql/example_proc.sql
-- 创建视图 v_sal
CREATE VIEW
    v_sal AS
SELECT
    a.deptno,
    a.num_emp / b.total_count AS Employees,
    a.sal_sum / b.total_sal AS Salary
FROM
    (
        SELECT
            deptno,
            COUNT(*) AS num_emp,
            SUM(sal) AS sal_sum
        FROM
            scott.emp
        WHERE
            city = 'NYC'
        GROUP BY
            deptno
    ) a,
    (
        SELECT
            COUNT(*) AS total_count,
            SUM(sal) AS total_sal
        FROM
            scott.emp
        WHERE
            city = 'NYC'
    ) b;

-- 存储过程：拆分订单数据到不同的目标表
CREATE
OR REPLACE PROCEDURE etl_order_split () AS BEGIN
INSERT INTO
    small_orders
SELECT
    *
FROM
    orders
WHERE
    order_total < 100000;

INSERT INTO
    medium_orders
SELECT
    *
FROM
    orders
WHERE
    order_total >= 100000
    AND order_total < 200000;

INSERT INTO
    large_orders
SELECT
    *
FROM
    orders
WHERE
    order_total >= 200000;

END;

-- 存储过程：订单与客户关联生成宽表
CREATE
OR REPLACE PROCEDURE etl_order_customer () AS BEGIN CREATE TEMP TABLE tmp_order_customer AS
SELECT
    o.order_id,
    o.customer_id,
    c.credit_limit,
    c.cust_email
FROM
    orders o
    JOIN customers c ON o.customer_id = c.customer_id;

INSERT INTO
    dws_order_customer
SELECT
    *
FROM
    tmp_order_customer;

END;