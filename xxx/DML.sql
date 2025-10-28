-- =============================================
-- 元数据测试数据（可重复执行）
-- =============================================
-- 1) metadata_schema（数据库实例/Schema）
INSERT INTO
  meta_data_ds.metadata_schema (id, schema_name, schema_desc)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'app_public',
    '应用在线库'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'dw',
    '数仓'
  )
ON CONFLICT (id) DO NOTHING;

-- 2) metadata_table（数据表）
INSERT INTO
  meta_data_ds.metadata_table (id, table_name, table_desc, table_type, schema_id)
VALUES
  (
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0001',
    'users',
    '用户基本信息',
    'base',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0002',
    'orders',
    '订单主表',
    'base',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0003',
    'order_items',
    '订单明细表',
    'base',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0004',
    'inventory',
    '库存表',
    'base',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0005',
    'fct_order',
    '订单事实表(汇总)',
    'base',
    '22222222-2222-4222-8222-222222222222'
  )
ON CONFLICT (id) DO NOTHING;

-- 3) metadata_table_field（表字段）
INSERT INTO
  meta_data_ds.metadata_table_field (
    id,
    table_id,
    field_name,
    field_type,
    field_desc,
    default_value,
    length
  )
VALUES
  -- users
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0001',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0001',
    'user_id',
    'uuid',
    '用户ID',
    NULL,
    NULL
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0002',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0001',
    'name',
    'varchar',
    '姓名',
    NULL,
    128
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0003',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0001',
    'email',
    'varchar',
    '邮箱',
    NULL,
    256
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0004',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0001',
    'created_at',
    'timestamptz',
    '创建时间',
    NULL,
    NULL
  ),
  -- orders
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0101',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0002',
    'order_id',
    'uuid',
    '订单ID',
    NULL,
    NULL
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0102',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0002',
    'user_id',
    'uuid',
    '用户ID',
    NULL,
    NULL
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0103',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0002',
    'amount',
    'numeric(12,2)',
    '订单金额',
    NULL,
    NULL
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0104',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0002',
    'status',
    'varchar',
    '订单状态',
    NULL,
    32
  ),
  -- order_items
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0201',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0003',
    'order_id',
    'uuid',
    '订单ID',
    NULL,
    NULL
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0202',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0003',
    'sku',
    'varchar',
    'SKU编码',
    NULL,
    64
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0203',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0003',
    'qty',
    'int4',
    '数量',
    '0',
    NULL
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0204',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0003',
    'price',
    'numeric(10,2)',
    '单价',
    NULL,
    NULL
  ),
  -- inventory
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0301',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0004',
    'sku',
    'varchar',
    'SKU编码',
    NULL,
    64
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0302',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0004',
    'warehouse',
    'varchar',
    '仓库',
    NULL,
    64
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0303',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0004',
    'stock',
    'int4',
    '库存数量',
    '0',
    NULL
  ),
  -- fct_order
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0401',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0005',
    'dt',
    'date',
    '统计日期',
    NULL,
    NULL
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0402',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0005',
    'order_cnt',
    'int8',
    '订单数',
    '0',
    NULL
  ),
  (
    'bbbbbbbb-0000-4000-8000-bbbbbbbb0403',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0005',
    'gmv',
    'numeric(14,2)',
    'GMV',
    '0',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- 4) metadata_procedure（存储过程）
INSERT INTO
  meta_data_ds.metadata_procedure (
    id,
    procedure_name,
    procedure_desc,
    schema_id,
    procedure_script,
    input_params_text,
    output_params_text
  )
VALUES
  (
    'cccccccc-0000-4000-8000-cccccccc0001',
    'sp_sync_orders',
    '同步订单到数仓',
    '22222222-2222-4222-8222-222222222222',
    'insert into dw.fct_order(dt, order_cnt, gmv) select CURRENT_DATE, count(*), sum(amount) from app_public.orders;',
    '无',
    '无'
  ),
  (
    'cccccccc-0000-4000-8000-cccccccc0002',
    'sp_agg_inventory',
    '按SKU聚合库存',
    '11111111-1111-4111-8111-111111111111',
    'select sku, sum(stock) stock from app_public.inventory group by 1;',
    '无',
    'sku, stock'
  )
ON CONFLICT (id) DO NOTHING;

