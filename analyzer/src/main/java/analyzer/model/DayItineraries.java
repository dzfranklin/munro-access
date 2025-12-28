package analyzer.model;

import java.util.List;

public record DayItineraries(
    List<OutputItinerary> outbounds,
    List<OutputItinerary> returns
) {}
