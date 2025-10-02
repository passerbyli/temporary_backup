const pgParser = require("pg-query-parser");

const sql = `
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100)
  );

  CREATE FUNCTION get_user_info(user_id INT) RETURNS TABLE (name VARCHAR, email VARCHAR) AS $$
  BEGIN
    RETURN QUERY SELECT name, email FROM users WHERE id = user_id;
  END;
  $$ LANGUAGE plpgsql;
`;

const parsed = pgParser.parse(sql);
console.log(parsed);
