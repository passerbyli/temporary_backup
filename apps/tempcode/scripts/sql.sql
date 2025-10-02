-- ====================
-- 1. Schema 表
-- ====================
CREATE TABLE IF NOT EXISTS metadata_schema (
  id          varchar PRIMARY KEY,
  name        varchar(128) NOT NULL,
  description varchar(400),
  created_at  timestamp DEFAULT current_timestamp,
  updated_at  timestamp DEFAULT current_timestamp,
  created_by  varchar(100),
  updated_by  varchar(100)
);
COMMENT ON TABLE metadata_schema IS 'Schema 表';
COMMENT ON COLUMN metadata_schema.id IS '主键';
COMMENT ON COLUMN metadata_schema.name IS 'Schema 名称';
COMMENT ON COLUMN metadata_schema.description IS '描述';
COMMENT ON COLUMN metadata_schema.created_at IS '创建时间';
COMMENT ON COLUMN metadata_schema.updated_at IS '修改时间';
COMMENT ON COLUMN metadata_schema.created_by IS '创建人';
COMMENT ON COLUMN metadata_schema.updated_by IS '修改人';

-- ====================
-- 2. 表资产表
-- ====================
CREATE TABLE IF NOT EXISTS metadata_table (
  id           varchar PRIMARY KEY,
  name         varchar(128) NOT NULL,
  description  varchar(400),
  layer        varchar(128),
  type         varchar(128),
  schema_id    varchar,
  schema_name  varchar(128),
  database     varchar,
  tags         varchar,
  create_time  varchar,
  version      varchar,
  demain       varchar,
  created_at   timestamp DEFAULT current_timestamp,
  updated_at   timestamp DEFAULT current_timestamp,
  created_by   varchar(100),
  updated_by   varchar(100)
);
COMMENT ON TABLE metadata_table IS '数据表资产信息';
COMMENT ON COLUMN metadata_table.id IS '主键';
COMMENT ON COLUMN metadata_table.name IS '表名称';
COMMENT ON COLUMN metadata_table.description IS '表描述';
COMMENT ON COLUMN metadata_table.layer IS '所属分层（如 ods、dwd、dws、ads）';
COMMENT ON COLUMN metadata_table.type IS '表类型（table、view、tmp）';
COMMENT ON COLUMN metadata_table.schema_id IS '所属 schema ID';
COMMENT ON COLUMN metadata_table.schema_name IS '所属 schema 名称';
COMMENT ON COLUMN metadata_table.database IS '所属数据库';
COMMENT ON COLUMN metadata_table.tags IS '标签';
COMMENT ON COLUMN metadata_table.create_time IS '建表时间';
COMMENT ON COLUMN metadata_table.version IS '版本号';
COMMENT ON COLUMN metadata_table.demain IS '所属领域';
COMMENT ON COLUMN metadata_table.created_at IS '创建时间';
COMMENT ON COLUMN metadata_table.updated_at IS '修改时间';
COMMENT ON COLUMN metadata_table.created_by IS '创建人';
COMMENT ON COLUMN metadata_table.updated_by IS '修改人';

-- ====================
-- 3. 字段资产表
-- ====================
CREATE TABLE IF NOT EXISTS metadata_field (
  id            varchar PRIMARY KEY,
  name          varchar(128) NOT NULL,
  description   varchar(400),
  field_type    varchar(400),
  field_length  varchar(400),
  field_alias   varchar(400),
  table_name    varchar,
  table_id      varchar,
  schema_name   varchar,
  schema_id     varchar,
  created_at    timestamp DEFAULT current_timestamp,
  updated_at    timestamp DEFAULT current_timestamp,
  created_by    varchar(100),
  updated_by    varchar(100)
);
COMMENT ON TABLE metadata_field IS '字段资产表';
COMMENT ON COLUMN metadata_field.id IS '主键';
COMMENT ON COLUMN metadata_field.name IS '字段名称';
COMMENT ON COLUMN metadata_field.description IS '字段描述';
COMMENT ON COLUMN metadata_field.field_type IS '字段类型';
COMMENT ON COLUMN metadata_field.field_length IS '字段长度';
COMMENT ON COLUMN metadata_field.field_alias IS '字段别名';
COMMENT ON COLUMN metadata_field.table_name IS '表名称';
COMMENT ON COLUMN metadata_field.table_id IS '表 ID';
COMMENT ON COLUMN metadata_field.schema_name IS 'Schema 名称';
COMMENT ON COLUMN metadata_field.schema_id IS 'Schema ID';
COMMENT ON COLUMN metadata_field.created_at IS '创建时间';
COMMENT ON COLUMN metadata_field.updated_at IS '修改时间';
COMMENT ON COLUMN metadata_field.created_by IS '创建人';
COMMENT ON COLUMN metadata_field.updated_by IS '修改人';

