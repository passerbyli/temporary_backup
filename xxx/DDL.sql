-- =========================================================
-- 数据资源管理系统 - 元数据表结构 (PostgreSQL)
-- Schema: meta_data_ds
-- 说明：简洁、幂等；无外键；UUID 由应用写入
-- =========================================================

-- 0) Schema
CREATE SCHEMA IF NOT EXISTS meta_data_ds;

-- 通用审计字段说明（每表均包含）
-- id(uuid)，created_at/updated_at(timestamptz 默认 now())，created_by/updated_by(text)

-- ---------------------------------------------------------
-- 1) 接口元数据
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_data_ds.metadata_api (
                                                         id                 uuid PRIMARY KEY,
                                                         api_name           text        NOT NULL,      -- 接口名称
                                                         api_path           text        NOT NULL,      -- 接口路径（如 /users/{id}）
                                                         api_method         text        NOT NULL,      -- 请求方式：GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS
                                                         api_desc           text,                      -- 接口描述
                                                         microservice_name  text        NOT NULL,      -- 微服务名称
                                                         request_example    jsonb,                    -- 请求参数示例（JSON）
                                                         response_example   jsonb,                    -- 响应参数示例（JSON）
                                                         created_at         timestamptz NOT NULL DEFAULT now(),
                                                         updated_at         timestamptz NOT NULL DEFAULT now(),
                                                         created_by         text,
                                                         updated_by         text,
                                                         CONSTRAINT chk_metadata_api_method
                                                             CHECK (api_method IN ('GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS'))
);

COMMENT ON TABLE  meta_data_ds.metadata_api IS '接口元数据表';
COMMENT ON COLUMN meta_data_ds.metadata_api.id                IS '主键ID，UUID，由应用写入';
COMMENT ON COLUMN meta_data_ds.metadata_api.api_name          IS '接口名称';
COMMENT ON COLUMN meta_data_ds.metadata_api.api_path          IS '接口路径';
COMMENT ON COLUMN meta_data_ds.metadata_api.api_method        IS 'HTTP方法';
COMMENT ON COLUMN meta_data_ds.metadata_api.api_desc          IS '接口描述';
COMMENT ON COLUMN meta_data_ds.metadata_api.microservice_name IS '微服务名称';
COMMENT ON COLUMN meta_data_ds.metadata_api.request_example   IS '请求示例(JSON)';
COMMENT ON COLUMN meta_data_ds.metadata_api.response_example  IS '响应示例(JSON)';
COMMENT ON COLUMN meta_data_ds.metadata_api.created_at        IS '创建时间';
COMMENT ON COLUMN meta_data_ds.metadata_api.updated_at        IS '修改时间';
COMMENT ON COLUMN meta_data_ds.metadata_api.created_by        IS '创建人';
COMMENT ON COLUMN meta_data_ds.metadata_api.updated_by        IS '修改人';

-- 唯一：请求方式 + 微服务名称 + 接口路径
CREATE UNIQUE INDEX IF NOT EXISTS ux_metadata_api_signature
    ON meta_data_ds.metadata_api (api_method, microservice_name, api_path);

