package com.macro.mall.metadata.repository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Repository
public class PostgresRepository {
    @Autowired
    private JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> fetchBatch(String tableName, int offset, int limit) {
        String sql = String.format("SELECT * FROM ads_dl.%s ORDER BY id LIMIT %d OFFSET %d", tableName, limit, offset);
        return jdbcTemplate.queryForList(sql);
    }

    public Map<Long, List<Map<String, Object>>> getFieldsGroupedByTableId() {
        String sql = "SELECT * FROM ads_dl.metadata_field";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        return rows.stream().collect(Collectors.groupingBy(r -> ((Number) r.get("table_id")).longValue()));
    }

    public int updateTable(Map<String, Object> tableData) {
        String sql = "UPDATE ads_dl.metadata_table SET name=?, description=?, layer=?, type=?, field=?, updated_time=now() WHERE id=?";
        return jdbcTemplate.update(sql,
                tableData.get("name"),
                tableData.get("description"),
                tableData.get("layer"),
                tableData.get("type"),
                tableData.get("field"),
                tableData.get("id")
        );
    }

    public void updateLineagesBatch(List<Map<String, Object>> lineages) {
        for (Map<String, Object> l : lineages) {
            // 先删除重复（防止重复写入）
            jdbcTemplate.update(
                    "DELETE FROM ads_dl.metadata_table_lineage WHERE from_table_id = ? AND to_table_id = ? AND sql_id = ?",
                    l.get("from_table_id"), l.get("to_table_id"), l.get("sql_id")
            );

            // 插入新记录
            jdbcTemplate.update(
                    "INSERT INTO ads_dl.metadata_table_lineage (from_table_id, to_table_id, sql_id, sql_name, task_id, task_name, updated_time) VALUES (?, ?, ?, ?, ?, ?, now())",
                    l.get("from_table_id"), l.get("to_table_id"), l.get("sql_id"), l.get("sql_name"), l.get("task_id"), l.get("task_name")
            );
        }
    }
}