-- 5) metadata_procedure_source_table / target_table（血缘）
INSERT INTO
  meta_data_ds.metadata_procedure_source_table (
    id,
    procedure_id,
    procedure_name,
    source_table_id,
    source_table_name,
    source_table_desc,
    schema_id
  )
VALUES
  (
    'dddddddd-0000-4000-8000-dddddddd0001',
    'cccccccc-0000-4000-8000-cccccccc0001',
    'sp_sync_orders',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0002',
    'orders',
    '订单主表',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'dddddddd-0000-4000-8000-dddddddd0002',
    'cccccccc-0000-4000-8000-cccccccc0002',
    'sp_agg_inventory',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0004',
    'inventory',
    '库存表',
    '11111111-1111-4111-8111-111111111111'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO
  meta_data_ds.metadata_procedure_target_table (
    id,
    procedure_id,
    procedure_name,
    target_table_id,
    target_table_name,
    target_table_desc,
    schema_id
  )
VALUES
  (
    'eeeeeeee-0000-4000-8000-eeeeeeee0001',
    'cccccccc-0000-4000-8000-cccccccc0001',
    'sp_sync_orders',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0005',
    'fct_order',
    '订单事实表',
    '22222222-2222-4222-8222-222222222222'
  )
ON CONFLICT (id) DO NOTHING;

-- 6) metadata_api（接口）
-- 6.1 UserService: GET /users/{id}
INSERT INTO
  meta_data_ds.metadata_api (
    id,
    api_name,
    api_path,
    api_method,
    api_desc,
    microservice_name,
    request_example,
    response_example
  )
VALUES
  (
    '99999999-0000-4000-8000-999999990001',
    '获取用户',
    '/users/{id}',
    'GET',
    '根据用户ID获取用户信息',
    'user-service',
    '{"path":{"id":"0f9c..."},"query":{}}',
    '{"id":"u_1","name":"Alice","email":"a@example.com","addresses":[{"street":"No.1","city":"SZ"}]}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 6.2 OrderService: POST /orders （调用三方支付 & 写订单表）
INSERT INTO
  meta_data_ds.metadata_api (
    id,
    api_name,
    api_path,
    api_method,
    api_desc,
    microservice_name,
    request_example,
    response_example
  )
VALUES
  (
    '99999999-0000-4000-8000-999999990002',
    '创建订单',
    '/orders',
    'POST',
    '创建订单并支付',
    'order-service',
    '{"body":{"userId":"uuid","items":[{"sku":"S1","qty":2,"price":19.9}]}}',
    '{"orderId":"o_1001","status":"PAID"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 6.3 InventoryService: PATCH /inventory/bulk （批量更新库存）
INSERT INTO
  meta_data_ds.metadata_api (
    id,
    api_name,
    api_path,
    api_method,
    api_desc,
    microservice_name,
    request_example,
    response_example
  )
VALUES
  (
    '99999999-0000-4000-8000-999999990003',
    '批量更新库存',
    '/inventory/bulk',
    'PATCH',
    '批量更新多个SKU的库存',
    'inventory-service',
    '{"body":[{"sku":"S1","warehouse":"W1","delta":-2},{"sku":"S2","warehouse":"W2","delta":10}]}',
    '{"updated":2,"skipped":0}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 6.4 ReportService: GET /reports/orders （调用存储过程，返回数组）
INSERT INTO
  meta_data_ds.metadata_api (
    id,
    api_name,
    api_path,
    api_method,
    api_desc,
    microservice_name,
    request_example,
    response_example
  )
VALUES
  (
    '99999999-0000-4000-8000-999999990004',
    '订单报表',
    '/reports/orders',
    'GET',
    '按日期返回订单汇总',
    'report-service',
    '{"query":{"date":"2025-01-01"}}',
    '{"date":"2025-01-01","summary":[{"sku":"S1","amount":199.00}]}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 7) metadata_api_field（接口字段：入/出参，含嵌套）
-- 7.1 GET /users/{id}
-- in: path.id
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    item_data_type,
    field_desc,
    required,
    default_value,
    example_value,
    length,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'f1f1f1f1-1000-4000-8000-f1f1f1f10001',
    '99999999-0000-4000-8000-999999990001',
    'id',
    'in',
    'string',
    false,
    NULL,
    '路径参数：用户ID(UUID)',
    true,
    NULL,
    '2d1b2b9c-7b7a-4c3a-8a12-aaaaaaaaaaaa',
    36,
    NULL,
    'path.id',
    0,
    1,
    '{"format":"uuid"}'
  );

-- out: body(user object)
-- root body
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'f1f1f1f1-1000-4000-8000-f1f1f1f10002',
    '99999999-0000-4000-8000-999999990001',
    'body',
    'out',
    'object',
    false,
    '响应体',
    true,
    NULL,
    'body',
    0,
    1
  );

-- body.user
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'f1f1f1f1-1000-4000-8000-f1f1f1f10003',
    '99999999-0000-4000-8000-999999990001',
    'user',
    'out',
    'object',
    false,
    '用户对象',
    true,
    'f1f1f1f1-1000-4000-8000-f1f1f1f10002',
    'body.user',
    1,
    1
  );

-- body.user.id/name/email
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'f1f1f1f1-1000-4000-8000-f1f1f1f10004',
    '99999999-0000-4000-8000-999999990001',
    'id',
    'out',
    'string',
    false,
    '用户ID',
    true,
    'f1f1f1f1-1000-4000-8000-f1f1f1f10003',
    'body.user.id',
    2,
    1,
    '{"format":"uuid"}'
  ),
  (
    'f1f1f1f1-1000-4000-8000-f1f1f1f10005',
    '99999999-0000-4000-8000-999999990001',
    'name',
    'out',
    'string',
    false,
    '姓名',
    true,
    'f1f1f1f1-1000-4000-8000-f1f1f1f10003',
    'body.user.name',
    2,
    2,
    '{"minLength":1,"maxLength":128}'
  ),
  (
    'f1f1f1f1-1000-4000-8000-f1f1f1f10006',
    '99999999-0000-4000-8000-999999990001',
    'email',
    'out',
    'string',
    false,
    '邮箱',
    false,
    'f1f1f1f1-1000-4000-8000-f1f1f1f10003',
    'body.user.email',
    2,
    3,
    '{"format":"email"}'
  );

