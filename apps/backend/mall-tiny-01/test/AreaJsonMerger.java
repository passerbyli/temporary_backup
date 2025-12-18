import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class AreaJsonMerger {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final List<String> FIELDS = List.of("region", "country", "repOffice");

    /** 输入：第一层是数组；输出：合并后的单个对象（各字段按 code 去重） */
    public static String mergeDedupByCode(String jsonArrayString) throws Exception {
        ArrayNode arr = (ArrayNode) MAPPER.readTree(jsonArrayString);

        ObjectNode out = MAPPER.createObjectNode();
        for (String field : FIELDS) {
            out.set(field, mergeFieldDedupByCode(arr, field));
        }
        return MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(out);
    }

    /** 合并某个字段（例如 repOffice），并按 code 去重 */
    private static ArrayNode mergeFieldDedupByCode(ArrayNode arr, String field) {
        Map<String, JsonNode> seen = new LinkedHashMap<>(); // 保持出现顺序

        for (JsonNode obj : arr) {
            JsonNode fieldNode = obj.get(field);
            if (fieldNode == null || !fieldNode.isArray()) continue;

            for (JsonNode e : fieldNode) {
                JsonNode codeNode = e.get("code");
                if (codeNode == null || codeNode.isNull()) continue; // 没 code 就跳过
                String code = codeNode.asText();

                seen.putIfAbsent(code, e); // 只保留第一次出现的 code
            }
        }

        ArrayNode merged = MAPPER.createArrayNode();
        seen.values().forEach(merged::add);
        return merged;
    }
}