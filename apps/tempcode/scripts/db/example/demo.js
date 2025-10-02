const config = require("./config");
const DbClient = require("../db/DbClient");

async function run() {
  const db = new DbClient(config, {
    camelCase: true,
    logHook: (type, msg) => console.log(`[LOG-${type}]`, msg),
  });

  const users = await db.query("pg1", "SELECT * FROM users WHERE id IN :ids", {
    ids: [1, 2],
  });
  console.log("Users:", users);

  const paged = await db.queryByPage(
    "mysql1",
    "SELECT * FROM users WHERE name LIKE :name",
    {
      name: "%Tom%",
    },
    { page: 1, pageSize: 5 }
  );
  console.log("Paged:", paged);

  await db.update("pg1", "UPDATE users SET name = :name WHERE id = :id", {
    name: "Updated",
    id: 1,
  });

  await db.delete("mysql1", "DELETE FROM users WHERE id = :id", {
    id: 99,
  });

  db.closeAll();
}

run();