-- body.user.addresses (array<object>)
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    item_data_type,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'f1f1f1f1-1000-4000-8000-f1f1f1f10007',
    '99999999-0000-4000-8000-999999990001',
    'addresses',
    'out',
    'array',
    true,
    'object',
    '地址列表',
    false,
    'f1f1f1f1-1000-4000-8000-f1f1f1f10003',
    'body.user.addresses',
    2,
    4,
    '{"minItems":0}'
  );

-- body.user.addresses[0] 作为 items 占位
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'f1f1f1f1-1000-4000-8000-f1f1f1f10008',
    '99999999-0000-4000-8000-999999990001',
    'items',
    'out',
    'object',
    false,
    '地址元素',
    false,
    'f1f1f1f1-1000-4000-8000-f1f1f1f10007',
    'body.user.addresses[0]',
    3,
    1
  );

-- items.street / items.city
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'f1f1f1f1-1000-4000-8000-f1f1f1f10009',
    '99999999-0000-4000-8000-999999990001',
    'street',
    'out',
    'string',
    false,
    '街道',
    true,
    'f1f1f1f1-1000-4000-8000-f1f1f1f10008',
    'body.user.addresses[0].street',
    4,
    1,
    '{"minLength":1}'
  ),
  (
    'f1f1f1f1-1000-4000-8000-f1f1f1f10010',
    '99999999-0000-4000-8000-999999990001',
    'city',
    'out',
    'string',
    false,
    '城市',
    true,
    'f1f1f1f1-1000-4000-8000-f1f1f1f10008',
    'body.user.addresses[0].city',
    4,
    2,
    NULL
  );

-- 7.2 POST /orders
-- in: body (order)
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'a1a1a1a1-2000-4000-8000-a1a1a1a12001',
    '99999999-0000-4000-8000-999999990002',
    'body',
    'in',
    'object',
    false,
    '创建订单请求体',
    true,
    NULL,
    'body',
    0,
    1
  );

