package analyzer.model;

public record OutputPlace(String name, LngLat lngLat) {
    public OutputPlace(org.opentripplanner.client.model.Place p) {
        this(p.name(), new LngLat(p.lon(), p.lat()));
    }
}