-- ---------------------------------------------------------
-- 2) 接口字段元数据（入/出参，支持嵌套）
--    树 + 物化路径：parent_field_id, path, level, seq
--    Swagger/JSON Schema 相关：data_type, is_array, item_data_type, rule_ext
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_data_ds.metadata_api_field (
                                                               id                 uuid PRIMARY KEY,
                                                               api_id             uuid        NOT NULL,      -- 所属API（逻辑关联 metadata_api.id）
                                                               field_name         text        NOT NULL,      -- 字段名称
                                                               io_type            text        NOT NULL,      -- in / out
                                                               data_type          text,                      -- 基础类型：string/number/integer/boolean/object/array/null
                                                               is_array           boolean,                   -- 是否数组
                                                               item_data_type     text,                      -- 数组元素类型
                                                               field_desc         text,                      -- 字段描述
                                                               required           boolean     NOT NULL DEFAULT false, -- 是否必填
                                                               default_value      text,                      -- 默认值（文本）
                                                               example_value      text,                      -- 示例值（文本）
                                                               length             integer,                   -- 长度（如适用）

    -- 树/路径
                                                               parent_field_id    uuid,                      -- 父级字段ID（逻辑关联本表）
                                                               path               text,                      -- 物化路径，如 body.user.addresses[0].street
                                                               level              integer,                   -- 层级深度（根=0）
                                                               seq                integer,                   -- 同层顺序

    -- 规则/扩展（接近 JSON Schema）
                                                               rule_ext           jsonb,                     -- 例如 {enum:[], minimum:1, format:'date-time', pattern:'^...$'}

                                                               created_at         timestamptz NOT NULL DEFAULT now(),
                                                               updated_at         timestamptz NOT NULL DEFAULT now(),
                                                               created_by         text,
                                                               updated_by         text,

                                                               CONSTRAINT chk_metadata_api_field_io
                                                                   CHECK (io_type IN ('in','out')),
                                                               CONSTRAINT chk_metadata_api_field_dtype
                                                                   CHECK (data_type IS NULL OR data_type IN ('string','number','integer','boolean','object','array','null'))
);

COMMENT ON TABLE  meta_data_ds.metadata_api_field IS '接口字段元数据（支持多层级与数组/对象）';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.id              IS '主键ID，UUID，由应用写入';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.api_id          IS '所属API的ID';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.field_name      IS '字段名称';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.io_type         IS '字段方向：in=入参，out=出参';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.data_type       IS '基础数据类型（JSON Schema）';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.is_array        IS '是否为数组类型';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.item_data_type  IS '数组元素的数据类型';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.field_desc      IS '字段描述';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.required        IS '是否必填';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.default_value   IS '默认值（文本）';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.example_value   IS '示例值（文本）';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.length          IS '字段长度（如适用）';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.parent_field_id IS '父级字段ID（逻辑关联本表）';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.path            IS '字段物化路径，用于唯一定位';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.level           IS '层级深度，根为0';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.seq             IS '同层顺序号';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.rule_ext        IS '校验与扩展(JSON)，如 enum/format/minLength 等';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.created_at      IS '创建时间';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.updated_at      IS '修改时间';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.created_by      IS '创建人';
COMMENT ON COLUMN meta_data_ds.metadata_api_field.updated_by      IS '修改人';

-- 唯一：同一 API 的同一方向下，path 唯一（便于还原层级与生成 Swagger）
CREATE UNIQUE INDEX IF NOT EXISTS ux_api_field_api_io_path
    ON meta_data_ds.metadata_api_field (api_id, io_type, path);

-- 常用查询索引：按父子/层级/顺序遍历
CREATE INDEX IF NOT EXISTS ix_api_field_api_parent
    ON meta_data_ds.metadata_api_field (api_id, io_type, parent_field_id, seq);
CREATE INDEX IF NOT EXISTS ix_api_field_api_level
    ON meta_data_ds.metadata_api_field (api_id, io_type, level);
CREATE INDEX IF NOT EXISTS gin_api_field_rule_ext
    ON meta_data_ds.metadata_api_field USING GIN (rule_ext);

-- ---------------------------------------------------------
-- 3) 接口与其他资源的调用关系
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_data_ds.metadata_api_call (
                                                              id                 uuid PRIMARY KEY,
                                                              api_id             uuid        NOT NULL,      -- 来源 API（逻辑关联 metadata_api.id）
                                                              resource_type      text        NOT NULL,      -- table/procedure/api/third_party_service
                                                              resource_id        uuid        NOT NULL,      -- 目标资源ID（逻辑关联各资源表）
                                                              call_params        jsonb,                     -- 调用参数（JSON）
                                                              created_at         timestamptz NOT NULL DEFAULT now(),
                                                              updated_at         timestamptz NOT NULL DEFAULT now(),
                                                              created_by         text,
                                                              updated_by         text,
                                                              CONSTRAINT chk_api_call_rtype
                                                                  CHECK (resource_type IN ('table','procedure','api','third_party_service'))
);

