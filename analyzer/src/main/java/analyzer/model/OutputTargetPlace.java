package analyzer.model;

import org.opentripplanner.client.model.Itinerary;
import tools.jackson.databind.JsonNode;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Map;

public record OutputTargetPlace(String id, JsonNode data, LngLat lngLat, Map<DayOfWeek, List<OutputItinerary>> itineraries) {
}
