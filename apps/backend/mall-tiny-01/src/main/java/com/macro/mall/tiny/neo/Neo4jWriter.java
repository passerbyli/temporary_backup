package com.macro.mall.tiny.neo;

import org.neo4j.driver.*;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Neo4jWriter 提供对 Neo4j 图数据库的所有写入操作封装：
 * - 写入节点（如 Schema、Table）
 * - 写入关系（如 BELONGS_TO、LINEAGE_TO）
 * - 写入关系属性
 * - 查询图谱信息
 */
@Service
public class Neo4jWriter {
    private final Driver driver;

    public Neo4jWriter(Driver driver) {
        this.driver = driver;
    }

    /**
     * 写入节点，使用 MERGE 保证唯一性，以 id 为主键。
     *
     * @param label 节点类型（如 Table、Schema）
     * @param props 节点属性集合（必须包含 id）
     */
    public void writeNode(String label, Map<String, Object> props) {
        try (Session session = driver.session()) {
            session.writeTransaction(tx -> {
                Map<String, Object> params = new HashMap<>();
                params.put("id", props.get("id"));
                params.put("name", props.get("name"));
                params.put("props", props);
                tx.run("MERGE (n:" + label + " {id: $id}) SET n += $props", params);
                return null;
            });
        }
    }

    /**
     * 更新某个节点的单个属性字段。
     *
     * @param label     节点类型
     * @param id        节点主键 id
     * @param fieldName 要更新的属性名
     * @param value     要设置的新值
     */
    public void updateNodeProperty(String label, String id, String fieldName, Object value) {
        try (Session session = driver.session()) {
            session.writeTransaction(tx -> {
                Map<String, Object> params = new HashMap<>();
                params.put("id", id);
                params.put("value", value);
                String cypher = "MATCH (n:" + label + " {id: $id}) SET n." + fieldName + " = $value";
                tx.run(cypher, params);
                return null;
            });
        }
    }

    /**
     * 建立两个节点之间的简单关系（无属性）。
     *
     * @param fromLabel 起始节点类型
     * @param fromId    起始节点 id
     * @param rel       关系类型
     * @param toLabel   目标节点类型
     * @param toId      目标节点 id
     */
    public void writeRelation(String fromLabel, String fromId, String rel, String toLabel, String toId) {
        try (Session session = driver.session()) {
            session.writeTransaction(tx -> {
                Map<String, Object> params = new HashMap<>();
                params.put("fromId", fromId);
                params.put("toId", toId);
                tx.run("MATCH (a:" + fromLabel + " {id: $fromId}), (b:" + toLabel + " {id: $toId}) MERGE (a)-[:" + rel + "]->(b)", params);
                return null;
            });
        }
    }

    /**
     * 建立两个节点之间的带属性的关系。
     *
     * @param fromLabel 起始节点类型
     * @param fromId    起始节点 id
     * @param rel       关系类型
     * @param toLabel   目标节点类型
     * @param toId      目标节点 id
     * @param relProps  关系属性 Map（可为空）
     */
    public void writeRelationWithProps(String fromLabel, String fromId, String rel, String toLabel, String toId,
                                       Map<String, Object> relProps) {
        try (Session session = driver.session()) {
            session.writeTransaction(tx -> {
                Map<String, Object> params = new HashMap<>();
                params.put("fromId", fromId);
                params.put("toId", toId);
                params.put("relProps", relProps);
                String cypher = "MATCH (a:" + fromLabel + " {id: $fromId}), (b:" + toLabel + " {id: $toId}) " +
                        "MERGE (a)-[r:" + rel + "]->(b) SET r += $relProps";
                tx.run(cypher, params);
                return null;
            });
        }
    }

