package com.macro.mall.tiny.neo;

import lombok.RequiredArgsConstructor;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;


/**
 * 元数据同步服务：将 PostgreSQL 中的元数据表（位于 ads_dl schema）同步到 Neo4j 图数据库
 * 特性：
 * - 接口触发
 * - 全量覆盖（每次清空后重建）
 * - 所有字段属性完整同步
 */
@Service
@RequiredArgsConstructor
public class MetadataSyncService {

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    @Autowired
    private Driver neo4jDriver;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    public void syncAll() {
        try (Session session = neo4jDriver.session()) {
            // 清空旧数据
            session.run("MATCH (n) DETACH DELETE n");

            // 同步实体
            syncTables(session);
            syncFields(session);
            syncSqlScripts(session);
            syncLineage(session);
            syncSchemas(session);
            syncApis(session);
        }
    }

    private void syncTables(Session session) {
        String sql = "SELECT * FROM ads_dl.metadata_table";
        jdbcTemplate.query(sql, (ResultSet rs) -> {
            while (rs.next()) {
                Map<String, Object> props = new HashMap<>();
                props.put("id", rs.getString("id"));
                props.put("name", rs.getString("name"));
                props.put("description", rs.getString("description"));
                props.put("layer", rs.getString("layer"));
                props.put("type", rs.getString("type"));
                props.put("schema_id", rs.getString("schema_id"));
                props.put("schema_name", rs.getString("schema_name"));
                props.put("database", rs.getString("database"));
                props.put("tags", rs.getString("tags"));
                props.put("create_time", rs.getString("create_time"));
                props.put("version", rs.getString("version"));
                props.put("demain", rs.getString("demain"));
                props.put("created_by", rs.getString("created_by"));
                props.put("updated_by", rs.getString("updated_by"));
                props.put("created_at", formatTimestamp(rs.getTimestamp("created_at")));
                props.put("updated_at", formatTimestamp(rs.getTimestamp("updated_at")));

                String cypher = "MERGE (n:Table {id: $id}) SET n += $props";
                session.run(cypher, Values.parameters("id", props.get("id"), "props", props));
            }
        });
    }

    private void syncFields(Session session) {
        String sql = "SELECT * FROM ads_dl.metadata_field";
        jdbcTemplate.query(sql, (ResultSet rs) -> {
            while (rs.next()) {
                Map<String, Object> props = new HashMap<>();
                props.put("id", rs.getString("id"));
                props.put("name", rs.getString("name"));
                props.put("description", rs.getString("description"));
                props.put("field_type", rs.getString("field_type"));
                props.put("field_length", rs.getString("field_length"));
                props.put("field_alias", rs.getString("field_alias"));
                props.put("table_name", rs.getString("table_name"));
                props.put("table_id", rs.getString("table_id"));
                props.put("schema_name", rs.getString("schema_name"));
                props.put("schema_id", rs.getString("schema_id"));
                props.put("created_by", rs.getString("created_by"));
                props.put("updated_by", rs.getString("updated_by"));
                props.put("created_at", formatTimestamp(rs.getTimestamp("created_at")));
                props.put("updated_at", formatTimestamp(rs.getTimestamp("updated_at")));

                String cypher = "MERGE (n:Field {id: $id}) SET n += $props";
                session.run(cypher, Values.parameters("id", props.get("id"), "props", props));
            }
        });
    }

    private void syncSqlScripts(Session session) {
        String sql = "SELECT * FROM ads_dl.metadata_sqlscript";
        jdbcTemplate.query(sql, (ResultSet rs) -> {
            while (rs.next()) {
                Map<String, Object> props = new HashMap<>();
                props.put("id", rs.getString("id"));
                props.put("name", rs.getString("name"));
                props.put("description", rs.getString("description"));
                props.put("schema_id", rs.getString("schema_id"));
                props.put("schema_name", rs.getString("schema_name"));
                props.put("type", rs.getString("type"));
                props.put("content", rs.getString("content"));
                props.put("parsed", rs.getBoolean("parsed"));
                props.put("created_by", rs.getString("created_by"));
                props.put("updated_by", rs.getString("updated_by"));
                props.put("created_at", formatTimestamp(rs.getTimestamp("created_at")));
                props.put("updated_at", formatTimestamp(rs.getTimestamp("updated_at")));

                String cypher = "MERGE (n:Script {id: $id}) SET n += $props";
                session.run(cypher, Values.parameters("id", props.get("id"), "props", props));
            }
        });
    }

    private void syncLineage(Session session) {
        String sql = "SELECT * FROM ads_dl.metadata_lineage";
        jdbcTemplate.query(sql, (ResultSet rs) -> {
            while (rs.next()) {
                Map<String, Object> props = new HashMap<>();
                props.put("id", rs.getString("id"));
                props.put("name", rs.getString("name"));
                props.put("description", rs.getString("description"));
                props.put("sql_id", rs.getString("sql_id"));
                props.put("sql_name", rs.getString("sql_name"));
                props.put("task_id", rs.getString("task_id"));
                props.put("task_name", rs.getString("task_name"));
                props.put("created_by", rs.getString("created_by"));
                props.put("updated_by", rs.getString("updated_by"));
                props.put("created_at", formatTimestamp(rs.getTimestamp("created_at")));
                props.put("updated_at", formatTimestamp(rs.getTimestamp("updated_at")));

                String from = rs.getString("source_id");
                String to = rs.getString("target_id");
                String cypher = "MATCH (a:Table {id: $from}), (b:Table {id: $to}) " +
                        "MERGE (a)-[r:LINEAGE {id: $id}]->(b) SET r += $props";
                session.run(cypher, Values.parameters("from", from, "to", to, "id", props.get("id"), "props", props));
            }
        });
    }

