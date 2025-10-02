package com.macro.mall.metadata.service;

import com.google.gson.Gson;
import com.macro.mall.metadata.repository.Neo4jRepository;
import com.macro.mall.metadata.repository.PostgresRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Service
public class SyncService {
    @Autowired private PostgresRepository pgRepo;
    @Autowired private Neo4jRepository neoRepo;

    public void syncAll(int batchSize) {
        Map<Long, List<Map<String, Object>>> fieldsMap = pgRepo.getFieldsGroupedByTableId();
        System.out.println("Loaded fields for " + fieldsMap.size() + " tables.");

        syncSchemas(batchSize);
        syncTables(batchSize, fieldsMap);
        syncSQLScripts(batchSize);
        syncSchedules(batchSize);
        syncLineages(batchSize);
    }

    public void syncSchemas(int batchSize) {
        syncTable("metadata_schema", batchSize, neoRepo::createSchemaNode);
    }

    public void syncTables(int batchSize) {
        Map<Long, List<Map<String, Object>>> fieldsMap = pgRepo.getFieldsGroupedByTableId();
        syncTables(batchSize, fieldsMap);
    }

    private void syncTables(int batchSize, Map<Long, List<Map<String, Object>>> fieldsMap) {
        syncTable("metadata_table", batchSize, (row) -> {
            Long tableId = ((Number) row.get("id")).longValue();
            String fieldsJson = new Gson().toJson(fieldsMap.getOrDefault(tableId, Collections.emptyList()));
            neoRepo.createTableNode(row, fieldsJson);
        });
    }

    public void syncSQLScripts(int batchSize) {
        syncTable("metadata_sqlscript", batchSize, neoRepo::createSqlScriptNode);
    }

    public void syncSchedules(int batchSize) {
        syncTable("metadata_schedule", batchSize, neoRepo::createScheduleNode);
    }

    public void syncLineages(int batchSize) {
        syncTable("metadata_table_lineage", batchSize, neoRepo::createLineageEdge);
    }

    private void syncTable(String tableName, int batchSize, Consumer<Map<String, Object>> processor) {
        int offset = 0;
        while (true) {
            List<Map<String, Object>> batch = pgRepo.fetchBatch(tableName, offset, batchSize);
            if (batch.isEmpty()) break;
            batch.forEach(processor);
            System.out.println("Synced " + tableName + " offset " + offset);
            offset += batchSize;
        }
    }

}
