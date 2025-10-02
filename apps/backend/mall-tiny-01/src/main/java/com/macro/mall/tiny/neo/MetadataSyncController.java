package com.macro.mall.tiny.neo;


import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/sync/api/neo4j")
@RequiredArgsConstructor
public class MetadataSyncController {
    private final MetadataSyncTask syncTask;
    private final Neo4jWriter neo4jWriter;


    private final MetadataSyncService metadataSyncService;

    @PostMapping("/sync")
    public ResponseEntity<String> syncAll() {
        metadataSyncService.syncAll();
        return ResponseEntity.ok("Sync to Neo4j completed");
    }

//    @PostMapping("/all")
//    public String syncAll() {
//        syncTask.syncSchemas();
//        syncTask.syncTables();
//        syncTask.syncLineages();
//        syncTask.syncFields();
//        return "全部同步完成";
//    }

    @PostMapping("/schemas")
    public String syncSchemas() {
        syncTask.syncSchemas();
        return "Schema 同步完成";
    }

    @PostMapping("/tables")
    public String syncTables() {
        syncTask.syncTables();
        return "Table 同步完成";
    }

    @PostMapping("/lineages")
    public String syncLineages() {
        syncTask.syncLineages();
        return "血缘同步完成";
    }

    @PostMapping("/fields")
    public String syncFields() {
        syncTask.syncFields();
        return "字段同步完成";
    }


    /**
     * 通用 Cypher 查询接口
     *
     * @param body JSON 请求体，包含 "cypher" 字符串
     * @return 查询结果列表，每行一个 Map
     * 示例：
     * {
     * "cypher": "MATCH (n:Table) RETURN n.id, n.name LIMIT 10"
     * }
     */
    @PostMapping("/cypher")
    public List<Map<String, Object>> runCypher(@RequestBody Map<String, String> body) {
        String cypher = body.get("cypher");
        if (cypher == null || cypher.trim().isEmpty()) {
            throw new IllegalArgumentException("Cypher 查询语句不能为空");
        }
        return neo4jWriter.query(cypher, new HashMap<String, Object>());
    }


