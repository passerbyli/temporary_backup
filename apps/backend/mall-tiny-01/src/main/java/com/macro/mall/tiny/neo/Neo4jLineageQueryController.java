package com.macro.mall.tiny.neo;

import lombok.RequiredArgsConstructor;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Session;
import org.neo4j.driver.types.Path;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 提供表级与字段级血缘查询接口，支持 G6 展示结构
 */
@RestController
@RequestMapping("/api/neo4j/lineage")
@RequiredArgsConstructor
public class Neo4jLineageQueryController {

    private final Driver neo4jDriver;

    @GetMapping("/lookup")
    public ResponseEntity<List<Map<String, Object>>> lookupTables(@RequestParam String keyword) {
        String cypher = "MATCH (t:Table) WHERE toLower(t.name) CONTAINS toLower('" + keyword + "') RETURN t.id AS id," +
                " t.name AS name LIMIT 20";
        try (Session session = neo4jDriver.session()) {
            List<Record> records = session.run(cypher).list();
            List<Map<String, Object>> result = new ArrayList<>();
            for (Record r : records) {
                Map<String, Object> map = new HashMap<>();
                map.put("id", r.get("id").asString());
                map.put("name", r.get("name").asString());
                result.add(map);
            }
            return ResponseEntity.ok(result);
        }
    }

    /**
     * 表级血缘查询
     * @param body
     * @return
     * "filters": {
     *   "layer": {
     *     "include": ["dwd", "dws"],
     *     "exclude": ["dim"]
     *   },
     *   "demain": {
     *     "include": ["销售"]
     *   }
     * }
     */
    @PostMapping("/trace")
    public ResponseEntity<Map<String, Object>> trace(@RequestBody Map<String, Object> body) {
        String tableId = String.valueOf(body.get("tableId"));
        int depth = (int) body.getOrDefault("depth", 2);
        String direction = String.valueOf(body.getOrDefault("direction", "both"));
        boolean isSource = (boolean) body.getOrDefault("isSource", true);
        int maxNodes = (int) body.getOrDefault("maxNodes", 100);
        Map<String, Map<String, List<String>>> filters = (Map<String, Map<String, List<String>>>) body.get("filters");

        String rel = ":LINEAGE*1.." + depth;
        List<String> matchParts = new ArrayList<>();

        if ("upstream".equals(direction)) {
            if (isSource) {
                matchParts.add("MATCH p=(n:Table)-" + rel + "->(t:Table {id: '" + tableId + "'})");
            } else {
                matchParts.add("MATCH p1=(t:Table {id: '" + tableId + "'})-" + rel + "->(n:Table)");
                matchParts.add("MATCH p2=(n:Table)-" + rel + "->(t:Table {id: '" + tableId + "'})");
            }
        } else if ("downstream".equals(direction)) {
            if (isSource) {
                matchParts.add("MATCH p=(t:Table {id: '" + tableId + "'})-" + rel + "->(n:Table)");
            } else {
                matchParts.add("MATCH p1=(n:Table)-" + rel + "->(t:Table {id: '" + tableId + "'})");
                matchParts.add("MATCH p2=(t:Table {id: '" + tableId + "'})-" + rel + "->(n:Table)");
            }
        } else {
            matchParts.add("MATCH p=(t:Table {id: '" + tableId + "'})-" + rel + "-(n:Table)");
        }

        StringBuilder whereClause = new StringBuilder();
        if (filters != null) {
            for (String prop : filters.keySet()) {
                Map<String, List<String>> cond = filters.get(prop);
                if (cond.containsKey("include")) {
                    whereClause.append(" AND (n.").append(prop).append(" IN [");
                    for (String v : cond.get("include")) {
                        whereClause.append("'" + v + "',");
                    }
                    whereClause.setLength(whereClause.length() - 1);
                    whereClause.append("]) ");
                }
                if (cond.containsKey("exclude")) {
                    whereClause.append(" AND (n.").append(prop).append(" IS NULL OR NOT n.").append(prop).append(" IN" +
                            " [");
                    for (String v : cond.get("exclude")) {
                        whereClause.append("'" + v + "',");
                    }
                    whereClause.setLength(whereClause.length() - 1);
                    whereClause.append("]) ");
                }
            }
        }

        StringBuilder finalCypher = new StringBuilder();
        for (int i = 0; i < matchParts.size(); i++) {
            finalCypher.append(matchParts.get(i)).append(" WHERE 1=1 ").append(whereClause);
            finalCypher.append(" RETURN p LIMIT ").append(maxNodes);
            if (i < matchParts.size() - 1) finalCypher.append(" UNION ");
        }

        return ResponseEntity.ok(runLineageQuery(finalCypher.toString()));
    }

    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> customQuery(@RequestBody Map<String, String> body) {
        String cypher = body.get("cypher");
        return ResponseEntity.ok(runLineageQuery(cypher));
    }

