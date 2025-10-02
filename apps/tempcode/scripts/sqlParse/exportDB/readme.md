支持特性
• MySQL / PostgreSQL 自动识别导出结构
• 每个数据库单独文件夹，结构类型分类（tables、views、procedures、functions、indexes）
• 每个结构保存为独立 .sql 文件
• 忽略系统库（如 sys, template0, postgres 等）

🚀 使用方式示例

MySQL：

```
node export-db-structure.js --type mysql --host localhost --user root --password yourpass --database mydb
```

PostgreSQL：

```
node export-db-structure.js --type pgsql --host localhost --user postgres --password yourpass --database mydb
```