-- body.userId, body.items (array<object>)
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    item_data_type,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'a1a1a1a1-2000-4000-8000-a1a1a1a12002',
    '99999999-0000-4000-8000-999999990002',
    'userId',
    'in',
    'string',
    false,
    NULL,
    '用户ID',
    true,
    'a1a1a1a1-2000-4000-8000-a1a1a1a12001',
    'body.userId',
    1,
    1,
    '{"format":"uuid"}'
  ),
  (
    'a1a1a1a1-2000-4000-8000-a1a1a1a12003',
    '99999999-0000-4000-8000-999999990002',
    'items',
    'in',
    'array',
    true,
    'object',
    '订单明细',
    true,
    'a1a1a1a1-2000-4000-8000-a1a1a1a12001',
    'body.items',
    1,
    2,
    '{"minItems":1}'
  );

-- body.items[0] as items
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'a1a1a1a1-2000-4000-8000-a1a1a1a12004',
    '99999999-0000-4000-8000-999999990002',
    'items',
    'in',
    'object',
    false,
    '订单明细元素',
    true,
    'a1a1a1a1-2000-4000-8000-a1a1a1a12003',
    'body.items[0]',
    2,
    1
  );

-- items.sku/qty/price
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'a1a1a1a1-2000-4000-8000-a1a1a1a12005',
    '99999999-0000-4000-8000-999999990002',
    'sku',
    'in',
    'string',
    false,
    'SKU',
    true,
    'a1a1a1a1-2000-4000-8000-a1a1a1a12004',
    'body.items[0].sku',
    3,
    1,
    '{"minLength":1}'
  ),
  (
    'a1a1a1a1-2000-4000-8000-a1a1a1a12006',
    '99999999-0000-4000-8000-999999990002',
    'qty',
    'in',
    'integer',
    false,
    '数量',
    true,
    'a1a1a1a1-2000-4000-8000-a1a1a1a12004',
    'body.items[0].qty',
    3,
    2,
    '{"minimum":1}'
  ),
  (
    'a1a1a1a1-2000-4000-8000-a1a1a1a12007',
    '99999999-0000-4000-8000-999999990002',
    'price',
    'in',
    'number',
    false,
    '单价',
    true,
    'a1a1a1a1-2000-4000-8000-a1a1a1a12004',
    'body.items[0].price',
    3,
    3,
    '{"minimum":0}'
  );

-- out: body.orderId/status (enum)
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'a1a1a1a1-2000-4000-8000-a1a1a1a12008',
    '99999999-0000-4000-8000-999999990002',
    'body',
    'out',
    'object',
    false,
    '响应体',
    true,
    NULL,
    'body',
    0,
    1,
    NULL
  );

INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'a1a1a1a1-2000-4000-8000-a1a1a1a12009',
    '99999999-0000-4000-8000-999999990002',
    'orderId',
    'out',
    'string',
    false,
    '订单ID',
    true,
    'a1a1a1a1-2000-4000-8000-a1a1a1a12008',
    'body.orderId',
    1,
    1
  );

INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'a1a1a1a1-2000-4000-8000-a1a1a1a12010',
    '99999999-0000-4000-8000-999999990002',
    'status',
    'out',
    'string',
    false,
    '订单状态',
    true,
    'a1a1a1a1-2000-4000-8000-a1a1a1a12008',
    'body.status',
    1,
    2,
    '{"enum":["PAID","PENDING","FAILED"]}'
  );

-- 7.3 PATCH /inventory/bulk
-- in: body (array<object>)
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    item_data_type,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'b2b2b2b2-3000-4000-8000-b2b2b2b23001',
    '99999999-0000-4000-8000-999999990003',
    'body',
    'in',
    'array',
    true,
    'object',
    '批量库存更新',
    true,
    NULL,
    'body',
    0,
    1,
    '{"minItems":1}'
  );

-- body[0]
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'b2b2b2b2-3000-4000-8000-b2b2b2b23002',
    '99999999-0000-4000-8000-999999990003',
    'items',
    'in',
    'object',
    false,
    '单条库存更新',
    true,
    'b2b2b2b2-3000-4000-8000-b2b2b2b23001',
    'body[0]',
    1,
    1
  );

