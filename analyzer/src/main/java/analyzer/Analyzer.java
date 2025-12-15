package analyzer;

import analyzer.model.*;
import org.locationtech.spatial4j.context.SpatialContext;
import org.locationtech.spatial4j.distance.DistanceUtils;
import org.locationtech.spatial4j.shape.Point;
import org.locationtech.spatial4j.shape.ShapeFactory;
import org.opentripplanner.api.types.OptimizeType;
import org.opentripplanner.client.OtpApiClient;
import org.opentripplanner.client.model.*;
import org.opentripplanner.client.parameters.TripPlanParameters;
import org.opentripplanner.client.parameters.TripPlanParametersBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

public class Analyzer {
    private static final Logger log = LoggerFactory.getLogger(Analyzer.class);

    // Search configuration
    private static final List<DayOfWeek> searchDays = List.of(DayOfWeek.WEDNESDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY);
    private static final LocalTime minTargetArrival = LocalTime.of(6, 0);
    private static final LocalTime maxTargetArrival = LocalTime.of(13, 0);

    private static final ZoneId tz = ZoneId.of("Europe/London");
    private static final String otpEndpoint = "http://localhost:8080";

    private Clock clock = Clock.system(tz);
    private OtpApiClient otp = new OtpApiClient(tz, otpEndpoint);

    private ArrayList<StartingPlace> starts = new ArrayList<>();
    private ArrayList<OutputTargetPlace> outputTargets = new ArrayList<>();

    Output output() {
        return new Output(starts, outputTargets);
    }

    void analyze(List<StartingPlace> inputStarts, List<InputTargetPlace> inputTargets) throws IOException {
        if (!starts.isEmpty()) {
            throw new RuntimeException("analyze(input) should be called once per Analyzer");
        }

        try {
            List<Alert> alerts = otp.alerts();
            if (!alerts.isEmpty()) {
                log.warn("Alerts exist: {}", alerts);
            }
        } catch (java.net.SocketException err) {
            log.error("Failed to get alerts, have you started OTP? (./otp.sh)");
            throw err;
        }

        starts.addAll(inputStarts);

        for (var target : inputTargets) {
            for (var start : inputStarts) {
                analyze(start, target);
            }
        }
    }

    private void analyze(StartingPlace start, InputTargetPlace target) throws IOException {
        HashMap<DayOfWeek, List<OutputItinerary>> itineraries = new HashMap<>();
        var today = LocalDate.now(clock);
        for (DayOfWeek day : searchDays) {
            LocalDate nextDay = today.with(TemporalAdjusters.next(day));
            var dayItineraries = new ArrayList<OutputItinerary>();
            for (boolean withCycle : new boolean[]{false, true}) {
                dayItineraries.addAll(findItineraries(start, target, nextDay, withCycle));
            }
            dayItineraries.sort(Comparator.comparing(OutputItinerary::startTime));
            itineraries.put(day, dayItineraries);
        }

        outputTargets.add(new OutputTargetPlace(target.id(), target.data(), target.lngLat(), itineraries));
    }

    private List<OutputItinerary> findItineraries(StartingPlace start, InputTargetPlace target, LocalDate date, boolean withCycle) throws IOException {
        log.debug("findRoutes: start {}, target {}, date {}", start, target, date);

        HashSet<RequestMode> modes = new HashSet<>(List.of(RequestMode.TRANSIT, RequestMode.WALK));
        if (withCycle) {
            modes.add(RequestMode.BICYCLE);
        }

        TripPlanParametersBuilder params = new TripPlanParametersBuilder()
                .withFrom(start.coordinate())
                .withTo(target.coordinate())
                .withModes(modes)
                .withSearchDirection(TripPlanParameters.SearchDirection.ARRIVE_BY)
                .withTime(date.atTime(minTargetArrival))
                .withSearchWindow(Duration.between(minTargetArrival, maxTargetArrival))
                .withWalkReluctance(1.1)
                .withOptimize(OptimizeType.QUICK)
                .withNumberOfItineraries(5);

        TripPlan result = otp.plan(params.build());
        var itineraries = new ArrayList<OutputItinerary>();
        pagination:
        while (true) {
            for (Itinerary it : result.itineraries()) {
                List<Leg> transitLegs = it.transitLegs();
                if (transitLegs.getLast().endTime().toLocalTime().isAfter(maxTargetArrival)) {
                    break pagination;
                }
                if (transitLegs.isEmpty()) {
                    continue; // skip all-bike itineraries
                }
                if (withCycle && !it.legs().stream().anyMatch(leg -> leg.mode() == LegMode.BICYCLE)) {
                    continue;
                }
                it = snipItineraryToStartingRadius(start, it);
                itineraries.add(new OutputItinerary(it));
            }
            if (result.nextPageCursor() == null) {
                break;
            }
            result = otp.plan(params.withPageCursor(result.nextPageCursor()).build());
        }
        return itineraries;
    }

    private Itinerary snipItineraryToStartingRadius(StartingPlace start, Itinerary it) {
        ArrayList<Leg> legs = new ArrayList<>();
        var started = false;
        SpatialContext ctx = SpatialContext.GEO;
        ShapeFactory shapeFactory = ctx.getShapeFactory();
        Point startPoint = shapeFactory.pointLatLon(start.lngLat().lat(), start.lngLat().lng());
        for (Leg leg : it.legs()) {
            if (!started) {
                Point endPoint = shapeFactory.pointLatLon(leg.to().lat(), leg.to().lon());
                double dist = ctx.getDistCalc().distance(startPoint, endPoint) * DistanceUtils.DEG_TO_KM * 1_000;
                if (dist < start.radius()) {
                    log.debug("skipped starting leg {}", leg);
                    continue;
                } else {
                    started = true;
                }
            }
            legs.add(leg);
        }
        return new Itinerary(legs, it.accessibilityScore());
    }
}
