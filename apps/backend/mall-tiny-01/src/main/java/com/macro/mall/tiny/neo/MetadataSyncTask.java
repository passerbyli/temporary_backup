package com.macro.mall.tiny.neo;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MetadataSyncTask {
    private final JdbcTemplate jdbcTemplate;
    private final Neo4jWriter neo4jWriter;

    public MetadataSyncTask(JdbcTemplate jdbcTemplate, Neo4jWriter neo4jWriter) {
        this.jdbcTemplate = jdbcTemplate;
        this.neo4jWriter = neo4jWriter;
    }

    public void syncSchemas() {
        List<Map<String, Object>> list = jdbcTemplate.queryForList("SELECT * FROM ads_dl.metadata_schema");
        for (Map<String, Object> row : list) {
            Map<String, Object> props = new HashMap<>();
            props.put("id", row.get("name"));
            props.put("name", row.get("name"));
            props.put("description", row.get("description"));
            neo4jWriter.writeNode("Schema", props);
        }
    }

    public void syncTables() {
        List<Map<String, Object>> list = jdbcTemplate.queryForList("SELECT * FROM ads_dl.metadata_table");
        for (Map<String, Object> row : list) {
            String id =  row.get("name").toString();
            Map<String, Object> props = new HashMap<>();
            props.put("id", id);
            props.put("name", row.get("name"));
            props.put("layer", row.get("layer"));
            props.put("type", row.get("type"));
            props.put("schema", row.get("schema_name"));
            neo4jWriter.writeNode("Table", props);
            neo4jWriter.writeRelation("Table", id, "BELONGS_TO", "Schema", row.get("schema_name").toString());
        }
    }

    public void syncLineages() {
        List<Map<String, Object>> list = jdbcTemplate.queryForList("SELECT * FROM ads_dl.metadata_table_lineage");
        for (Map<String, Object> row : list) {
            String from = row.get("from_table_name") != null ? row.get("from_table_name").toString() : null;
            String to = row.get("to_table_name") != null ? row.get("to_table_name").toString() : null;
            if (from == null || to == null) continue;

            // 写入源节点
            Map<String, Object> fromProps = new HashMap<>();
            fromProps.put("id",from );
            fromProps.put("name", from);
            neo4jWriter.writeNode("Table", fromProps);

            // 写入目标节点
            Map<String, Object> toProps = new HashMap<>();
            toProps.put("id", to);
            toProps.put("name", to);
            neo4jWriter.writeNode("Table", toProps);

            // 写入关系属性
            Map<String, Object> edgeProps = new HashMap<>();
            edgeProps.put("name", row.get("name"));
            edgeProps.put("taskName", row.get("task_name"));
            edgeProps.put("sqlName", row.get("sql_name"));
            edgeProps.put("description", row.get("description"));

            neo4jWriter.writeRelationWithProps("Table", from, "LINEAGE_TO", "Table", to, edgeProps);
        }
    }


    public void syncFields() {
        List<Map<String, Object>> list = jdbcTemplate.queryForList("SELECT * FROM ads_dl.metadata_field");
        Map<String, List<Map<String, Object>>> tableFieldMap = new HashMap<>();

        for (Map<String, Object> row : list) {
            Object tableName = row.get("table_name");
            Object schemaName = row.get("schema_name");
            if (tableName == null || schemaName == null) continue;
            String tableId =  tableName.toString();

            Map<String, Object> field = new HashMap<>();
            field.put("name", row.get("name"));
            field.put("type", row.get("field_type"));
            field.put("length", row.get("field_length"));
            field.put("alias", row.get("field_alias"));

            if (!tableFieldMap.containsKey(tableId)) {
                tableFieldMap.put(tableId, new ArrayList<Map<String, Object>>());
            }
            tableFieldMap.get(tableId).add(field);
        }

        ObjectMapper objectMapper = new ObjectMapper();
        for (Map.Entry<String, List<Map<String, Object>>> entry : tableFieldMap.entrySet()) {
            String tableId = entry.getKey();
            List<Map<String, Object>> fields = entry.getValue();
            try {
                String json = objectMapper.writeValueAsString(fields); // 转为 JSON 字符串
                neo4jWriter.updateNodeProperty("Table", tableId, "fields", json);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