COMMENT ON TABLE  meta_data_ds.metadata_api_call IS '接口调用到表/过程/API/三方服务的元数据';
COMMENT ON COLUMN meta_data_ds.metadata_api_call.id            IS '主键ID，UUID，由应用写入';
COMMENT ON COLUMN meta_data_ds.metadata_api_call.api_id        IS '来源API的ID';
COMMENT ON COLUMN meta_data_ds.metadata_api_call.resource_type IS '资源类型';
COMMENT ON COLUMN meta_data_ds.metadata_api_call.resource_id   IS '被调用资源的ID';
COMMENT ON COLUMN meta_data_ds.metadata_api_call.call_params   IS '调用参数(JSON)';
COMMENT ON COLUMN meta_data_ds.metadata_api_call.created_at    IS '创建时间';
COMMENT ON COLUMN meta_data_ds.metadata_api_call.updated_at    IS '修改时间';
COMMENT ON COLUMN meta_data_ds.metadata_api_call.created_by    IS '创建人';
COMMENT ON COLUMN meta_data_ds.metadata_api_call.updated_by    IS '修改人';

-- ---------------------------------------------------------
-- 4) 数据库实例/Schema 元数据
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_data_ds.metadata_schema (
                                                            id                 uuid PRIMARY KEY,
                                                            schema_name        text        NOT NULL,      -- 实例/Schema 名称
                                                            schema_desc        text,                      -- 描述
                                                            created_at         timestamptz NOT NULL DEFAULT now(),
                                                            updated_at         timestamptz NOT NULL DEFAULT now(),
                                                            created_by         text,
                                                            updated_by         text
);

COMMENT ON TABLE  meta_data_ds.metadata_schema IS '数据库实例/Schema 元数据表';
COMMENT ON COLUMN meta_data_ds.metadata_schema.id          IS '主键ID，UUID，由应用写入';
COMMENT ON COLUMN meta_data_ds.metadata_schema.schema_name IS '实例/Schema 名称';
COMMENT ON COLUMN meta_data_ds.metadata_schema.schema_desc IS '描述';
COMMENT ON COLUMN meta_data_ds.metadata_schema.created_at  IS '创建时间';
COMMENT ON COLUMN meta_data_ds.metadata_schema.updated_at  IS '修改时间';
COMMENT ON COLUMN meta_data_ds.metadata_schema.created_by  IS '创建人';
COMMENT ON COLUMN meta_data_ds.metadata_schema.updated_by  IS '修改人';

-- ---------------------------------------------------------
-- 5) 数据表元数据
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_data_ds.metadata_table (
                                                           id                 uuid PRIMARY KEY,
                                                           table_name         text        NOT NULL,      -- 表名称
                                                           table_desc         text,                      -- 表描述
                                                           table_type         text,                      -- 表类型（如 base/view/temp）
                                                           schema_id          uuid        NOT NULL,      -- 所属 schema（逻辑关联 metadata_schema.id）
                                                           schema_name        text        NOT NULL,      -- 所属 schema 名称（冗余）
                                                           is_temporary       boolean     NOT NULL DEFAULT false, -- 是否临时表
                                                           created_at         timestamptz NOT NULL DEFAULT now(),
                                                           updated_at         timestamptz NOT NULL DEFAULT now(),
                                                           created_by         text,
                                                           updated_by         text
);

