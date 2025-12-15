package analyzer.model;

import org.opentripplanner.client.model.LegMode;

import java.time.LocalDateTime;
import java.time.ZoneId;

public record OutputLeg(
        String from,
        String to,
        boolean interlineWithPreviousLeg,
        LocalDateTime startTime,
        LocalDateTime endTime,
        LegMode mode,
        String agencyName,
        String routeName
) {
    private static final ZoneId tz = ZoneId.of("Europe/London");

    public OutputLeg(org.opentripplanner.client.model.Leg l) {
        this(
                l.from().name(),
                l.to().name(),
                l.interlineWithPreviousLeg(),
                l.startTime().atZoneSameInstant(tz).toLocalDateTime(),
                l.endTime().atZoneSameInstant(tz).toLocalDateTime(),
                l.mode(),
                l.agency() != null ? l.agency().name() : null,
                l.route() != null ? l.route().getShortName() : null
        );
    }
}