    /**
     * 执行通用查询（用于 Cypher 自定义查询），返回 Map 列表。
     *
     * @param cypher Cypher 查询语句
     * @param params 查询参数（可为空）
     * @return 查询结果，每行对应一个 Map
     */
    public List<Map<String, Object>> query(String cypher, Map<String, Object> params) {
        List<Map<String, Object>> resultList = new ArrayList<>();
        System.out.println("Running Cypher: " + cypher);
        System.out.println("With params: " + params);
        try (Session session = driver.session()) {
            session.readTransaction(tx -> {
                Result result = tx.run(cypher, params);
                while (result.hasNext()) {
                    Record record = result.next();
                    resultList.add(record.asMap());
                }
                return null;
            });
        }
        return resultList;
    }
    public List<Map<String, Object>> runWriteTransaction(String cypher, Map<String, Object> params) {
        List<Map<String, Object>> resultList = new ArrayList<>();
        try (Session session = driver.session()) {
            session.writeTransaction(tx -> {
                Result result = tx.run(cypher, params);
                while (result.hasNext()) {
                    Record record = result.next();
                    resultList.add(record.asMap());
                }
                return null;
            });
        }
        return resultList;
    }
    /**
     * 根据传入 tableId 查询图谱结构（含字段节点），结果用于前端 G6 图谱展示。
     *
     * @param tableId 表唯一 id（格式：schema.table）
     * @return Map，包含 nodes 与 edges 两个列表
     */
    public Map<String, Object> queryLineageGraph(String tableId) {
        Map<String, Object> graph = new HashMap<>();
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();

        try (Session session = driver.session()) {
            session.readTransaction(tx -> {
                String cypher = "MATCH (n:Table {id: $id})\n" +
                        "OPTIONAL MATCH (n)-[r:LINEAGE_TO*1..3]-(m:Table)\n" +
                        "WITH collect(n) + collect(m) as allNodes\n" +
                        "UNWIND allNodes as node\n" +
                        "RETURN DISTINCT node";
                Result nodeResult = tx.run(cypher, Collections.singletonMap("id", tableId));
                while (nodeResult.hasNext()) {
                    Record record = nodeResult.next();
                    Value v = record.get("node");
                    Map<String, Object> data = new HashMap<>();
                    data.put("id", v.get("id").asString());
                    data.put("label", v.get("name").asString());
                    data.put("type", "table");
                    nodes.add(data);
                }

                String edgeCypher = "MATCH (a:Table)-[r:LINEAGE_TO]->(b:Table)\n" +
                        "WHERE a.id = $id OR b.id = $id OR (a)-[:LINEAGE_TO*1..3]->(b)\n" +
                        "RETURN a.id AS source, b.id AS target, r.name AS label";
                Result edgeResult = tx.run(edgeCypher, Collections.singletonMap("id", tableId));
                while (edgeResult.hasNext()) {
                    Record record = edgeResult.next();
                    Map<String, Object> e = new HashMap<>();
                    e.put("source", record.get("source").asString());
                    e.put("target", record.get("target").asString());
                    e.put("label", record.get("label").isNull() ? "" : record.get("label").asString());
                    edges.add(e);
                }

                // 字段级血缘（Field）节点 + 连线（可选）
                String fieldCypher = "MATCH (t:Table)-[:HAS_FIELD]->(f:Field) WHERE t.id IN $tableIds RETURN f, t.id " +
                        "as tableId";
                List<String> tableIds = new ArrayList<>();
                for (Map<String, Object> n : nodes) tableIds.add(n.get("id").toString());
                Result fieldResult = tx.run(fieldCypher, Collections.singletonMap("tableIds", tableIds));
                while (fieldResult.hasNext()) {
                    Record r = fieldResult.next();
                    Value f = r.get("f");
                    String fieldId = f.get("id").asString();
                    Map<String, Object> fieldNode = new HashMap<>();
                    fieldNode.put("id", fieldId);
                    fieldNode.put("label", f.get("name").asString());
                    fieldNode.put("type", "field");
                    nodes.add(fieldNode);

                    Map<String, Object> hasEdge = new HashMap<>();
                    hasEdge.put("source", r.get("tableId").asString());
                    hasEdge.put("target", fieldId);
                    hasEdge.put("label", "HAS_FIELD");
                    edges.add(hasEdge);
                }

                return null;
            });
        }

        graph.put("nodes", nodes);
        graph.put("edges", edges);
        return graph;
    }
}