COMMENT ON TABLE  meta_data_ds.metadata_table IS '数据表元数据表';
COMMENT ON COLUMN meta_data_ds.metadata_table.id            IS '主键ID，UUID，由应用写入';
COMMENT ON COLUMN meta_data_ds.metadata_table.table_name    IS '表名称';
COMMENT ON COLUMN meta_data_ds.metadata_table.table_desc    IS '表描述';
COMMENT ON COLUMN meta_data_ds.metadata_table.table_type    IS '表类型（base/view/temp）';
COMMENT ON COLUMN meta_data_ds.metadata_table.schema_id     IS '所属数据库 schema 的ID';
COMMENT ON COLUMN meta_data_ds.metadata_table.schema_name   IS '所属 schema 名称';
COMMENT ON COLUMN meta_data_ds.metadata_table.is_temporary  IS '是否临时表：true/false，默认 false';
COMMENT ON COLUMN meta_data_ds.metadata_table.created_at    IS '创建时间';
COMMENT ON COLUMN meta_data_ds.metadata_table.updated_at    IS '修改时间';
COMMENT ON COLUMN meta_data_ds.metadata_table.created_by    IS '创建人';
COMMENT ON COLUMN meta_data_ds.metadata_table.updated_by    IS '修改人';

-- ---------------------------------------------------------
-- 6) 表字段元数据
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_data_ds.metadata_table_field (
                                                                 id                 uuid PRIMARY KEY,
                                                                 table_id           uuid        NOT NULL,      -- 所属表ID（逻辑关联 metadata_table.id）
                                                                 table_name         text        NOT NULL,      -- 所属表ID（逻辑关联 metadata_table.id）
                                                                 schema_id          uuid        NOT NULL,      -- 所属数据库 schema 的ID
                                                                 schema_name        text        NOT NULL,      -- 所属 schema 名称（冗余）
                                                                 field_name         text        NOT NULL,      -- 字段名称
                                                                 field_type         text,                      -- 字段类型（如 int4/varchar/numeric(10,2)）
                                                                 field_desc         text,                      -- 字段描述
                                                                 default_value      text,                      -- 默认值（文本化）
                                                                 length             integer,                   -- 字段长度（如适用）
                                                                 created_at         timestamptz NOT NULL DEFAULT now(),
                                                                 updated_at         timestamptz NOT NULL DEFAULT now(),
                                                                 created_by         text,
                                                                 updated_by         text
);

COMMENT ON TABLE  meta_data_ds.metadata_table_field IS '数据库字段元数据表';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.id           IS '主键ID，UUID，由应用写入';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.table_id     IS '所属表ID';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.field_name   IS '字段名称';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.field_type   IS '字段类型';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.field_desc   IS '字段描述';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.default_value IS '默认值（文本）';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.length       IS '字段长度';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.created_at   IS '创建时间';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.updated_at   IS '修改时间';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.created_by   IS '创建人';
COMMENT ON COLUMN meta_data_ds.metadata_table_field.updated_by   IS '修改人';

-- ---------------------------------------------------------
-- 7) 存储过程元数据
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_data_ds.metadata_procedure (
                                                               id                 uuid PRIMARY KEY,
                                                               procedure_name     text        NOT NULL,      -- 存储过程名称
                                                               procedure_desc     text,                      -- 描述
                                                               schema_id          uuid        NOT NULL,      -- 所属 schema（逻辑关联 metadata_schema.id）
                                                               schema_name        text        NOT NULL,      -- 所属 schema 名称（冗余）
                                                               procedure_script   text,                      -- 存储过程脚本内容
                                                               input_params_text  text,                      -- 入参定义（文本）
                                                               output_params_text text,                      -- 出参定义（文本）
                                                               created_at         timestamptz NOT NULL DEFAULT now(),
                                                               updated_at         timestamptz NOT NULL DEFAULT now(),
                                                               created_by         text,
                                                               updated_by         text
);

