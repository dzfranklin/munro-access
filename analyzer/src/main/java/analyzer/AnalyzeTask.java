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

public class AnalyzeTask implements Callable<Void> {
    private static final Logger log = LoggerFactory.getLogger(AnalyzeTask.class);

    private static final JsonMapper jsonMapper = JsonMapper.builder()
            .changeDefaultPropertyInclusion(incl -> incl.withValueInclusion(JsonInclude.Include.NON_NULL))
            .build();

    private final BufferedWriter resultsFileWriter;
    private final StartingPlace start;
    private final TargetPlace target;

    public AnalyzeTask(BufferedWriter resultsFileWriter, StartingPlace start, TargetPlace target) {
        this.resultsFileWriter = resultsFileWriter;
        this.start = start;
        this.target = target;
    }

    @Override
    public Void call() {
        try {
            var analyzer = new Analyzer();

            log.info("Analyzing {} from {}", target.id(), start.id());
            Instant startTime = Instant.now();
            Result result = analyzer.analyze(start, target);
            Instant endTime = Instant.now();
            log.info("Analyzed {} from {} in {}", target.id(), start.id(), Duration.between(startTime, endTime));

            String resultLine = jsonMapper.writeValueAsString(result);

            synchronized (resultsFileWriter) {
                resultsFileWriter.write(resultLine + "\n");
            }

            return null;
        } catch (Exception e) {
            log.error(e.toString());
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }
}
