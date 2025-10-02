package com.macro.mall.tiny.neo;

import org.neo4j.driver.Value;
import org.neo4j.driver.types.Node;
import org.neo4j.driver.types.Path;
import org.neo4j.driver.types.Relationship;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 通用 G6 图谱控制器（简化版）
 * 支持执行 Cypher 查询、血缘路径分析、过滤维度表等
 */
@RestController
@RequestMapping("/test")
public class testController {

    private final MetadataSyncTask syncTask;
    private final Neo4jWriter neo4jWriter;

    public testController(MetadataSyncTask syncTask, Neo4jWriter neo4jWriter) {
        this.syncTask = syncTask;
        this.neo4jWriter = neo4jWriter;
    }


    /**
     * 核心入口接口：
     * 支持根据 tableId / tableName / sqlName 进行血缘路径分析
     * 支持方向：up / down / both
     * 支持封闭路径：closed = true
     * 支持过滤条件：nodeFilter（排除节点属性），relFilter（排除边属性）
     */
    @PostMapping("/g6/resolve")
    public Map<String, Object> resolveLineage(@RequestBody Map<String, Object> body) {
        String direction = (String) body.getOrDefault("direction", "both");
        int level = (int) body.getOrDefault("level", 2);
        boolean closed = Boolean.TRUE.equals(body.get("closed"));

        @SuppressWarnings("unchecked")
        Map<String, Object> nodeFilter = (Map<String, Object>) body.get("nodeFilter");

        @SuppressWarnings("unchecked")
        Map<String, Object> relFilter = (Map<String, Object>) body.get("relFilter");

        // 根据 tableId / tableName / sqlName 三选一解析业务 ID
        String tableId = resolveTableId(body);

        if (closed) {
            // 封闭路径（中心点为 tableId，两侧路径均返回）
            return resolveClosedLineage(tableId, level, nodeFilter, relFilter);
        } else {
            // 普通方向路径（向上/向下/双向）
            return resolveDirectionalLineage(tableId, direction, level, nodeFilter, relFilter);
        }
    }

    /**
     * 通用路径查询（非封闭）
     */
    private Map<String, Object> resolveDirectionalLineage(String tableId, String direction, int level,
                                                          Map<String, Object> nodeFilter,
                                                          Map<String, Object> relFilter) {
        String arrow;
        if ("up".equals(direction)) {
            arrow = "<-[r:LINEAGE_TO*1.." + level + "]-";
        } else if ("down".equals(direction)) {
            arrow = "-[r:LINEAGE_TO*1.." + level + "]->";
        } else {
            arrow = "-[r:LINEAGE_TO*1.." + level + "]-";
        }

        String whereClause = buildWhereClause(nodeFilter, relFilter, "n", "r");
        String cypher = "MATCH p=(n:Table {id: $tableId})" + arrow + "(m:Table) " + whereClause + " RETURN p";

        Map<String, Object> params = Collections.singletonMap("tableId", tableId);
        return buildG6FromCypher(cypher, params, tableId, nodeFilter, relFilter);
    }

    /**
     * 封闭路径查询：以 tableId 为中心点，向上和向下分别查找路径
     */
    private Map<String, Object> resolveClosedLineage(String tableId, int level,
                                                     Map<String, Object> nodeFilter,
                                                     Map<String, Object> relFilter) {
        List<Map<String, Object>> allPaths = new ArrayList<>();

        String whereUp = buildWhereClause(nodeFilter, relFilter, "a", "r");
        String whereDown = buildWhereClause(nodeFilter, relFilter, "b", "r");

        String cypherUp =
                "MATCH p=(a:Table)-[r:LINEAGE_TO*1.." + level + "]->(mid:Table {id: $tableId}) " + whereUp + " RETURN" +
                        " p";
        String cypherDown =
                "MATCH p=(mid:Table {id: $tableId})-[r:LINEAGE_TO*1.." + level + "]->(b:Table) " + whereDown + " " +
                        "RETURN p";

        Map<String, Object> param = Collections.singletonMap("tableId", tableId);

        allPaths.addAll(neo4jWriter.query(cypherUp, param));
        allPaths.addAll(neo4jWriter.query(cypherDown, param));

        Map<String, Object> result = buildG6FromPathList(allPaths);
        result.put("cypher", cypherUp + "\n" + cypherDown);
        result.put("params", param);
        result.put("startId", tableId);

        Map<String, Object> summary = new HashMap<>();
        if (nodeFilter != null && !nodeFilter.isEmpty()) summary.put("nodeFilter", nodeFilter);
        if (relFilter != null && !relFilter.isEmpty()) summary.put("relFilter", relFilter);
        result.put("filterSummary", summary);

        return result;
    }