COMMENT ON TABLE  meta_data_ds.metadata_procedure IS '数据库存储过程元数据表';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.id                IS '主键ID，UUID，由应用写入';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.procedure_name    IS '存储过程名称';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.procedure_desc    IS '存储过程描述';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.schema_id         IS '所属数据库 schema 的ID';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.procedure_script  IS '存储过程脚本内容';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.input_params_text IS '入参定义（文本）';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.output_params_text IS '出参定义（文本）';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.created_at        IS '创建时间';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.updated_at        IS '修改时间';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.created_by        IS '创建人';
COMMENT ON COLUMN meta_data_ds.metadata_procedure.updated_by        IS '修改人';

-- ---------------------------------------------------------
-- 8) 存储过程 → 目标表
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_data_ds.metadata_procedure_target_table (
                                                                            id                   uuid PRIMARY KEY,
                                                                            procedure_id         uuid        NOT NULL,    -- 对应存储过程ID（逻辑关联 metadata_procedure.id）
                                                                            procedure_name       text        NOT NULL,    -- 存储过程名称（冗余）
                                                                            target_table_id      uuid,                    -- 目标表ID（逻辑关联 metadata_table.id）
                                                                            target_table_name    text        NOT NULL,    -- 目标表名称
                                                                            target_table_desc    text,                    -- 目标表描述
                                                                            schema_id            uuid        NOT NULL,    -- 所属数据库 schema 的ID
                                                                            schema_name        text        NOT NULL,      -- 所属 schema 名称（冗余）
                                                                            created_at           timestamptz NOT NULL DEFAULT now(),
                                                                            updated_at           timestamptz NOT NULL DEFAULT now(),
                                                                            created_by           text,
                                                                            updated_by           text
);

COMMENT ON TABLE  meta_data_ds.metadata_procedure_target_table IS '存储过程目标表元数据表';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.id                 IS '主键ID，UUID，由应用写入';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.procedure_id       IS '对应存储过程ID';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.procedure_name     IS '存储过程名称（冗余）';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.target_table_id    IS '目标表ID';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.target_table_name  IS '目标表名称';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.target_table_desc  IS '目标表描述';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.schema_id          IS '所属数据库 schema 的ID';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.created_at         IS '创建时间';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.updated_at         IS '修改时间';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.created_by         IS '创建人';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_target_table.updated_by         IS '修改人';

-- ---------------------------------------------------------
-- 9) 存储过程 → 源表
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_data_ds.metadata_procedure_source_table (
                                                                            id                   uuid PRIMARY KEY,
                                                                            procedure_id         uuid        NOT NULL,    -- 对应存储过程ID（逻辑关联 metadata_procedure.id）
                                                                            procedure_name       text        NOT NULL,    -- 存储过程名称（冗余）
                                                                            source_table_id      uuid,                    -- 源表ID（逻辑关联 metadata_table.id）
                                                                            source_table_name    text        NOT NULL,    -- 源表名称
                                                                            source_table_desc    text,                    -- 源表描述
                                                                            schema_id            uuid        NOT NULL,    -- 所属数据库 schema 的ID
                                                                            schema_name        text        NOT NULL,      -- 所属 schema 名称（冗余）
                                                                            created_at           timestamptz NOT NULL DEFAULT now(),
                                                                            updated_at           timestamptz NOT NULL DEFAULT now(),
                                                                            created_by           text,
                                                                            updated_by           text
);

COMMENT ON TABLE  meta_data_ds.metadata_procedure_source_table IS '存储过程源表元数据表';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.id                 IS '主键ID，UUID，由应用写入';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.procedure_id       IS '对应存储过程ID';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.procedure_name     IS '存储过程名称（冗余）';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.source_table_id    IS '源表ID';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.source_table_name  IS '源表名称';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.source_table_desc  IS '源表描述';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.schema_id          IS '所属数据库 schema 的ID';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.created_at         IS '创建时间';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.updated_at         IS '修改时间';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.created_by         IS '创建人';
COMMENT ON COLUMN meta_data_ds.metadata_procedure_source_table.updated_by         IS '修改人';