    private void syncSchemas(Session session) {
        String sql = "SELECT * FROM ads_dl.metadata_schema";
        jdbcTemplate.query(sql, (ResultSet rs) -> {
            while (rs.next()) {
                Map<String, Object> props = new HashMap<>();
                props.put("id", rs.getString("id"));
                props.put("name", rs.getString("name"));
                props.put("description", rs.getString("description"));
                props.put("created_by", rs.getString("created_by"));
                props.put("updated_by", rs.getString("updated_by"));
                props.put("created_at", formatTimestamp(rs.getTimestamp("created_at")));
                props.put("updated_at", formatTimestamp(rs.getTimestamp("updated_at")));

                String cypher = "MERGE (n:Schema {id: $id}) SET n += $props";
                session.run(cypher, Values.parameters("id", props.get("id"), "props", props));
            }
        });
    }

    private void syncApis(Session session) {
        String sql = "SELECT * FROM ads_dl.metadata_api";
        jdbcTemplate.query(sql, (ResultSet rs) -> {
            while (rs.next()) {
                Map<String, Object> props = new HashMap<>();
                props.put("id", rs.getString("id"));
                props.put("env", rs.getString("env"));
                props.put("api_id", rs.getString("api_id"));
                props.put("name", rs.getString("name"));
                props.put("url", rs.getString("url"));
                props.put("online_url", rs.getString("online_url"));
                props.put("impl", rs.getString("impl"));
                props.put("domain", rs.getString("domain"));
                props.put("auth_type", rs.getString("auth_type"));
                props.put("description", rs.getString("description"));
                props.put("source_from", rs.getString("source_from"));
                props.put("hash", rs.getString("hash"));
                props.put("route", rs.getString("route"));
                props.put("route_id", rs.getString("route_id"));
                props.put("from_table", rs.getString("from_table"));
                props.put("created_by", rs.getString("created_by"));
                props.put("updated_by", rs.getString("updated_by"));
                props.put("created_at", formatTimestamp(rs.getTimestamp("created_at")));
                props.put("updated_at", formatTimestamp(rs.getTimestamp("updated_at")));

                String cypher = "MERGE (n:Api {id: $id}) SET n += $props";
                session.run(cypher, Values.parameters("id", props.get("id"), "props", props));
            }
        });
    }

    private String formatTimestamp(Timestamp ts) {
        return ts != null ? ts.toLocalDateTime().format(ISO_FORMATTER) : null;
    }
    // ========== 通用方法区 ==========

    /**
     * 创建或更新实体节点
     */
    public void mergeEntity(Session session, String label, Map<String, Object> props) {
        Map<String, Object> params = new HashMap<>();
        params.put("id", props.get("id"));
        params.put("props", props);
        session.run("MERGE (n:" + label + " {id: $id}) SET n += $props", params);
    }

    /**
     * 删除实体节点
     */
    public void deleteEntity(Session session, String label, String id) {
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        session.run("MATCH (n:" + label + " {id: $id}) DETACH DELETE n", params);
    }

    /**
     * 创建实体关系（无属性）
     */
    public void createRelation(Session session, String fromLabel, String fromId, String relType, String toLabel,
                               String toId) {
        Map<String, Object> params = new HashMap<>();
        params.put("fromId", fromId);
        params.put("toId", toId);
        session.run("MATCH (a:" + fromLabel + " {id: $fromId}), (b:" + toLabel + " {id: $toId}) " +
                "MERGE (a)-[:" + relType + "]->(b)", params);
    }

    /**
     * 删除实体关系
     */
    public void deleteRelation(Session session, String fromLabel, String fromId, String relType, String toLabel,
                               String toId) {
        Map<String, Object> params = new HashMap<>();
        params.put("fromId", fromId);
        params.put("toId", toId);
        session.run("MATCH (a:" + fromLabel + " {id: $fromId})-[r:" + relType + "]->(b:" + toLabel + " {id: $toId}) " +
                "DELETE r", params);
    }

    /**
     * 创建或更新关系（带属性）
     */
    public void mergeRelation(Session session, String fromLabel, String fromId, String relType, String toLabel,
                              String toId, Map<String, Object> props) {
        Map<String, Object> params = new HashMap<>();
        params.put("fromId", fromId);
        params.put("toId", toId);
        params.put("id", props.get("id"));
        params.put("props", props);
        session.run("MATCH (a:" + fromLabel + " {id: $fromId}), (b:" + toLabel + " {id: $toId}) " +
                "MERGE (a)-[r:" + relType + " {id: $id}]->(b) SET r += $props", params);
    }
}