-- ====================
-- 4. SQL 脚本表
-- ====================
CREATE TABLE IF NOT EXISTS metadata_sqlscript (
  id           varchar PRIMARY KEY,
  name         varchar(128) NOT NULL,
  description  varchar(400),
  schema_id    varchar,
  schema_name  varchar(128),
  type         varchar(128),
  content      text,
  parsed       boolean DEFAULT false,
  created_at   timestamp DEFAULT current_timestamp,
  updated_at   timestamp DEFAULT current_timestamp,
  created_by   varchar(100),
  updated_by   varchar(100)
);
COMMENT ON TABLE metadata_sqlscript IS 'SQL 脚本或存储过程表';
COMMENT ON COLUMN metadata_sqlscript.id IS '主键';
COMMENT ON COLUMN metadata_sqlscript.name IS '脚本名称';
COMMENT ON COLUMN metadata_sqlscript.description IS '脚本描述';
COMMENT ON COLUMN metadata_sqlscript.schema_id IS 'Schema ID';
COMMENT ON COLUMN metadata_sqlscript.schema_name IS 'Schema 名称';
COMMENT ON COLUMN metadata_sqlscript.type IS '脚本类型（sql/etl/proc/bids）';
COMMENT ON COLUMN metadata_sqlscript.content IS '脚本内容';
COMMENT ON COLUMN metadata_sqlscript.parsed IS '是否已解析依赖';
COMMENT ON COLUMN metadata_sqlscript.created_at IS '创建时间';
COMMENT ON COLUMN metadata_sqlscript.updated_at IS '修改时间';
COMMENT ON COLUMN metadata_sqlscript.created_by IS '创建人';
COMMENT ON COLUMN metadata_sqlscript.updated_by IS '修改人';

-- ====================
-- 5. 血缘关系表
-- ====================
CREATE TABLE IF NOT EXISTS metadata_lineage (
  id           varchar PRIMARY KEY,
  name         varchar(128) NOT NULL,
  description  varchar(400),
  source_id    varchar,
  source_name  varchar(128),
  target_id    varchar,
  target_name  varchar(128),
  sql_id       varchar,
  sql_name     varchar(128),
  task_id      varchar,
  task_name    varchar(128),
  created_at   timestamp DEFAULT current_timestamp,
  updated_at   timestamp DEFAULT current_timestamp,
  created_by   varchar(100),
  updated_by   varchar(100)
);
COMMENT ON TABLE metadata_lineage IS '表级血缘关系表';
COMMENT ON COLUMN metadata_lineage.id IS '主键';
COMMENT ON COLUMN metadata_lineage.name IS '血缘名称（脚本名称）';
COMMENT ON COLUMN metadata_lineage.description IS '描述';
COMMENT ON COLUMN metadata_lineage.source_id IS '来源表 ID';
COMMENT ON COLUMN metadata_lineage.source_name IS '来源表名称';
COMMENT ON COLUMN metadata_lineage.target_id IS '目标表 ID';
COMMENT ON COLUMN metadata_lineage.target_name IS '目标表名称';
COMMENT ON COLUMN metadata_lineage.sql_id IS 'SQL 脚本 ID';
COMMENT ON COLUMN metadata_lineage.sql_name IS 'SQL 脚本名称';
COMMENT ON COLUMN metadata_lineage.task_id IS '调度任务 ID';
COMMENT ON COLUMN metadata_lineage.task_name IS '调度任务名称';
COMMENT ON COLUMN metadata_lineage.created_at IS '创建时间';
COMMENT ON COLUMN metadata_lineage.updated_at IS '修改时间';
COMMENT ON COLUMN metadata_lineage.created_by IS '创建人';
COMMENT ON COLUMN metadata_lineage.updated_by IS '修改人';

-- ====================
-- 6. 接口元数据表
-- ====================
CREATE TABLE IF NOT EXISTS metadata_api (
  id              varchar PRIMARY KEY,
  env             varchar(100) NOT NULL,
  api_id          varchar(500) NOT NULL,
  name            varchar(500),
  url             varchar(500),
  online_url      varchar(500),
  impl            varchar(500),
  domain          varchar(500),
  auth_type       varchar(500),
  description     text,
  request_example jsonb,
  input_params    jsonb,
  backend_script  text,
  source_from     varchar(500) DEFAULT 'api_market',
  sync_time       timestamp DEFAULT current_timestamp,
  hash            varchar(500),
  route           varchar(500),
  route_id        varchar(500),
  from_table      text,
  created_at      timestamp DEFAULT current_timestamp,
  updated_at      timestamp DEFAULT current_timestamp,
  created_by      varchar(100),
  updated_by      varchar(100),
  UNIQUE (api_id, env)
);
COMMENT ON TABLE metadata_api IS 'API 接口元数据表';
COMMENT ON COLUMN metadata_api.id IS '主键';
COMMENT ON COLUMN metadata_api.env IS '环境（如 test, prod）';
COMMENT ON COLUMN metadata_api.api_id IS '接口唯一标识';
COMMENT ON COLUMN metadata_api.name IS '接口名称';
COMMENT ON COLUMN metadata_api.url IS '接口地址';
COMMENT ON COLUMN metadata_api.online_url IS '生产地址';
COMMENT ON COLUMN metadata_api.impl IS '后端实现类';
COMMENT ON COLUMN metadata_api.domain IS '所属领域';
COMMENT ON COLUMN metadata_api.auth_type IS '认证方式';
COMMENT ON COLUMN metadata_api.description IS '描述信息';
COMMENT ON COLUMN metadata_api.request_example IS '请求示例';
COMMENT ON COLUMN metadata_api.input_params IS '入参结构';
COMMENT ON COLUMN metadata_api.backend_script IS '后端 SQL 脚本';
COMMENT ON COLUMN metadata_api.source_from IS '来源（如 api_market）';
COMMENT ON COLUMN metadata_api.sync_time IS '同步时间';
COMMENT ON COLUMN metadata_api.hash IS '内容 hash 值';
COMMENT ON COLUMN metadata_api.route IS '路由信息';
COMMENT ON COLUMN metadata_api.route_id IS '路由 ID';
COMMENT ON COLUMN metadata_api.from_table IS '来源表';
COMMENT ON COLUMN metadata_api.created_at IS '创建时间';
COMMENT ON COLUMN metadata_api.updated_at IS '修改时间';
COMMENT ON COLUMN metadata_api.created_by IS '创建人';
COMMENT ON COLUMN metadata_api.updated_by IS '修改人';