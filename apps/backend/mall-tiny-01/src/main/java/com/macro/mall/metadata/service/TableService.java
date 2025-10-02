package com.macro.mall.metadata.service;

import com.google.gson.Gson;
import com.macro.mall.metadata.repository.Neo4jRepository;
import com.macro.mall.metadata.repository.PostgresRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class TableService {
    @Autowired
    private PostgresRepository pgRepo;
    @Autowired private Neo4jRepository neoRepo;

    public boolean updateTable(Map<String, Object> tableData) {
        try {
            // 1. 更新 PostgreSQL
            int count = pgRepo.updateTable(tableData);
            if (count == 0) {
                throw new RuntimeException("未找到要更新的表");
            }

            // 2. 更新 Neo4j
            Long tableId = ((Number) tableData.get("id")).longValue();
            Map<Long, List<Map<String, Object>>> fieldsMap = pgRepo.getFieldsGroupedByTableId();
            String fieldsJson = new Gson().toJson(fieldsMap.getOrDefault(tableId, Collections.emptyList()));

            neoRepo.createTableNode(tableData, fieldsJson);

            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }
}
