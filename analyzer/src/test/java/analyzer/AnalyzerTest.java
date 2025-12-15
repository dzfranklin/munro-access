package analyzer;

import analyzer.model.LngLat;
import analyzer.model.StartingPlace;
import org.junit.jupiter.api.Test;
import org.opentripplanner.client.model.*;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.OptionalDouble;

import static org.junit.jupiter.api.Assertions.*;

class AnalyzerTest {

    @Test
    void snipItineraryToStartingRadius() {
        var start = new StartingPlace("edinburgh", "Edinburgh", null, new LngLat(-3.188159, 55.95186), 5_000);
        var it = new Itinerary(List.of(
                legOf(placeOf(55.94532F, -3.21831F, "Haymarket Rail Station"), placeOf(55.95186F, -3.18816F, "Edinburgh Rail Station")),
                legOf(placeOf(55.94585F, -3.219396F, "Haymarket Station"), placeOf(55.94532F, -3.21831F, "Haymarket Rail Station")),
                legOf(placeOf(56.70311F, -3.734341F, "Fishers Hotel"), placeOf(55.94585F, -3.219396F, "Haymarket Station")),
                legOf(placeOf(56.76677F, -3.836675F, "Tilt Hotel"), placeOf(56.70311F, -3.734341F, "Fishers Hotel")),
                legOf(placeOf(56.7745F, -3.84325F, "Càrn a' Chlamain"), placeOf(56.76677F, -3.836675F, "Tilt Hotel"))
        ), OptionalDouble.empty());

        var subject = new Analyzer();
        var actual = subject.snipItineraryToStartingRadius(start, it);
        assertEquals(List.of("Fishers Hotel", "Tilt Hotel", "Càrn a' Chlamain"), legToNames(actual.legs()));
    }

    private static List<String> legToNames(List<Leg> legs) {
        return legs.stream().map(l -> l.to().name()).toList();
    }

    private static Place placeOf(float lat, float lon, String name) {
        return new Place(name, lon, lat, Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty());
    }

    private static Leg legOf(Place to, Place from) {
        var t = OffsetDateTime.of(2020, 1, 1, 6, 0, 0, 0, ZoneOffset.UTC);
        return new Leg(from,
                to,
                t,
                t,
                false,
                false,
                LegMode.WALK,
                Duration.ofMinutes(1),
                0,
                Optional.empty(),
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                Optional.empty());
    }
}
