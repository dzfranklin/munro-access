package analyzer.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import tools.jackson.databind.JsonNode;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Map;

public record Result(String start, String target, Map<DayOfWeek, DayItineraries> itineraries) {
    public ResultID id() {
        return new ResultID(start, target);
    }
}
