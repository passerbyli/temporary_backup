package com.macro.mall.metadata.service;

import com.macro.mall.metadata.repository.Neo4jRepository;
import com.macro.mall.metadata.repository.PostgresRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class LineageService {
    @Autowired
    private PostgresRepository pgRepo;
    @Autowired private Neo4jRepository neoRepo;

    public void updateLineages(List<Map<String, Object>> lineages) {
        if (lineages == null || lineages.isEmpty()) return;

        // 先更新 PostgreSQL
        pgRepo.updateLineagesBatch(lineages);

        // 再更新 Neo4j
        for (Map<String, Object> l : lineages) {
            neoRepo.createLineageEdge(l);
        }
    }
}