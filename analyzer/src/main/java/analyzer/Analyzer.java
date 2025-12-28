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

    // Return journey configuration
    // Minimum hike duration: 4h40m aligns with hourly bus schedules
    // (e.g., arrive 10:00 AM, hike 4h40m, finish 2:40 PM, catch 3:00 PM bus)
    private static final Duration MIN_HIKE_TIME = Duration.ofHours(4).plusMinutes(40);
    private static final LocalTime LATEST_RETURN_DEPARTURE = LocalTime.of(23, 59);

    private static final ZoneId tz = ZoneId.of("Europe/London");
    private static final String otpEndpoint = "http://localhost:8080";

    private final Clock clock = Clock.system(tz);
    private final OtpApiClient otp = new OtpApiClient(tz, otpEndpoint);

    private final LocalDate baseDate = readTransitWeekStart();

    public Result analyze(StartingPlace start, TargetPlace target) throws IOException {
        HashMap<DayOfWeek, DayItineraries> itineraries = new HashMap<>();

        for (DayOfWeek day : searchDays) {
            LocalDate nextDay = baseDate.with(TemporalAdjusters.next(day));
            var dayOutbounds = new ArrayList<OutputItinerary>();
            var dayReturns = new ArrayList<OutputItinerary>();

            // Find all outbound itineraries
            for (boolean withCycle : new boolean[]{false, true}) {
                dayOutbounds.addAll(findItineraries(start, target, nextDay, withCycle));
            }

            // Find return itineraries if we have outbounds
            if (!dayOutbounds.isEmpty()) {
                LocalTime earliestArrival = dayOutbounds.stream()
                        .map(OutputItinerary::getEndTime)
                        .min(LocalTime::compareTo)
                        .orElseThrow();

                LocalTime returnSearchStart = earliestArrival.plus(MIN_HIKE_TIME);

                // Search for return journeys
                for (boolean withCycle : new boolean[]{false, true}) {
                    dayReturns.addAll(findReturnItineraries(
                            target, start, nextDay, returnSearchStart, withCycle
                    ));
                }
            }

            dayOutbounds.sort(null);
            dayReturns.sort(null);
            itineraries.put(day, new DayItineraries(dayOutbounds, dayReturns));
        }

        return new Result(start.id(), target.id(), itineraries);
    }

    private static LocalDate readTransitWeekStart() {
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
                if (it.legs().getLast().endTime().toLocalTime().isAfter(maxTargetArrival)) {
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

    private List<OutputItinerary> findReturnItineraries(
            TargetPlace from,
            StartingPlace to,
            LocalDate date,
            LocalTime earliestDeparture,
            boolean withCycle
    ) throws IOException {

        log.debug("findReturnItineraries: from {}, to {}, earliestDeparture {}, withCycle {}",
                from, to, earliestDeparture, withCycle);

        // Build mode set
        HashSet<RequestMode> modes = new HashSet<>(List.of(RequestMode.TRANSIT, RequestMode.WALK));
        if (withCycle) {
            modes.add(RequestMode.BICYCLE);
        }

        // Search from earliest departure to end of day
        Duration searchWindow = Duration.between(earliestDeparture, LATEST_RETURN_DEPARTURE);

        // Build OTP query - DEPART_AT from trailhead
        TripPlanParametersBuilder params = new TripPlanParametersBuilder()
                .withFrom(from.coordinate())
                .withTo(to.coordinate())
                .withModes(modes)
                .withSearchDirection(TripPlanParameters.SearchDirection.DEPART_AT)
                .withTime(date.atTime(earliestDeparture))
                .withSearchWindow(searchWindow)
                .withWalkReluctance(1.1)
                .withOptimize(OptimizeType.QUICK)
                .withNumberOfItineraries(5);

        TripPlan result;
        try {
            result = otp.plan(params.build());
        } catch (java.net.SocketException err) {
            log.error("Failed to contact OTP for return journey");
            throw err;
        }

        // Collect all viable return itineraries
        List<OutputItinerary> returnItineraries = new ArrayList<>();

        for (Itinerary it : result.itineraries()) {
            List<Leg> transitLegs = it.transitLegs();

            if (transitLegs.isEmpty()) {
                continue; // skip all-bike itineraries
            }

            if (withCycle && !it.legs().stream().anyMatch(leg -> leg.mode() == LegMode.BICYCLE)) {
                continue; // withCycle should only return itineraries involving cycling
            }

            LocalTime departTime = transitLegs.getFirst().startTime().toLocalTime();

            // Check if departure is after earliest allowed
            if (departTime.isBefore(earliestDeparture)) {
                continue;
            }

            // Snip ending radius (remove legs within home city)
            it = snipItineraryToEndingRadius(to, it);
            returnItineraries.add(new OutputItinerary(it));
        }

        // Paginate through results if needed (similar to outbound logic)
        LocalTime lastDepartureTime = LATEST_RETURN_DEPARTURE;
        if (!returnItineraries.isEmpty()) {
            lastDepartureTime = returnItineraries.getLast().getStartTime();
        }

        while (lastDepartureTime.isBefore(LATEST_RETURN_DEPARTURE)) {
            params.withTime(date.atTime(lastDepartureTime));
            try {
                result = otp.plan(params.build());
            } catch (java.net.SocketException err) {
                log.error("Failed to contact OTP for return journey pagination");
                throw err;
            }

            boolean foundNew = false;
            for (Itinerary it : result.itineraries()) {
                List<Leg> transitLegs = it.transitLegs();

                if (transitLegs.isEmpty()) continue;
                if (withCycle && !it.legs().stream().anyMatch(leg -> leg.mode() == LegMode.BICYCLE)) continue;

                LocalTime departTime = transitLegs.getFirst().startTime().toLocalTime();

                if (departTime.isBefore(earliestDeparture)) continue;

                if (departTime.isAfter(lastDepartureTime)) {
                    it = snipItineraryToEndingRadius(to, it);
                    returnItineraries.add(new OutputItinerary(it));
                    lastDepartureTime = departTime;
                    foundNew = true;
                }
            }

            if (!foundNew) break;
        }

        return returnItineraries;
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

    private Itinerary snipItineraryToEndingRadius(StartingPlace end, Itinerary it) {
        ArrayList<Leg> legs = new ArrayList<>();
        SpatialContext ctx = SpatialContext.GEO;
        ShapeFactory shapeFactory = ctx.getShapeFactory();
        Point endPoint = shapeFactory.pointLatLon(end.lngLat().lat(), end.lngLat().lng());

        for (var leg : it.legs()) {
            Point fromPoint = shapeFactory.pointLatLon(leg.from().lat(), leg.from().lon());
            double dist = ctx.getDistCalc().distance(endPoint, fromPoint) * DistanceUtils.DEG_TO_KM * 1_000;

            if (dist < end.radius()) {
                log.debug("skipped ending leg {} and any subsequent", leg);
                break;
            }

            legs.add(leg);
        }

        if (legs.isEmpty()) {
            log.warn("end: {}, it: {}", end, it);
            throw new RuntimeException("snipItinerarytoEndingRadius should not create empty");
        }

        return new Itinerary(legs, it.accessibilityScore());
    }
}
