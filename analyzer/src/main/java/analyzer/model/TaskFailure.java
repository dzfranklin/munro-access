package analyzer.model;

import java.time.Instant;

public record TaskFailure(
    ResultID id,
    String errorMessage,
    String errorType,
    Instant timestamp,
    int attemptCount
) {
    public static TaskFailure from(ResultID id, Exception e, int attempts) {
        return new TaskFailure(
            id,
            e.getMessage(),
            e.getClass().getSimpleName(),
            Instant.now(),
            attempts
        );
    }
}
