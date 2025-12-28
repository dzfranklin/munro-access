package analyzer.model;

import tools.jackson.databind.JsonNode;
import java.util.List;

public record TargetsInput(JsonNode metadata, List<TargetPlace> starts, JsonNode data) {
}
