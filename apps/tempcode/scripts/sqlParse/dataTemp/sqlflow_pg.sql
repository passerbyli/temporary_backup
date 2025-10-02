-- postgresql sample sql
create view
    v2 as
SELECT
    distributors.name
FROM
    distributors
WHERE
    distributors.name LIKE 'W%'
UNION
SELECT
    actors.name
FROM
    actors
WHERE
    actors.name LIKE 'W%';

WITH
    t AS (
        SELECT
            random () as x
        FROM
            generate_series (1, 3)
    )
SELECT
    *
FROM
    t
UNION ALL
SELECT
    *
FROM
    t;

create view
    v3 as
WITH RECURSIVE
    employee_recursive (distance, employee_name, manager_name) AS (
        SELECT
            1,
            employee_name,
            manager_name
        FROM
            employee
        WHERE
            manager_name = 'Mary'
        UNION ALL
        SELECT
            er.distance + 1,
            e.employee_name,
            e.manager_name
        FROM
            employee_recursive er,
            employee e
        WHERE
            er.employee_name = e.manager_name
    )
SELECT
    distance,
    employee_name
FROM
    employee_recursive;

WITH
    upd AS (
        UPDATE employees
        SET
            sales_count = sales_count + 1
        WHERE
            id = (
                SELECT
                    sales_person
                FROM
                    accounts
                WHERE
                    name = 'Acme Corporation'
            ) RETURNING *
    )
INSERT INTO
    employees_log
SELECT
    *,
    current_timestamp
FROM
    upd;

/* not implemented
CREATE RECURSIVE VIEW nums_1_100 (n) AS
VALUES (1)
UNION ALL
SELECT n+1 FROM nums_1_100 WHERE n < 100;
 */