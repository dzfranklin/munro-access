package analyzer;

import analyzer.model.*;
import com.fasterxml.jackson.annotation.JsonInclude;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.json.JsonMapper;

import java.io.BufferedWriter;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicInteger;

public class AnalyzeTask implements Callable<Void> {
    private static final Logger log = LoggerFactory.getLogger(AnalyzeTask.class);

    private static final JsonMapper jsonMapper = JsonMapper.builder()
            .changeDefaultPropertyInclusion(incl -> incl.withValueInclusion(JsonInclude.Include.NON_NULL))
            .build();

    private final BufferedWriter resultsFileWriter;
    final StartingPlace start;  // Package-private for error handling in Main
    final TargetPlace target;   // Package-private for error handling in Main
    private final AtomicInteger completedCount;

    public AnalyzeTask(BufferedWriter resultsFileWriter, StartingPlace start, TargetPlace target, AtomicInteger completedCount) {
        this.resultsFileWriter = resultsFileWriter;
        this.start = start;
        this.target = target;
        this.completedCount = completedCount;
    }

    @Override
    public Void call() {
        int maxAttempts = 3;
        int attempt = 0;
        Exception lastException = null;

        var analyzer = new Analyzer();

        while (attempt < maxAttempts) {
            attempt++;
            try {

                if (attempt > 1) {
                    log.info("Retry attempt {} for {} from {}", attempt, target.id(), start.id());
                } else {
                    log.info("Analyzing {} from {}", target.id(), start.id());
                }

                Instant startTime = Instant.now();
                Result result = analyzer.analyze(start, target);
                Instant endTime = Instant.now();

                log.info("Analyzed {} from {} in {} (attempt {})",
                        target.id(), start.id(),
                        Duration.between(startTime, endTime), attempt);

                String resultLine = jsonMapper.writeValueAsString(result);

                synchronized (resultsFileWriter) {
                    resultsFileWriter.write(resultLine + "\n");
                    resultsFileWriter.flush(); // Flush after each write for crash safety
                }

                completedCount.incrementAndGet(); // Increment after successful completion

                return null; // Success!

            } catch (Exception e) {
                lastException = e;
                if (attempt < maxAttempts) {
                    // Exponential backoff: 1s, 2s, 4s
                    long backoffMs = (long) Math.pow(2, attempt - 1) * 1000;
                    log.warn("Failed {} from {} (attempt {}), retrying in {}ms: {}",
                            target.id(), start.id(), attempt, backoffMs, e.toString());
                    try {
                        Thread.sleep(backoffMs);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Interrupted during retry backoff", ie);
                    }
                }
            }
        }

        // All attempts failed
        log.error("Failed {} from {} after {} attempts: {}",
                target.id(), start.id(), maxAttempts, lastException.toString());
        lastException.printStackTrace();
        throw new RuntimeException("Failed " + new ResultID(start.id(), target.id()), lastException);
    }
}