    /**
     * 高级 Cypher 查询接口（支持参数、写保护、事务）
     *
     * @param body JSON 请求体，包含 "cypher", "params", "type" 字段
     * @return 查询结果
     * 示例：
     * {
     * "cypher": "MATCH (t:Table) WHERE t.name = $name RETURN t.id",
     * "params": { "name": "user_orders" },
     * "type": "read" // 可选: read/write
     * }
     */
    @PostMapping("/cypher/exec")
    public List<Map<String, Object>> runAdvancedCypher(@RequestBody Map<String, Object> body) {
        String cypher = (String) body.get("cypher");
        if (cypher == null || cypher.trim().isEmpty()) {
            throw new IllegalArgumentException("Cypher 查询语句不能为空");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> params = (Map<String, Object>) body.getOrDefault("params", new HashMap<>());
        String type = (String) body.getOrDefault("type", "read");

        if ("write".equalsIgnoreCase(type)) {
            return neo4jWriter.runWriteTransaction(cypher, params);
        } else {
            return neo4jWriter.query(cypher, params);
        }
    }


    /**
     * 执行自定义 Cypher 查询并返回 G6 图结构，source/target 使用业务 ID
     *
     * @param body JSON 请求体：{ "cypher": "MATCH path=... RETURN ..." }
     * @return Map 包含 G6 图需要的 nodes 和 edges
     */
    @PostMapping("/cypher/g6")
    public Map<String, Object> runG6Cypher(@RequestBody Map<String, String> body) {
        String cypher = body.get("cypher");
        if (cypher == null || cypher.trim().isEmpty()) {
            throw new IllegalArgumentException("cypher 不能为空");
        }

        List<Map<String, Object>> raw = neo4jWriter.query(cypher, new HashMap<>());
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        Map<Long, String> nodeIdToBusinessId = new HashMap<>();

        for (Map<String, Object> map : raw) {
            for (Map.Entry<String, Object> entry : map.entrySet()) {
                Object value = entry.getValue();
                if (value instanceof org.neo4j.driver.types.Node) {
                    org.neo4j.driver.types.Node n = (org.neo4j.driver.types.Node) value;
                    String id = n.get("id").asString();
                    Map<String, Object> node = new HashMap<>(n.asMap());
                    node.put("id", id);
                    node.put("label", n.get("name").asString());
                    node.put("type", n.labels().iterator().next());
                    nodes.add(node);
                    nodeIdToBusinessId.put(n.id(), id); // 映射内部 Neo4j 节点ID -> 业务ID
                } else if (value instanceof org.neo4j.driver.types.Relationship) {
                    org.neo4j.driver.types.Relationship r = (org.neo4j.driver.types.Relationship) value;
                    Map<String, Object> edge = new HashMap<>(r.asMap());
                    long startId = r.startNodeId();
                    long endId = r.endNodeId();
                    edge.put("source", nodeIdToBusinessId.getOrDefault(startId, String.valueOf(startId)));
                    edge.put("target", nodeIdToBusinessId.getOrDefault(endId, String.valueOf(endId)));
                    edge.put("label", r.type());
                    edges.add(edge);
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        return result;
    }


    /**
     * 执行自定义 Cypher 查询（可选起始表名），适配 G6 返回 nodes + edges
     *
     * @param body 请求体：包含 cypher 和可选 tableName
     *             {
     *             "cypher": "MATCH (a:Table)-[r:LINEAGE_TO]->(b:Table) RETURN a,b,r",
     *             "tableName": "user_orders"
     *             }
     */
    @PostMapping("/cypher/v1/g6")
    public Map<String, Object> runG6CypherWithFilter(@RequestBody Map<String, Object> body) {
        String cypher = (String) body.get("cypher");
        if (cypher == null || cypher.trim().isEmpty()) {
            throw new IllegalArgumentException("cypher 不能为空");
        }

        Map<String, Object> params = new HashMap<>();
        if (body.containsKey("params")) {
            params.putAll((Map<String, Object>) body.get("params"));
        }

        if (body.containsKey("tableName") && !params.containsKey("tableId")) {
            String tableName = body.get("tableName").toString();
            List<Map<String, Object>> match = neo4jWriter.query(
                    "MATCH (t:Table) WHERE t.name = $name RETURN t.id as id",
                    Collections.singletonMap("name", tableName)
            );
            if (!match.isEmpty()) {
                String tableId = match.get(0).get("id").toString();
                params.put("tableId", tableId);
            }
        }

        List<Map<String, Object>> raw = neo4jWriter.query(cypher, params);
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        Map<Long, String> nodeIdToBusinessId = new HashMap<>();

        for (Map<String, Object> map : raw) {
            for (Object value : map.values()) {
                if (value instanceof org.neo4j.driver.types.Node) {
                    org.neo4j.driver.types.Node n = (org.neo4j.driver.types.Node) value;
                    String id = n.get("id").asString();
                    Map<String, Object> node = new HashMap<>(n.asMap());
                    node.put("id", id);
                    node.put("label", n.get("name").asString());
                    node.put("type", n.labels().iterator().next());
                    nodes.add(node);
                    nodeIdToBusinessId.put(n.id(), id);
                } else if (value instanceof org.neo4j.driver.types.Relationship) {
                    org.neo4j.driver.types.Relationship r = (org.neo4j.driver.types.Relationship) value;
                    Map<String, Object> edge = new HashMap<>(r.asMap());
                    edge.put("source", nodeIdToBusinessId.getOrDefault(r.startNodeId(),
                            String.valueOf(r.startNodeId())));
                    edge.put("target", nodeIdToBusinessId.getOrDefault(r.endNodeId(), String.valueOf(r.endNodeId())));
                    edge.put("label", r.type());
                    edges.add(edge);
                }
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        return result;
    }


    @GetMapping("/lineage")
    public Map<String, Object> getLineage(@RequestParam(value = "tableId", required = false) String tableId,
                                          @RequestParam(value = "tableName", required = false) String tableName,
                                          @RequestParam(value = "sqlName", required = false) String sqlName) {
        String idToUse = tableId;
        if (idToUse == null && tableName != null) {
            // 查询 tableId by tableName
            List<Map<String, Object>> list = neo4jWriter.query("MATCH (t:Table) WHERE t.name = $name RETURN t.id AS " +
                    "id", Collections.singletonMap("name", tableName));
            if (!list.isEmpty()) {
                idToUse = list.get(0).get("id").toString();
            }
        } else if (idToUse == null && sqlName != null) {
            // 查询任意 to_table by sql name
            List<Map<String, Object>> list = neo4jWriter.query("MATCH (a:Table)-[r:LINEAGE_TO {sqlName: $sqlName}]->" +
                    "(b:Table) RETURN b.id AS id", Collections.singletonMap("sqlName", sqlName));
            if (!list.isEmpty()) {
                idToUse = list.get(0).get("id").toString();
            }
        }

        if (idToUse == null) {
            Map<String, Object> empty = new HashMap<>();
            empty.put("nodes", new ArrayList<>());
            empty.put("edges", new ArrayList<>());
            return empty;
        }

        return neo4jWriter.queryLineageGraph(idToUse);
    }

    /**
     * 接口1：根据表名进行血缘查询
     *
     * @param tableName 表名称
     * @param level     溯源层级（默认3）
     * @param direction 溯源方向：up / down / both（默认both）
     */
    @GetMapping("/lineage/byTable")
    public Map<String, Object> getLineageByTable(@RequestParam("tableName") String tableName,
                                                 @RequestParam(value = "level", defaultValue = "3") int level,
                                                 @RequestParam(value = "direction", defaultValue = "both") String direction) {
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();

        List<Map<String, Object>> found = neo4jWriter.query("MATCH (t:Table) WHERE t.name = $name RETURN t.id as id",
                Collections.singletonMap("name", tableName));
        if (found.isEmpty()) return Collections.emptyMap();
        String id = found.get(0).get("id").toString();
        return queryLineageWithProps(id, level, direction);
    }

    /**
     * 接口2：根据 SQL 脚本名称反查依赖图
     *
     * @param sqlName   SQL 脚本名
     * @param level     层级
     * @param direction 方向
     */
    @GetMapping("/lineage/bySql")
    public Map<String, Object> getLineageBySql(@RequestParam("sqlName") String sqlName,
                                               @RequestParam(value = "level", defaultValue = "3") int level,
                                               @RequestParam(value = "direction", defaultValue = "both") String direction) {
        List<Map<String, Object>> found = neo4jWriter.query(
                "MATCH (a:Table)-[r:LINEAGE_TO {sqlName: $sqlName}]->(b:Table) RETURN b.id as id",
                Collections.singletonMap("sqlName", sqlName));
        if (found.isEmpty()) return Collections.emptyMap();
        String id = found.get(0).get("id").toString();
        return queryLineageWithProps(id, level, direction);
    }

    /**
     * 血缘查询核心方法：根据表id + 层级 + 方向 查询图谱，包含属性
     */
    private Map<String, Object> queryLineageWithProps(String startId, int level, String direction) {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();

        String arrow = "";
        if ("up".equals(direction)) arrow = "<-[r:LINEAGE_TO*1.." + level + "]-";
        else if ("down".equals(direction)) arrow = "-[r:LINEAGE_TO*1.." + level + "]->";
        else arrow = "-[r:LINEAGE_TO*1.." + level + "]-";

        String cypher = "MATCH path=(n:Table {id: $startId})" + arrow + "(m:Table)\n" +
                "WITH nodes(path) AS ns, relationships(path) AS rs\n" +
                "UNWIND ns AS node\n" +
                "UNWIND rs AS rel\n" +
                "RETURN collect(DISTINCT node) AS nodeList, collect(DISTINCT rel) AS relList";

        List<Map<String, Object>> queryResult = neo4jWriter.query(cypher, Collections.singletonMap("startId", startId));

        Map<Long, String> idMap = new HashMap<>();

        if (!queryResult.isEmpty()) {
            Map<String, Object> raw = queryResult.get(0);
            if (raw.containsKey("nodeList")) {
                List<Object> rawNodes = (List<Object>) raw.get("nodeList");
                for (Object obj : rawNodes) {
                    if (obj instanceof Map) {
                        Map<String, Object> node = (Map<String, Object>) obj;
                        String id = node.get("id").toString();
                        Map<String, Object> clean = new HashMap<>(node);
                        clean.put("id", id);
                        clean.put("label", node.get("name"));
                        clean.put("type", "table");
                        nodes.add(clean);
                    }
                }
            }
            if (raw.containsKey("relList")) {
                List<Object> rawEdges = (List<Object>) raw.get("relList");
                for (Object obj : rawEdges) {
                    if (obj instanceof Map) {
                        Map<String, Object> r = (Map<String, Object>) obj;
                        Map<String, Object> edge = new HashMap<>(r);
                        edge.put("source", r.get("startNodeId"));
                        edge.put("target", r.get("endNodeId"));
                        edge.put("label", r.get("sqlName") != null ? r.get("sqlName") : r.get("name"));
                        edges.add(edge);
                    }
                }
            }
        }

        result.put("nodes", nodes);
        result.put("edges", edges);
        return result;
    }

    /**
     * 接口1：根据表名进行血缘查询，适配 G6
     *
     * @param tableName 表名
     * @param level     溯源层级，默认3
     * @param direction 溯源方向：up/down/both（默认both）
     */
    @GetMapping("/g6/lineage/byTable")
    public Map<String, Object> getLineageG6ByTable(@RequestParam("tableName") String tableName,
                                                   @RequestParam(value = "level", defaultValue = "3") int level,
                                                   @RequestParam(value = "direction", defaultValue = "both") String direction) {
        List<Map<String, Object>> found = neo4jWriter.query("MATCH (t:Table) WHERE t.name = $name RETURN t.id as id",
                Collections.singletonMap("name", tableName));
        if (found.isEmpty()) return Collections.singletonMap("message", "Table not found");
        String id = found.get(0).get("id").toString();
        return lineageToG6(id, level, direction);
    }

    /**
     * 接口2：根据 SQL 名称进行血缘查询，适配 G6
     *
     * @param sqlName   SQL 脚本名称
     * @param level     层级
     * @param direction 方向
     */
    @GetMapping("/g6/lineage/bySql")
    public Map<String, Object> getLineageG6BySql(@RequestParam("sqlName") String sqlName,
                                                 @RequestParam(value = "level", defaultValue = "3") int level,
                                                 @RequestParam(value = "direction", defaultValue = "both") String direction) {
        List<Map<String, Object>> found = neo4jWriter.query("MATCH (a:Table)-[r:LINEAGE_TO {sqlName: $sqlName}]->" +
                "(b:Table) RETURN b.id as id LIMIT 1", Collections.singletonMap("sqlName", sqlName));
        if (found.isEmpty()) return Collections.singletonMap("message", "No table found by sqlName");
        String id = found.get(0).get("id").toString();
        return lineageToG6(id, level, direction);
    }

    /**
     * 通用图谱溯源处理，返回 G6 所需 nodes + edges
     */
    private Map<String, Object> lineageToG6(String startId, int level, String direction) {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        Set<String> nodeIdSet = new HashSet<>();

        String arrow;
        if ("up".equals(direction)) arrow = "<-[r:LINEAGE_TO*1.." + level + "]-";
        else if ("down".equals(direction)) arrow = "-[r:LINEAGE_TO*1.." + level + "]->";
        else arrow = "-[r:LINEAGE_TO*1.." + level + "]-";

        String cypher = "MATCH path=(n:Table {id: $startId})" + arrow + "(m:Table) RETURN path";
        List<Map<String, Object>> paths = neo4jWriter.query(cypher, Collections.singletonMap("startId", startId));

        for (Map<String, Object> map : paths) {
            for (Object value : map.values()) {
                if (value instanceof org.neo4j.driver.types.Path) {
                    org.neo4j.driver.types.Path path = (org.neo4j.driver.types.Path) value;
                    for (org.neo4j.driver.types.Node node : path.nodes()) {
                        String nodeId = node.get("id").asString();
                        if (!nodeIdSet.contains(nodeId)) {
                            Map<String, Object> n = new HashMap<>(node.asMap());
                            n.put("id", nodeId);
                            n.put("label", node.get("name").asString());
                            n.put("type", "Table");
                            nodes.add(n);
                            nodeIdSet.add(nodeId);
                        }
                    }
                    for (org.neo4j.driver.types.Relationship rel : path.relationships()) {
                        Map<String, Object> edge = new HashMap<>(rel.asMap());
                        edge.put("source", nodeIdSet.contains(rel.startNodeId()) ? rel.startNodeId() : "");
                        edge.put("target", nodeIdSet.contains(rel.endNodeId()) ? rel.endNodeId() : "");
                        edge.put("label", rel.type());
                        edges.add(edge);
                    }
                }
            }
        }

        result.put("nodes", nodes);
        result.put("edges", edges);
        return result;
    }

    /**
     * G6 向上游溯源接口：以目标表为终点，向上 N 跳路径（默认 2）
     */
    @GetMapping("/g6/upstream")
    public Map<String, Object> getG6Upstream(@RequestParam("tableId") String tableId,
                                             @RequestParam(value = "level", defaultValue = "2") int level) {
        String cypher = "MATCH p=(a:Table)-[r:LINEAGE_TO*1.." + level + "]->(b:Table) WHERE b.id = $tableId RETURN p";
        return buildG6FromPathCypher(cypher, Collections.singletonMap("tableId", tableId));
    }

    /**
     * G6 向下游溯源接口：从起点表向下 N 跳路径（默认 2）
     */
    @GetMapping("/g6/downstream")
    public Map<String, Object> getG6Downstream(@RequestParam("tableId") String tableId,
                                               @RequestParam(value = "level", defaultValue = "2") int level) {
        String cypher = "MATCH p=(a:Table {id: $tableId})-[r:LINEAGE_TO*1.." + level + "]->(b:Table) RETURN p";
        return buildG6FromPathCypher(cypher, Collections.singletonMap("tableId", tableId));
    }

    /**
     * G6 双向溯源接口：从起点表双向 N 跳路径（默认 2）
     */
    @GetMapping("/g6/both")
    public Map<String, Object> getG6BothDirection(@RequestParam("tableId") String tableId,
                                                  @RequestParam(value = "level", defaultValue = "2") int level) {
        String cypher = "MATCH p=(a:Table {id: $tableId})-[r:LINEAGE_TO*1.." + level + "]-(b:Table) RETURN p";
        return buildG6FromPathCypher(cypher, Collections.singletonMap("tableId", tableId));
    }

    /**
     * 通用 G6 图构造逻辑：基于路径构造 nodes 与 edges
     */
    private Map<String, Object> buildG6FromPathCypher(String cypher, Map<String, Object> params) {
        List<Map<String, Object>> raw = neo4jWriter.query(cypher, params);

        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        Set<String> nodeIds = new HashSet<>();
        Map<Long, String> nodeIdToBusinessId = new HashMap<>();

        for (Map<String, Object> map : raw) {
            for (Object value : map.values()) {
                if (value instanceof org.neo4j.driver.types.Path) {
                    org.neo4j.driver.types.Path path = (org.neo4j.driver.types.Path) value;
                    for (org.neo4j.driver.types.Node node : path.nodes()) {
                        String id = node.get("id").asString();
                        if (nodeIds.add(id)) {
                            Map<String, Object> nodeMap = new HashMap<>(node.asMap());
                            nodeMap.put("id", id);
                            nodeMap.put("label", node.get("name").asString());
                            nodeMap.put("type", node.labels().iterator().next());
                            nodes.add(nodeMap);
                            nodeIdToBusinessId.put(node.id(), id);
                        }
                    }
                    for (org.neo4j.driver.types.Relationship rel : path.relationships()) {
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
     * 根据关系 name 字段查询上下游路径（LINEAGE_TO 关系），默认双向，适配 G6
     *
     * @param name  关系 name 属性（如 sql_7）
     * @param level 溯源层级（默认 2）
     */
    @GetMapping("/g6/lineage/byRelName")
    public Map<String, Object> getLineageByRelName(@RequestParam("name") String name,
                                                   @RequestParam(value = "level", defaultValue = "2") int level) {
        String cypher = "MATCH p=(a:Table)-[r:LINEAGE_TO*1.." + level + "]-(b:Table) "
                + "WHERE ALL(x IN r WHERE x.name = $name) RETURN p";
        return buildG6FromPathCypher(cypher, Collections.singletonMap("name", name));
    }


    /**
     * G6 封闭链路接口：同时查询以目标表为中心的上下游路径，方向一致，限制跳数，避免扩散
     *
     * @param tableId 表 ID（如 dm.table_ads_1）
     * @param level   跳数，默认 2
     */
    @GetMapping("/g6/lineageClosed")
    public Map<String, Object> getG6ClosedLineage(@RequestParam("tableId") String tableId,
                                                  @RequestParam(value = "level", defaultValue = "2") int level) {
        String up = "MATCH p=(a:Table)-[r:LINEAGE_TO*1.." + level + "]->(mid:Table {id: $tableId}) RETURN p";
        String down = "MATCH p=(mid:Table {id: $tableId})-[r:LINEAGE_TO*1.." + level + "]->(b:Table) RETURN p";

        List<Map<String, Object>> raw = new ArrayList<>();
        raw.addAll(neo4jWriter.query(up, Collections.singletonMap("tableId", tableId)));
        raw.addAll(neo4jWriter.query(down, Collections.singletonMap("tableId", tableId)));

        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        Set<String> nodeIds = new HashSet<>();
        Map<Long, String> nodeIdToBusinessId = new HashMap<>();

        for (Map<String, Object> map : raw) {
            for (Object value : map.values()) {
                if (value instanceof org.neo4j.driver.types.Path) {
                    org.neo4j.driver.types.Path path = (org.neo4j.driver.types.Path) value;
                    for (org.neo4j.driver.types.Node node : path.nodes()) {
                        String id = node.get("id").asString();
                        if (nodeIds.add(id)) {
                            Map<String, Object> nodeMap = new HashMap<>(node.asMap());
                            nodeMap.put("id", id);
                            nodeMap.put("label", node.get("name").asString());
                            nodeMap.put("type", node.labels().iterator().next());
                            nodes.add(nodeMap);
                            nodeIdToBusinessId.put(node.id(), id);
                        }
                    }
                    for (org.neo4j.driver.types.Relationship rel : path.relationships()) {
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

}