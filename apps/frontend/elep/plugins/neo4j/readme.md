删除所有数据

```
MATCH (n)
DETACH DELETE n
```

查找所有下游（不限定关系类型）
• [*] ：表示任意长度的路径
• -> ：表示单向（只查下游）
• 如果是无向关系可以用 -[]-
• 起点可以根据条件查找，比如按 name：

```
MATCH (startNode:Table {name: 'dm.ods_orders'})
MATCH path = (startNode)-[*]->(downstream)
RETURN path
```

向上查找所有上游节点（不限制路径长度）

```
MATCH (target:dl_Table {name: 'dm_api_01'})
MATCH path = (upstream)-[*]->(target)
RETURN path
```

# new

### 根据表名dm.table_ads_1开始双向溯源，限制5跳

```
MATCH path = (start:Table {id: 'dm.table_ads_1'})-[*1..5]-(other:Table)
RETURN path
```

### 以dm.table_ads_1为起点，向下2跳

```
MATCH p=(a:Table {id: 'dm.table_ads_1'})-[r:LINEAGE_TO*1..2]->(b:Table)
RETURN a, b, r
```

### 以dm.table_ads_1为起点，向上2跳

从 a → ... → b 的路径中，b 是你目标表 dm.table_ads_1，即“向上”查找它的来源表。

```
MATCH p=(a:Table)-[r:LINEAGE_TO*1..2]->(b:Table)
WHERE b.id = 'dm.table_ads_1'
RETURN a, b, r
```

### 查询图中所有“有关系连线”的实体节点，也就是参与至少一条 LINEAGE_TO 关系的所有表（Table 类型节点）。

```
MATCH (t:Table)-[:LINEAGE_TO]-()
RETURN DISTINCT t
```

• -[:LINEAGE_TO]-()：匹配任何方向上与其他节点存在 LINEAGE_TO 关系的 Table 节点
• DISTINCT t：去重

### 查询图中所有有连线的实体（如表），统计每个实体关联的关系数量（不限关系类型，比如 LINEAGE_TO、HAS_FIELD 等），并按名称输出。

```
MATCH (n)-[r]-()
RETURN n.name AS name, count(r) AS relationCount
ORDER BY relationCount DESC
```

| 字段     | 含义                                       |
| -------- | ------------------------------------------ |
| n.name   | 实体节点的名称                             |
| count(r) | 该实体参与的所有关系数量（无论方向，类型） |
| order by | 默认按照关系数降序                         |

### 限定某种类型的节点（如只统计表）

```
MATCH (t:Table)-[r]-()
RETURN t.id AS id, t.name AS name, count(r) AS relationCount
ORDER BY relationCount DESC
```

### 限定某类关系（如只看 LINEAGE_TO）

```
MATCH (t:Table)-[r:LINEAGE_TO]-()
RETURN t.id AS id, t.name AS name, count(r) AS lineageCount
ORDER BY lineageCount DESC
```
