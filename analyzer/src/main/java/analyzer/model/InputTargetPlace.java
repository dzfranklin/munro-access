package analyzer.model;

import tools.jackson.databind.JsonNode;

public record InputTargetPlace(String id, String name, JsonNode data, LngLat lngLat) {
    public org.opentripplanner.client.model.Coordinate coordinate() {
        return new org.opentripplanner.client.model.Coordinate(lngLat.lat(), lngLat.lng(), name);
    }
}