    @GetMapping("/fields")
    public ResponseEntity<Map<String, Object>> queryFieldLineage(@RequestParam String tableId) {
        String cypher = "MATCH (t:Table {id: '" + tableId + "'})-[:HAS_FIELD]->(f:Field)-[:FIELD_LINEAGE]->(f2:Field)" +
                "<-[:HAS_FIELD]-(t2:Table) RETURN f, f2, t, t2";

        Set<Map<String, Object>> nodes = new HashSet<>();
        Set<Map<String, Object>> edges = new HashSet<>();

        try (Session session = neo4jDriver.session()) {
            List<Record> records = session.run(cypher).list();
            for (Record record : records) {
                Map<String, Object> f1 = record.get("f").asNode().asMap();
                Map<String, Object> f2 = record.get("f2").asNode().asMap();
                Map<String, Object> t1 = record.get("t").asNode().asMap();
                Map<String, Object> t2 = record.get("t2").asNode().asMap();

                String f1id = String.valueOf(f1.get("id"));
                String f2id = String.valueOf(f2.get("id"));

                nodes.add(buildNode(f1id, f1.get("name"), "field", t1.get("name"), f1));
                nodes.add(buildNode(f2id, f2.get("name"), "field", t2.get("name"), f2));

                Map<String, Object> edge = new HashMap<>();
                edge.put("source", f1id);
                edge.put("target", f2id);
                edge.put("label", "字段血缘");
                edge.put("style", Collections.singletonMap("lineDash", new int[]{4, 2}));
                edges.add(edge);
            }
        }

        return ResponseEntity.ok(buildGraph(nodes, edges, cypher));
    }

    private Map<String, Object> runLineageQuery(String cypher) {
        Set<Map<String, Object>> nodes = new HashSet<>();
        Set<Map<String, Object>> edges = new HashSet<>();

        try (Session session = neo4jDriver.session()) {
            List<Record> records = session.run(cypher).list();
            for (Record record : records) {
                Path path = record.get("p").asPath();
                for (Path.Segment seg : path) {
                    Map<String, Object> from = seg.start().asMap();
                    Map<String, Object> to = seg.end().asMap();
                    String fromId = String.valueOf(from.get("id"));
                    String toId = String.valueOf(to.get("id"));

                    nodes.add(buildNode(fromId, from.get("name"), "table", null, from));
                    nodes.add(buildNode(toId, to.get("name"), "table", null, to));

                    Map<String, Object> edge = new HashMap<>();
                    edge.put("source", fromId);
                    edge.put("target", toId);
                    edge.put("label", seg.relationship().type());
                    edge.put("data", seg.relationship().asMap());
                    edges.add(edge);
                }
            }
        }

        return buildGraph(nodes, edges, cypher);
    }

    private Map<String, Object> buildNode(String id, Object label, String type, Object group,
                                          Map<String, Object> data) {
        Map<String, Object> node = new HashMap<>();
        node.put("id", id);
        node.put("label", label);
        node.put("type", type);
        if (group != null) node.put("group", group);
        node.put("data", data);
        return node;
    }

    private Map<String, Object> buildGraph(Set<Map<String, Object>> nodes, Set<Map<String, Object>> edges,
                                           String cypher) {
        Map<String, Object> graph = new HashMap<>();
        graph.put("nodes", nodes);
        graph.put("edges", edges);
        graph.put("cypher", cypher);

        Map<String, Object> layoutMap = new HashMap<>();
        layoutMap.put("layout", new String[]{"type", "dagre", "rankdir", "LR"});
        graph.put("layout", layoutMap);
        return graph;
    }
}