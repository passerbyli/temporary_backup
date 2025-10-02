package com.macro.mall.metadata.repository;


import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.Map;

@Repository
public class Neo4jRepository {
    @Autowired
    private Driver driver;

    public void createSchemaNode(Map<String, Object> row) {
        try (Session session = driver.session()) {
            session.run("MERGE (s:Schema {id: $id}) SET s.name=$name, s.description=$desc, s.field=$field", row);
        }
    }


    public void createSqlScriptNode(Map<String, Object> row) {
        try (Session session = driver.session()) {
            session.run("MERGE (s:SQLScript {id: $id}) SET s.name=$name, s.type=$type, s.description=$desc, s.parsed=$parsed", row);
        }
    }

    public void createScheduleNode(Map<String, Object> row) {
        try (Session session = driver.session()) {
            session.run(
                    "MERGE (sch:Schedule {id: $id}) SET sch.name=$name, sch.platform=$platform, sch.type=$type, sch.description=$desc " +
                            "WITH sch " +
                            "MATCH (s:SQLScript {id: $sqlId}) " +
                            "MERGE (sch)-[:TRIGGERS]->(s)",
                    row
            );
        }
    }

    public void createLineageEdge(Map<String, Object> row) {
        try (Session session = driver.session()) {
            session.run(
                    "MATCH (src:Table {id: $fromId}), (dst:Table {id: $toId}) " +
                            "MERGE (src)-[:LINEAGE {sqlId: $sqlId, sqlName: $sqlName, taskId: $taskId, taskName: $taskName}]->(dst)",
                    new HashMap<String, Object>() {{
                        put("fromId", row.get("from_table_id"));
                        put("toId", row.get("to_table_id"));
                        put("sqlId", row.get("sql_id"));
                        put("sqlName", row.get("sql_name"));
                        put("taskId", row.get("task_id"));
                        put("taskName", row.get("task_name"));
                    }}
            );
        }
    }


    public void createTableNode(Map<String, Object> row, String fieldsJson) {
        try (Session session = driver.session()) {
            Map<String, Object> params = new HashMap<>();
            params.put("id", row.get("id"));
            params.put("name", row.get("name"));
            params.put("layer", row.get("layer"));
            params.put("type", row.get("type"));
            params.put("desc", row.get("description"));
            params.put("field", row.get("field"));
            params.put("schemaId", row.get("schema_id"));
            params.put("fieldsJson", fieldsJson);

            session.run("MERGE (t:Table {id: $id}) \" +\n" +
                    "                            \"SET t.name=$name, t.layer=$layer, t.type=$type, t.description=$desc, t.field=$field, t.fields=$fieldsJson \" +\n" +
                    "                            \"WITH t \" +\n" +
                    "                            \"MATCH (s:Schema {id: $schemaId}) \" +\n" +
                    "                            \"MERGE (s)-[:CONTAINS]->(t)", params);

        }
    }


}