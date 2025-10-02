所有逻辑或物理复制槽的状态信息
```
SELECT * FROM pg_replication_slots;
```

* active = t 表示这个复制槽当前正在被使用（即有客户端正在消费数据）；
* slot_type = logical 表示这是一个逻辑复制槽，常用于 逻辑解码、发布/订阅机制（logical replication / pgoutput） 或第三方工具（如 Debezium、pgoutput、Bottled Water 等）。

 查看当前槽的进度
 ```
 -- 当前 WAL 写入位置
SELECT pg_current_wal_lsn();

-- 槽的 confirmed_flush_lsn
SELECT slot_name, confirmed_flush_lsn FROM pg_replication_slots;
 ```

 查看活跃连接（逻辑复制订阅者）
 ```
 SELECT * FROM pg_stat_replication;
 ```

 对于逻辑订阅者也可以：
 ```
 SELECT * FROM pg_stat_subscription;
 ```

 1. 检查是否活跃 (active)
 ```
 SELECT slot_name, active FROM pg_replication_slots;
 ```

2. 检查是否为订阅生成的槽（订阅不可直接删槽）
```
SELECT subname, slot_name FROM pg_subscription;
```
* 如果 pg_subscription.slot_name 和你要删除的槽名一致，不能直接删槽！
* 正确方式是：
```
ALTER SUBSCRIPTION your_subscription_name SET (slot_name = NONE); -- 断开槽绑定
DROP SUBSCRIPTION your_subscription_name;                         -- 再删除槽
```

3. 检查是否为工具创建的槽（如 Debezium、同步工具）
如果是第三方工具创建的（如 Debezium），在工具未断开连接或配置仍在使用该槽时删除，会造成同步失败。你可以：
•	关闭对应的工具服务

•	确认 pg_replication_slots.active = false

•	然后执行：
```
SELECT pg_drop_replication_slot('your_slot_name');
```

如果强删活跃槽会报错：
```
ERROR: replication slot "xxx" is active for PID xxxx
```

 示例流程：判断并删除逻辑复制槽
 ```
-- 1. 查看复制槽
SELECT * FROM pg_replication_slots WHERE slot_name = 'your_slot';

-- 2. 查看是否与订阅绑定
SELECT * FROM pg_subscription WHERE slot_name = 'your_slot';

-- 3. 查看是否活跃
-- 如果 active = false，且不是订阅槽，可以删除：
SELECT pg_drop_replication_slot('your_slot');
```


总结：是否可以删除逻辑槽的判断依据
条件
可否删除
active = true
❌ 否，必须断开客户端连接
绑定在 pg_subscription 上
❌ 否，应先取消订阅
active = false 且不是系统订阅
✅ 可以删除



正确的删除流程（不建议强删）
情况 1：你想删除整个订阅（包括槽）
```
-- 断开槽绑定（可选，但更稳妥）
ALTER SUBSCRIPTION your_subscription_name SET (slot_name = NONE);

-- 删除订阅，同时自动清除对应 replication slot
DROP SUBSCRIPTION your_subscription_name;
```
注意：这将同时中断订阅数据同步。

情况 2：你只想释放这个槽（但保留订阅）
```
-- 将订阅槽解绑（会停止使用当前槽）
ALTER SUBSCRIPTION your_subscription_name SET (slot_name = NONE);
```

这不会删除槽，但 PostgreSQL 就不再使用它。你可以再确认：
```
SELECT * FROM pg_replication_slots WHERE slot_name = 'your_slot';
```

若 active = false，即可删除：
```
SELECT pg_drop_replication_slot('your_slot');
```

查询逻辑复制槽的消费方（逻辑订阅/工具）
```
SELECT pid, usename, application_name, client_addr, backend_start, state, query
FROM pg_stat_activity
WHERE backend_type = 'walsender';
```

查询所有活跃的逻辑复制槽
```
SELECT slot_name, active, active_pid
FROM pg_replication_slots
WHERE active = true AND slot_type = 'logical';
```

然后结合 active_pid 和 pg_stat_activity 查询：
```
SELECT pid, usename, application_name, client_addr, backend_start
FROM pg_stat_activity
WHERE pid = <active_pid>;
```

你也可以直接联表查询：
```
SELECT s.slot_name, s.active, s.active_pid,
       a.usename, a.client_addr, a.application_name, a.backend_start
FROM pg_replication_slots s
LEFT JOIN pg_stat_activity a
  ON s.active_pid = a.pid
WHERE s.active = true AND s.slot_type = 'logical';
```