-- body[0].sku / warehouse / delta
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'b2b2b2b2-3000-4000-8000-b2b2b2b23003',
    '99999999-0000-4000-8000-999999990003',
    'sku',
    'in',
    'string',
    false,
    'SKU',
    true,
    'b2b2b2b2-3000-4000-8000-b2b2b2b23002',
    'body[0].sku',
    2,
    1,
    '{"minLength":1}'
  ),
  (
    'b2b2b2b2-3000-4000-8000-b2b2b2b23004',
    '99999999-0000-4000-8000-999999990003',
    'warehouse',
    'in',
    'string',
    false,
    '仓库',
    true,
    'b2b2b2b2-3000-4000-8000-b2b2b2b23002',
    'body[0].warehouse',
    2,
    2,
    '{"minLength":1}'
  ),
  (
    'b2b2b2b2-3000-4000-8000-b2b2b2b23005',
    '99999999-0000-4000-8000-999999990003',
    'delta',
    'in',
    'integer',
    false,
    '增减量(可负数)',
    true,
    'b2b2b2b2-3000-4000-8000-b2b2b2b23002',
    'body[0].delta',
    2,
    3,
    '{"minimum":-99999,"maximum":99999}'
  );

-- out: body.updated / skipped
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'b2b2b2b2-3000-4000-8000-b2b2b2b23006',
    '99999999-0000-4000-8000-999999990003',
    'body',
    'out',
    'object',
    false,
    '响应体',
    true,
    NULL,
    'body',
    0,
    1
  ),
  (
    'b2b2b2b2-3000-4000-8000-b2b2b2b23007',
    '99999999-0000-4000-8000-999999990003',
    'updated',
    'out',
    'integer',
    false,
    '已更新条数',
    true,
    'b2b2b2b2-3000-4000-8000-b2b2b2b23006',
    'body.updated',
    1,
    1
  ),
  (
    'b2b2b2b2-3000-4000-8000-b2b2b2b23008',
    '99999999-0000-4000-8000-999999990003',
    'skipped',
    'out',
    'integer',
    false,
    '跳过条数',
    true,
    'b2b2b2b2-3000-4000-8000-b2b2b2b23006',
    'body.skipped',
    1,
    2
  );

-- 7.4 GET /reports/orders
-- in: query.date
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'c3c3c3c3-4000-4000-8000-c3c3c3c34001',
    '99999999-0000-4000-8000-999999990004',
    'date',
    'in',
    'string',
    false,
    '查询日期',
    true,
    NULL,
    'query.date',
    0,
    1,
    '{"format":"date"}'
  );

-- out: body.date / summary(array<object>)
INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'c3c3c3c3-4000-4000-8000-c3c3c3c34002',
    '99999999-0000-4000-8000-999999990004',
    'body',
    'out',
    'object',
    false,
    '响应体',
    true,
    NULL,
    'body',
    0,
    1
  ),
  (
    'c3c3c3c3-4000-4000-8000-c3c3c3c34003',
    '99999999-0000-4000-8000-999999990004',
    'date',
    'out',
    'string',
    false,
    '日期',
    true,
    'c3c3c3c3-4000-4000-8000-c3c3c3c34002',
    'body.date',
    1,
    1
  );

INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    item_data_type,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'c3c3c3c3-4000-4000-8000-c3c3c3c34004',
    '99999999-0000-4000-8000-999999990004',
    'summary',
    'out',
    'array',
    true,
    'object',
    '汇总列表',
    true,
    'c3c3c3c3-4000-4000-8000-c3c3c3c34002',
    'body.summary',
    1,
    2
  );

INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq
  )
VALUES
  (
    'c3c3c3c3-4000-4000-8000-c3c3c3c34005',
    '99999999-0000-4000-8000-999999990004',
    'items',
    'out',
    'object',
    false,
    '汇总元素',
    true,
    'c3c3c3c3-4000-4000-8000-c3c3c3c34004',
    'body.summary[0]',
    2,
    1
  );

INSERT INTO
  meta_data_ds.metadata_api_field (
    id,
    api_id,
    field_name,
    io_type,
    data_type,
    is_array,
    field_desc,
    required,
    parent_field_id,
    path,
    level,
    seq,
    rule_ext
  )
VALUES
  (
    'c3c3c3c3-4000-4000-8000-c3c3c3c34006',
    '99999999-0000-4000-8000-999999990004',
    'sku',
    'out',
    'string',
    false,
    'SKU',
    true,
    'c3c3c3c3-4000-4000-8000-c3c3c3c34005',
    'body.summary[0].sku',
    3,
    1,
    '{"minLength":1}'
  ),
  (
    'c3c3c3c3-4000-4000-8000-c3c3c3c34007',
    '99999999-0000-4000-8000-999999990004',
    'amount',
    'out',
    'number',
    false,
    '金额',
    true,
    'c3c3c3c3-4000-4000-8000-c3c3c3c34005',
    'body.summary[0].amount',
    3,
    2,
    '{"minimum":0}'
  );

