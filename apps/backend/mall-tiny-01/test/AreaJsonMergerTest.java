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