    /**
     * 构造 WHERE 子句，根据 nodeFilter 和 relFilter 的排除逻辑
     * 示例输出：WHERE NOT n.layer IN ['dwd'] AND ALL(x IN r WHERE NOT x.sqlName IN ['xxx'])
     */
    private String buildWhereClause(Map<String, Object> nodeFilter, Map<String, Object> relFilter,
                                    String nodeAlias, String relAlias) {
        List<String> clauses = new ArrayList<>();

        if (nodeFilter != null) {
            for (Map.Entry<String, Object> entry : nodeFilter.entrySet()) {
                List<?> values = (List<?>) entry.getValue();
                if (values != null && !values.isEmpty()) {
                    clauses.add("NOT " + nodeAlias + "." + entry.getKey() + " IN " + toCypherList(values));
                }
            }
        }

        if (relFilter != null) {
            for (Map.Entry<String, Object> entry : relFilter.entrySet()) {
                List<?> values = (List<?>) entry.getValue();
                if (values != null && !values.isEmpty()) {
                    clauses.add("ALL(x IN " + relAlias + " WHERE NOT x." + entry.getKey() + " IN " + toCypherList(values) + ")");
                }
            }
        }

        return clauses.isEmpty() ? "" : "WHERE " + String.join(" AND ", clauses);
    }

