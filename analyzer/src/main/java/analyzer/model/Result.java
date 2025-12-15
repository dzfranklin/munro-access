package analyzer.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import tools.jackson.databind.JsonNode;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Map;

public record Result(String start, String target, Map<DayOfWeek, List<OutputItinerary>> itineraries) {
    protected String id() {
        return id(start, target);
    }

    protected static String id(String start, String target) {
        return start + ":" + target;
    }
}
