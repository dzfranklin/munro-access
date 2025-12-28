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
import java.nio.file.Files;
import java.nio.file.Path;
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

    private final Clock clock = Clock.system(tz);
    private final OtpApiClient otp = new OtpApiClient(tz, otpEndpoint);

    public Result analyze(StartingPlace start, TargetPlace target) throws IOException {
        HashMap<DayOfWeek, List<OutputItinerary>> itineraries = new HashMap<>();
        var today = readTransitWeekStart();
        for (DayOfWeek day : searchDays) {
            LocalDate nextDay = today.with(TemporalAdjusters.next(day));
            var dayItineraries = new ArrayList<OutputItinerary>();
            for (boolean withCycle : new boolean[]{false, true}) {
                dayItineraries.addAll(findItineraries(start, target, nextDay, withCycle));
            }
            dayItineraries.sort(null);
            itineraries.put(day, dayItineraries);
        }
        return new Result(start.id(), target.id(), itineraries);
    }

    private LocalDate readTransitWeekStart() {
        try {
            Path weekFile = Path.of("../otp/transit_week.txt");
            String weekStart = Files.readString(weekFile).trim();
            return LocalDate.parse(weekStart);
        } catch (IOException e) {
            log.error("Failed to read transit week from ../otp/transit_week.txt", e);
            log.error("Have you run ./download_timetables.sh and ./otp.sh --build?");
            throw new RuntimeException("Cannot determine transit week", e);
        }
    }

    private List<OutputItinerary> findItineraries(StartingPlace start, TargetPlace target, LocalDate date, boolean withCycle) throws IOException {
        log.debug("findRoutes: start {}, target {}, date {}, withCycle {}", start, target, date, withCycle);

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

        TripPlan result;
        try {
            result = otp.plan(params.build());
        } catch (java.net.SocketException err) {
            log.error("Failed to get alerts, have you started OTP? (./otp.sh)");
            throw err;
        }

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
                    continue; // withCycle should only return itineraries involving cycling
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

    Itinerary snipItineraryToStartingRadius(StartingPlace start, Itinerary it) {
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