-- 8) metadata_api_call（接口调用到资源）
-- 8.1 GET /users/{id} 读取 users 表
INSERT INTO
  meta_data_ds.metadata_api_call (
    id,
    api_id,
    resource_type,
    resource_id,
    call_params
  )
VALUES
  (
    'd1d1d1d1-5000-4000-8000-d1d1d1d15001',
    '99999999-0000-4000-8000-999999990001',
    'table',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0001',
    '{"op":"select","by":"user_id"}'
  )
ON CONFLICT (id) DO NOTHING;

-- 8.2 POST /orders 调三方支付，再写订单表和订单明细
INSERT INTO
  meta_data_ds.metadata_api_call (
    id,
    api_id,
    resource_type,
    resource_id,
    call_params
  )
VALUES
  (
    'd1d1d1d1-5000-4000-8000-d1d1d1d15002',
    '99999999-0000-4000-8000-999999990002',
    'third_party_service',
    '00000000-0000-4000-8000-000000000001',
    '{"service":"payment","action":"pay"}'
  ),
  (
    'd1d1d1d1-5000-4000-8000-d1d1d1d15003',
    '99999999-0000-4000-8000-999999990002',
    'table',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0002',
    '{"op":"insert"}'
  ),
  (
    'd1d1d1d1-5000-4000-8000-d1d1d1d15004',
    '99999999-0000-4000-8000-999999990002',
    'table',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0003',
    '{"op":"insert_batch"}'
  )
ON CONFLICT (id) DO NOTHING;

-- 8.3 PATCH /inventory/bulk 更新 inventory
INSERT INTO
  meta_data_ds.metadata_api_call (
    id,
    api_id,
    resource_type,
    resource_id,
    call_params
  )
VALUES
  (
    'd1d1d1d1-5000-4000-8000-d1d1d1d15005',
    '99999999-0000-4000-8000-999999990003',
    'table',
    'aaaaaaaa-0000-4000-8000-aaaaaaaa0004',
    '{"op":"update_bulk","key":["sku","warehouse"]}'
  )
ON CONFLICT (id) DO NOTHING;

-- 8.4 GET /reports/orders 调用存储过程 sp_sync_orders
INSERT INTO
  meta_data_ds.metadata_api_call (
    id,
    api_id,
    resource_type,
    resource_id,
    call_params
  )
VALUES
  (
    'd1d1d1d1-5000-4000-8000-d1d1d1d15006',
    '99999999-0000-4000-8000-999999990004',
    'procedure',
    'cccccccc-0000-4000-8000-cccccccc0001',
    '{"call":"sp_sync_orders","args":{"date":"$query.date"}}'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 验证建议（可选）
-- 1) 递归查看某接口的出参树（以 GET /users/{id} 为例）：
WITH RECURSIVE
  t AS (
    SELECT
      f.*,
      0 AS depth
    FROM
      meta_data_ds.metadata_api_field f
    WHERE
      api_id = '99999999-0000-4000-8000-999999990001'
      AND io_type = 'out'
      AND parent_field_id IS NULL
    UNION ALL
    SELECT
      c.*,
      t.depth + 1
    FROM
      meta_data_ds.metadata_api_field c
      JOIN t ON c.parent_field_id = t.id
  )
SELECT
  path,
  field_name,
  data_type,
  is_array,
  rule_ext
FROM
  t
ORDER BY
  path;

-- 2) 检查接口调用的血缘（以 POST /orders 为例）：
SELECT
  a.api_name,
  c.resource_type,
  t.table_name,
  p.procedure_name,
  c.call_params
FROM
  meta_data_ds.metadata_api a
  JOIN meta_data_ds.metadata_api_call c ON a.id = c.api_id
  LEFT JOIN meta_data_ds.metadata_table t ON (
    c.resource_type = 'table'
    AND c.resource_id = t.id
  )
  LEFT JOIN meta_data_ds.metadata_procedure p ON (
    c.resource_type = 'procedure'
    AND c.resource_id = p.id
  )
WHERE
  a.id = '99999999-0000-4000-8000-999999990002';