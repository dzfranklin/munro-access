package analyzer.model;

import java.time.LocalDateTime;
import java.util.List;

public record OutputItinerary(List<OutputLeg> legs) {
    public OutputItinerary(org.opentripplanner.client.model.Itinerary it) {
        this(it.legs().stream().map(OutputLeg::new).toList());
    }

    public LocalDateTime startTime() {
        return legs.getFirst().startTime();
    }
}
