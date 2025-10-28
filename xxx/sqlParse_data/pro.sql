CREATE OR REPLACE PROCEDURE public.proc_sales_summary AS
BEGIN
INSERT INTO
  report.sales_summary (region, total_sales)
SELECT
  region SUM(amount) AS total_sales
FROM
  staging.sales_data
GROUP BY
  region;

END;