package com.macro.mall.tiny.neo;

import lombok.RequiredArgsConstructor;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 控制器：用于在数据库更新成功后，将元数据同步更新到 Neo4j
 * 所有操作均通过 POST 请求完成
 */
@RestController
@RequestMapping("/api/neo4j")
@RequiredArgsConstructor
public class Neo4jSyncController {

    private final MetadataSyncService syncService;
    private final Driver neo4jDriver;
    private final JdbcTemplate jdbcTemplate;

    /**
     * 全量清空并同步所有元数据
     */
    @PostMapping("/sync")
    public ResponseEntity<String> syncAll() {
        syncService.syncAll();
        return ResponseEntity.ok("Neo4j 全量同步完成");
    }

    /**
     * 创建或更新实体节点（如 Table、Api 等）
     */
    @PostMapping("/entity/upsert")
    public ResponseEntity<String> upsertEntity(@RequestParam String label, @RequestBody Map<String, Object> entity) {
        String tableName = "ads_dl.metadata_" + label.toLowerCase();
        String id = (String) entity.get("id");

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + tableName + " WHERE id = ?",
                new Object[]{id},
                Integer.class
        );

        if (count != null && count > 0) {
            // update
            StringBuilder sql = new StringBuilder("UPDATE " + tableName + " SET ");
            Object[] values = new Object[entity.size()];
            int i = 0;
            for (Map.Entry<String, Object> entry : entity.entrySet()) {
                if (!"id".equals(entry.getKey())) {
                    sql.append(entry.getKey()).append(" = ?, ");
                    values[i++] = entry.getValue();
                }
            }
            sql.setLength(sql.length() - 2);
            sql.append(" WHERE id = ?");
            values[i] = id;
            jdbcTemplate.update(sql.toString(), values);
        } else {
            // insert
            StringBuilder keys = new StringBuilder();
            StringBuilder placeholders = new StringBuilder();
            Object[] values = new Object[entity.size()];
            int i = 0;
            for (Map.Entry<String, Object> entry : entity.entrySet()) {
                keys.append(entry.getKey()).append(", ");
                placeholders.append("?, ");
                values[i++] = entry.getValue();
            }
            keys.setLength(keys.length() - 2);
            placeholders.setLength(placeholders.length() - 2);
            String sql = "INSERT INTO " + tableName + " (" + keys + ") VALUES (" + placeholders + ")";
            jdbcTemplate.update(sql, values);
        }

        try (Session session = neo4jDriver.session()) {
            syncService.mergeEntity(session, label, entity);
        }

        return ResponseEntity.ok("实体同步成功: " + label);
    }

    /**
     * 删除实体节点（先删数据库再删图）
     */
    @PostMapping("/entity/delete")
    public ResponseEntity<String> deleteEntity(@RequestParam String label, @RequestParam String id) {
        String tableName = "ads_dl.metadata_" + label.toLowerCase();
        jdbcTemplate.update("DELETE FROM " + tableName + " WHERE id = ?", id);

        try (Session session = neo4jDriver.session()) {
            syncService.deleteEntity(session, label, id);
        }
        return ResponseEntity.ok("实体删除成功: " + id);
    }

    /**
     * 创建或更新关系（属性+图）
     */
    @PostMapping("/relation/upsert")
    public ResponseEntity<String> upsertRelation(@RequestParam String fromLabel,
                                                 @RequestParam String fromId,
                                                 @RequestParam String relType,
                                                 @RequestParam String toLabel,
                                                 @RequestParam String toId,
                                                 @RequestBody Map<String, Object> props) {
        try (Session session = neo4jDriver.session()) {
            syncService.mergeRelation(session, fromLabel, fromId, relType, toLabel, toId, props);
        }
        return ResponseEntity.ok("关系同步成功: " + relType);
    }

    /**
     * 删除关系（仅图）
     */
    @PostMapping("/relation/delete")
    public ResponseEntity<String> deleteRelation(@RequestParam String fromLabel,
                                                 @RequestParam String fromId,
                                                 @RequestParam String relType,
                                                 @RequestParam String toLabel,
                                                 @RequestParam String toId) {
        try (Session session = neo4jDriver.session()) {
            syncService.deleteRelation(session, fromLabel, fromId, relType, toLabel, toId);
        }
        return ResponseEntity.ok("关系删除成功: " + relType);
    }
}
