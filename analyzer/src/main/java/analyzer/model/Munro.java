package analyzer.model;

import tools.jackson.databind.JsonNode;

public record Munro(int number, String name, String page, JsonNode data) {
}
