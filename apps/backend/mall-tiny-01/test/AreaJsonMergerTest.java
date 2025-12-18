import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AreaJsonMergerTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void merge_should_merge_and_dedup_by_code() throws Exception {
        String input = """
        [
          {
            "region": [{"name":"亚洲","code":"AS"},{"name":"欧洲","code":"EU"}],
            "country":[{"name":"中国","code":"CN"},{"name":"德国","code":"DE"}],
            "repOffice":[{"name":"中国北京","code":"CN-BJ"}]
          },
          {
            "region": [{"name":"亚洲","code":"AS"},{"name":"欧洲","code":"EU"}],
            "country":[{"name":"中国","code":"CN"},{"name":"德国","code":"DE"}],
            "repOffice":[{"name":"德国柏林","code":"DE-BE"}]
          }
        ]
        """;

        String outJson = AreaJsonMerger.mergeDedupByCode(input);
        JsonNode out = MAPPER.readTree(outJson);

        assertEquals(2, out.get("region").size());
        assertEquals(2, out.get("country").size());
        assertEquals(2, out.get("repOffice").size());

        assertEquals("CN-BJ", out.at("/repOffice/0/code").asText());
        assertEquals("DE-BE", out.at("/repOffice/1/code").asText());
    }
}


/**
List<Map<String, Object>> regions =
        JsonPath.read(json, "$[*].region[*]");
List<Map<String, Object>> countries =
        JsonPath.read(json, "$[*].country[*]");
List<Map<String, Object>> offices =
        JsonPath.read(json, "$[*].repOffice[*]");

Map<String, Map<String, Object>> regionMap = new LinkedHashMap<>();
for (Map<String, Object> r : regions) {
    regionMap.putIfAbsent((String) r.get("code"), r);
}

// country / repOffice 再写两遍...

Map<String, Object> result = Map.of(
    "region", regionMap.values(),
    "country", countryMap.values(),
    "repOffice", officeMap.values()
);
 */