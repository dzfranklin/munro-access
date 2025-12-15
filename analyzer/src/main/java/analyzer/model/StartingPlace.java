package analyzer.model;

import tools.jackson.databind.JsonNode;

public record StartingPlace(String id, String name, JsonNode data, LngLat lngLat, int radius) {
    public org.opentripplanner.client.model.Coordinate coordinate() {
        return new org.opentripplanner.client.model.Coordinate(lngLat.lat(), lngLat.lng(), name);
    }
}