    private String toCypherList(List<?> list) {
        StringBuilder sb = new StringBuilder("[");
        Iterator<?> iterator = list.iterator();
        while (iterator.hasNext()) {
            sb.append("'").append(iterator.next()).append("'");
            if (iterator.hasNext()) sb.append(", ");
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * 执行任意路径查询 Cypher 并返回 G6 格式结构（nodes + edges）
     */
    private Map<String, Object> buildG6FromCypher(String cypher, Map<String, Object> params,
                                                  String startId,
                                                  Map<String, Object> nodeFilter,
                                                  Map<String, Object> relFilter) {
        List<Map<String, Object>> raw = neo4jWriter.query(cypher, params);
        Map<String, Object> result = buildG6FromPathList(raw);
        result.put("cypher", cypher);
        result.put("params", params);
        result.put("startId", startId);

        Map<String, Object> summary = new HashMap<>();
        if (nodeFilter != null && !nodeFilter.isEmpty()) summary.put("nodeFilter", nodeFilter);
        if (relFilter != null && !relFilter.isEmpty()) summary.put("relFilter", relFilter);
        result.put("filterSummary", summary);

        return result;
    }

    /**
     * 将 Neo4j 路径查询结果统一转为 G6 格式（id/label/source/target）
     */
    private Map<String, Object> buildG6FromPathList(List<Map<String, Object>> raw) {
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        Set<String> nodeIds = new HashSet<>();
        Map<Long, String> nodeIdToBusinessId = new HashMap<>();

        for (Map<String, Object> map : raw) {
            for (Object val : map.values()) {
                if (val instanceof Path) {
                    Path path = (Path) val;
                    for (Node node : path.nodes()) {
                        String id = node.get("id").asString();
                        if (nodeIds.add(id)) {
                            Map<String, Object> nodeMap = new HashMap<>(node.asMap());
                            nodeMap.put("id", id);
                            nodeMap.put("label", node.get("name").asString());

                            String label = node.labels().iterator().next();
                            nodeMap.put("type", label);         // 保留原 label 作为类型
                            nodeMap.put("nodeType", normalizeNodeType(label)); // 新增字段，前端 legend 分类用


                            Value fieldsValue = node.get("fields");
                            System.out.println("字段类型: " + fieldsValue.type().name());
                            if (fieldsValue != null && !fieldsValue.isNull()) {
//                            if (fieldsValue.type().name().equals("LIST")) {
//                                nodeMap.put("fields", fieldsValue.asList());
//                            } else {
//                                String fieldsStr = fieldsValue.asString();
//                                // 尝试将字符串解析为 JSON 数组
//                                try {
//                                    List<String> fieldsList = JSON.parseArray(fieldsStr, String.class);
//                                    nodeMap.put("fields", fieldsList);
//                                } catch (Exception e) {
//                                    // 解析失败，保留原始字符串或设为空列表
//                                    System.out.println("字段解析失败: " + fieldsStr);
//                                    nodeMap.put("fields", Collections.emptyList());
//                                }
//                            }
                                nodeMap.put("fields", fieldsValue.asString());
                            } else {
//                            nodeMap.put("fields", "");
                            }

                            nodes.add(nodeMap);
                            nodeIdToBusinessId.put(node.id(), id);
                        }
                    }
                    for (Relationship rel : path.relationships()) {
                        Map<String, Object> edge = new HashMap<>(rel.asMap());
                        edge.put("source", nodeIdToBusinessId.getOrDefault(rel.startNodeId(),
                                String.valueOf(rel.startNodeId())));
                        edge.put("target", nodeIdToBusinessId.getOrDefault(rel.endNodeId(),
                                String.valueOf(rel.endNodeId())));
                        edge.put("label", rel.type());
                        edges.add(edge);
                    }
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        return result;
    }

    /**
     * 根据 tableId / tableName / sqlName 三选一获取业务主键 ID
     */
    private String resolveTableId(Map<String, Object> body) {
        if (body.containsKey("tableId")) return body.get("tableId").toString();

        if (body.containsKey("tableName")) {
            List<Map<String, Object>> result = neo4jWriter.query(
                    "MATCH (t:Table) WHERE t.name = $name RETURN t.id AS id",
                    Collections.singletonMap("name", body.get("tableName")));
            if (!result.isEmpty()) return result.get(0).get("id").toString();
        }

        if (body.containsKey("sqlName")) {
            List<Map<String, Object>> result = neo4jWriter.query(
                    "MATCH (a:Table)-[r:LINEAGE_TO {sqlName: $sqlName}]->(b:Table) RETURN b.id AS id",
                    Collections.singletonMap("sqlName", body.get("sqlName")));
            if (!result.isEmpty()) return result.get(0).get("id").toString();
        }

        throw new IllegalArgumentException("无法解析 tableId，请传入 tableId / tableName / sqlName 中至少一个");
    }

    private String normalizeNodeType(String label) {
        if (label == null) return "other";
        switch (label.toLowerCase()) {
            case "table":
                return "table";
            case "procedure":
                return "procedure";
            case "view":
                return "view";
            case "api":
                return "api";
            case "system":
                return "system";
            default:
                return "other";
        }
    }

    /**
     * 根据传入的属性（name / id / sqlName / taskName）删除 LINEAGE_TO 关系
     * 支持组合条件匹配删除
     * POST 请求体如：
     * {
     * "name": "sql_7",
     * "sqlName": "etl_01.sql",
     * "taskName": "daily_job"
     * }
     */
    @PostMapping("/g6/lineage/delete")
    public Map<String, Object> deleteLineageByConditions(@RequestBody Map<String, Object> body) {
        List<String> conditions = new ArrayList<>();
        Map<String, Object> params = new HashMap<>();

        if (body.containsKey("id")) {
            conditions.add("id = $id");
            params.put("id", body.get("id"));
        }
        if (body.containsKey("name")) {
            conditions.add("name = $name");
            params.put("name", body.get("name"));
        }
        if (body.containsKey("sqlName")) {
            conditions.add("sqlName = $sqlName");
            params.put("sqlName", body.get("sqlName"));
        }
        if (body.containsKey("taskName")) {
            conditions.add("taskName = $taskName");
            params.put("taskName", body.get("taskName"));
        }

        if (conditions.isEmpty()) {
            return Collections.singletonMap("error", "必须提供至少一个条件字段（name/id/sqlName/taskName）");
        }

        String whereClause = String.join(" AND ", conditions);
        String cypher = "MATCH ()-[r:LINEAGE_TO]->() WHERE " + whereClause + " DELETE r RETURN count(r) as deleted";

        List<Map<String, Object>> result = neo4jWriter.query(cypher, params);
        if (!result.isEmpty()) {
            return Collections.singletonMap("deleted", result.get(0).get("deleted"));
        } else {
            return Collections.singletonMap("deleted", 0);
        }
    }



    /**
     * 查询实体节点及其关系数量，支持 POST + JSON 请求体（包含 label、属性条件、excludeZero）
     * 请求示例：
     * {
     *   "label": "Table",
     *   "excludeZero": true,
     *   "schema": "ods"
     * }
     */
    @PostMapping("/g6/stats/relationCountByCondition")
    public List<Map<String, Object>> postRelationCountByCondition(@RequestBody Map<String, Object> body) {
        String label = body.containsKey("label") ? String.valueOf(body.get("label")) : null;
        boolean excludeZero = body.containsKey("excludeZero") && Boolean.parseBoolean(String.valueOf(body.get("excludeZero")));

        StringBuilder cypher = new StringBuilder();
        Map<String, Object> params = new HashMap<>();

        if (label != null && !label.isEmpty()) {
            cypher.append("MATCH (n:").append(label).append(") ");
        } else {
            cypher.append("MATCH (n) ");
        }

        List<String> conditions = new ArrayList<>();
        for (Map.Entry<String, Object> entry : body.entrySet()) {
            String key = entry.getKey();
            if (!"label".equals(key) && !"excludeZero".equals(key)) {
                conditions.add("n." + key + " = $" + key);
                params.put(key, entry.getValue());
            }
        }

        if (!conditions.isEmpty()) {
            cypher.append("WHERE ").append(String.join(" AND ", conditions)).append(" ");
        }

        cypher.append("OPTIONAL MATCH (n)-[r]-() WITH n, count(r) AS relationCount ");
        if (excludeZero) {
            cypher.append("WHERE relationCount > 0 ");
        }
        cypher.append("RETURN n.id AS id, n.name AS name, labels(n)[0] AS type, relationCount ORDER BY relationCount DESC");

        return neo4jWriter.query(cypher.toString(), params);
    }

    /**
     * 查询所有存在的关系 name，并按关系类型分组输出
     * 例如：LINEAGE_TO -> [sql_1, sql_2], HAS_FIELD -> [ref, own]
     */
    @GetMapping("/g6/stats/relationNameGroup")
    public Map<String, List<String>> getAllRelationNamesByType() {
        String cypher = "MATCH ()-[r]-() WHERE exists(r.name) RETURN DISTINCT type(r) AS relType, r.name AS name";
        List<Map<String, Object>> result = neo4jWriter.query(cypher, new HashMap<>());

        Map<String, List<String>> grouped = new HashMap<>();
        for (Map<String, Object> row : result) {
            String type = String.valueOf(row.get("relType"));
            String name = String.valueOf(row.get("name"));
            grouped.computeIfAbsent(type, k -> new ArrayList<>()).add(name);
        }
        return grouped;
    }


    /**
     * 根据关系 name 查询所有依赖路径（不限关系类型），返回 G6 图结构
     * POST 请求体：{"name": "sql_7"}
     */
    @PostMapping("/g6/lineage/byRelName")
    public Map<String, Object> getLineageByRelationName(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return Collections.singletonMap("error", "name 参数不能为空");
        }

        String cypher = "MATCH (a)-[r]->(b) WHERE r.name = $name RETURN a, b, r";
        List<Map<String, Object>> raw = neo4jWriter.query(cypher, Collections.singletonMap("name", name));

        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        Set<String> nodeIds = new HashSet<>();

        for (Map<String, Object> row : raw) {
            org.neo4j.driver.types.Node a = (org.neo4j.driver.types.Node) row.get("a");
            org.neo4j.driver.types.Node b = (org.neo4j.driver.types.Node) row.get("b");
            org.neo4j.driver.types.Relationship r = (org.neo4j.driver.types.Relationship) row.get("r");

            for (org.neo4j.driver.types.Node node : Arrays.asList(a, b)) {
                String id = node.get("id").asString();
                if (nodeIds.add(id)) {
                    Map<String, Object> nodeMap = new HashMap<>(node.asMap());
                    nodeMap.put("id", id);
                    nodeMap.put("label", node.get("name").asString());
                    nodeMap.put("type", node.labels().iterator().next());
                    nodes.add(nodeMap);
                }
            }

            Map<String, Object> edge = new HashMap<>(r.asMap());
            edge.put("source", a.get("id").asString());
            edge.put("target", b.get("id").asString());
            edge.put("label", r.type());
            edges.add(edge);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        return result;
    }

    /**
     * 创建实体节点，POST 请求体结构：
     * {
     *   "label": "Table",       // 可选，默认 "Entity"
     *   "id": "ods.orders",     // 可选，不传则自动生成 UUID
     *   "name": "orders",       // 可选，不传则使用 id 或 UUID
     *   "properties": {
     *     "schema": "ods",
     *     "layer": "dwd",
     *     "type": "table"
     *   }
     * }
     */
    @PostMapping("/g6/entity/create")
    public Map<String, Object> createEntity(@RequestBody Map<String, Object> body) {
        String label = (String) body.getOrDefault("label", "Entity");
        String id = (String) body.get("id");
        String name = (String) body.get("name");
        Map<String, Object> props = (Map<String, Object>) body.get("properties");

        if (props == null) props = new HashMap<>();

        if (id == null || id.trim().isEmpty()) {
            id = UUID.randomUUID().toString();
        }
        if (name == null || name.trim().isEmpty()) {
            name = id;
        }

        props.put("id", id);
        props.put("name", name);

        StringBuilder cypher = new StringBuilder("CREATE (n:").append(label).append(" {");
        List<String> assignments = new ArrayList<>();
        Map<String, Object> params = new HashMap<>();

        for (Map.Entry<String, Object> entry : props.entrySet()) {
            String key = entry.getKey();
            assignments.add(key + ": $" + key);
            params.put(key, entry.getValue());
        }

        cypher.append(String.join(", ", assignments)).append("}) RETURN properties(n) AS properties, labels(n)[0] AS type");

        List<Map<String, Object>> result = neo4jWriter.query(cypher.toString(), params);
        if (result.isEmpty()) return Collections.singletonMap("error", "创建失败");

        Map<String, Object> row = result.get(0);
        Map<String, Object> createdProps = (Map<String, Object>) row.get("properties");

        Map<String, Object> response = new HashMap<>();
        response.put("id", createdProps.get("id"));
        response.put("label", createdProps.get("name"));
        response.put("type", row.get("type"));
        response.put("properties", createdProps);
        return response;
    }


    /**
     * 更新实体节点属性
     * 请求体：{"label": "Table", "id": "ods.orders", "properties": {"layer": "dws"}}
     */
    @PostMapping("/g6/entity/update")
    public Map<String, Object> updateEntity(@RequestBody Map<String, Object> body) {
        String label = (String) body.getOrDefault("label", "Entity");
        String id = (String) body.get("id");
        Map<String, Object> props = (Map<String, Object>) body.get("properties");

        if (id == null || props == null || props.isEmpty()) {
            return Collections.singletonMap("error", "必须提供 id 和 properties");
        }

        StringBuilder cypher = new StringBuilder("MATCH (n:").append(label).append(" {id: $id}) SET ");
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        List<String> sets = new ArrayList<>();

        for (Map.Entry<String, Object> entry : props.entrySet()) {
            sets.add("n." + entry.getKey() + " = $" + entry.getKey());
            params.put(entry.getKey(), entry.getValue());
        }

        cypher.append(String.join(", ", sets)).append(" RETURN properties(n) AS properties, labels(n)[0] AS type");
        List<Map<String, Object>> result = neo4jWriter.query(cypher.toString(), params);

        if (result.isEmpty()) return Collections.singletonMap("error", "更新失败或未找到节点");
        Map<String, Object> row = result.get(0);
        Map<String, Object> createdProps = (Map<String, Object>) row.get("properties");
        Map<String, Object> response = new HashMap<>();
        response.put("id", createdProps.get("id"));
        response.put("label", createdProps.get("name"));
        response.put("type", row.get("type"));
        response.put("properties", createdProps);
        return response;
    }

    /**
     * 删除实体节点
     * 请求体：{"label": "Table", "id": "ods.orders"}
     */
    @PostMapping("/g6/entity/delete")
    public Map<String, Object> deleteEntity(@RequestBody Map<String, Object> body) {
        String label = (String) body.getOrDefault("label", "Entity");
        String id = (String) body.get("id");

        if (id == null || id.trim().isEmpty()) {
            return Collections.singletonMap("error", "id 参数不能为空");
        }

        String cypher = "MATCH (n:" + label + " {id: $id}) DETACH DELETE n RETURN count(n) AS deleted";
        List<Map<String, Object>> result = neo4jWriter.query(cypher, Collections.singletonMap("id", id));
        return result.isEmpty() ? Collections.singletonMap("deleted", 0) : result.get(0);
    }

    /**
     * 创建或更新关系（根据起点/终点/id），支持传递 name、type、sqlName、taskName 等属性
     * 请求体：{
     *   "from": "ods.orders",
     *   "to": "dwd.order_summary",
     *   "type": "LINEAGE_TO",
     *   "properties": {"name": "sql_7", "sqlName": "ods2dwd.sql"}
     * }
     */
    @PostMapping("/g6/relation/createOrUpdate")
    public Map<String, Object> createOrUpdateRelation(@RequestBody Map<String, Object> body) {
        String from = (String) body.get("from");
        String to = (String) body.get("to");
        String type = (String) body.getOrDefault("type", "LINEAGE_TO");
        Map<String, Object> props = (Map<String, Object>) body.get("properties");

        if (from == null || to == null) {
            return Collections.singletonMap("error", "from/to 参数不能为空");
        }
        if (props == null) props = new HashMap<>();

        StringBuilder cypher = new StringBuilder();
        cypher.append("MATCH (a {id: $from}), (b {id: $to}) ")
                .append("MERGE (a)-[r:").append(type).append("]->(b) ");

        if (!props.isEmpty()) {
            List<String> sets = new ArrayList<>();
            for (String key : props.keySet()) {
                sets.add("r." + key + " = $" + key);
            }
            cypher.append("SET ").append(String.join(", ", sets)).append(" ");
        }

        cypher.append("RETURN startNode(r).id AS source, endNode(r).id AS target, type(r) AS type, properties(r) AS properties");

        Map<String, Object> params = new HashMap<>(props);
        params.put("from", from);
        params.put("to", to);

        List<Map<String, Object>> result = neo4jWriter.query(cypher.toString(), params);
        return result.isEmpty() ? Collections.singletonMap("error", "创建或更新关系失败") : result.get(0);
    }
}