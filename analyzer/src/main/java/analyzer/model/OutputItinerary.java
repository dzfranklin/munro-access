package analyzer.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.opentripplanner.client.model.LegMode;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public record OutputItinerary(LocalDate date, List<OutputLeg> legs) implements Comparable<OutputItinerary> {
    public OutputItinerary(org.opentripplanner.client.model.Itinerary it) {
        this(it.legs().getFirst().startTime().toLocalDate(),
                it.legs().stream().map(OutputLeg::new).toList());
    }

    @JsonProperty
    public LocalTime getStartTime() {
        return legs.getFirst().startTime();
    }

    @JsonProperty
    public LocalTime getEndTime() {
        return legs.getLast().endTime();
    }

    @JsonProperty
    public Set<LegMode> modes() {
        return legs.stream().map(OutputLeg::mode).collect(Collectors.toSet());
    }

    @Override
    public int compareTo(OutputItinerary o) {
        return date.atTime(getStartTime()).compareTo(o.date.atTime(o.getStartTime()));
    }
}
