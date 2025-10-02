package com.macro.mall.metadata.controller;


import com.macro.mall.metadata.service.LineageService;
import com.macro.mall.metadata.service.SyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/sync")
public class SyncController {

    @Autowired
    private SyncService syncService;


    @PostMapping("/all")
    public String syncAll(@RequestParam(defaultValue = "1000") int batchSize) {
        syncService.syncAll(batchSize);
        return "✅ 全部数据同步已触发！";
    }

    @PostMapping("/schemas")
    public String syncSchemas(@RequestParam(defaultValue = "1000") int batchSize) {
        syncService.syncSchemas(batchSize);
        return "✅ Schema 同步已触发！";
    }

    @PostMapping("/tables")
    public String syncTables(@RequestParam(defaultValue = "1000") int batchSize) {
        syncService.syncTables(batchSize);
        return "✅ Table 同步已触发！";
    }

    @PostMapping("/scripts")
    public String syncScripts(@RequestParam(defaultValue = "1000") int batchSize) {
        syncService.syncSQLScripts(batchSize);
        return "✅ SQL 脚本同步已触发！";
    }

    @PostMapping("/schedules")
    public String syncSchedules(@RequestParam(defaultValue = "1000") int batchSize) {
        syncService.syncSchedules(batchSize);
        return "✅ 调度同步已触发！";
    }

    @PostMapping("/lineages")
    public String syncLineages(@RequestParam(defaultValue = "1000") int batchSize) {
        syncService.syncLineages(batchSize);
        return "✅ 血缘同步已触发！";
    }
    @Autowired private LineageService lineageService;

    @PostMapping("/update")
    public String updateLineages(@RequestBody Map<String, List<Map<String, Object>>> payload) {
        List<Map<String, Object>> lineages = payload.get("lineages");
        lineageService.updateLineages(lineages);
        return "✅ 血缘关系已更新！";
    }
}