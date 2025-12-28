package analyzer.model;

import tools.jackson.databind.JsonNode;
import java.util.List;

public record Route(String name, String page, List<Munro> munros, JsonNode data) {
}
