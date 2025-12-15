package analyzer.model;

import org.opentripplanner.client.model.LegMode;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;

public record OutputLeg(
        OutputPlace from,
        OutputPlace to,
        boolean interlineWithPreviousLeg,
        LocalTime startTime,
        LocalTime endTime,
        LegMode mode,
        String agencyName,
        String routeName
) {
    private static final ZoneId tz = ZoneId.of("Europe/London");

    public OutputLeg(org.opentripplanner.client.model.Leg l) {
        this(
                new OutputPlace(l.from()),
                new OutputPlace(l.to()),
                l.interlineWithPreviousLeg(),
                l.startTime().atZoneSameInstant(tz).toLocalTime(),
                l.endTime().atZoneSameInstant(tz).toLocalTime(),
                l.mode(),
                l.agency() != null ? l.agency().name() : null,
                l.route() != null ? l.route().getShortName() : null
        );
    }
}
