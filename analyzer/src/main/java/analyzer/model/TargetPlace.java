package analyzer.model;

import tools.jackson.databind.JsonNode;
import java.util.List;

public record TargetPlace(String id, String name, String description, List<Route> routes, JsonNode data, LngLat lngLat) {
    public org.opentripplanner.client.model.Coordinate coordinate() {
        return new org.opentripplanner.client.model.Coordinate(lngLat.lat(), lngLat.lng(), name);
    }
}
