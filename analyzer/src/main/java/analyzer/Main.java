package analyzer;

import analyzer.model.*;
import com.fasterxml.jackson.annotation.JsonInclude;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.core.exc.JacksonIOException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.core.util.DefaultIndenter;
import tools.jackson.core.util.DefaultPrettyPrinter;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.io.*;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class Main {
    private static final Logger log = LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) throws IOException {
        if (args.length != 3) {
            System.err.println("Usage: <starts.json> <targets.json> <results.jsonl>");
        }
        var inputStartsFile = new File(args[0]);
        var inputTargetsFile = new File(args[1]);
        var resultsFile = new File(args[2]);
        log.info("analyzer (starts {}, targets {}, output {})", inputStartsFile, inputTargetsFile, resultsFile);

        JsonMapper jsonMapper = new JsonMapper();

        List<StartingPlace> inputStarts = jsonMapper.readValue(inputStartsFile, new TypeReference<>() {
        });
        log.info("Read {} ({} starts)", inputStartsFile, inputStarts.size());

        List<TargetPlace> inputTargets = jsonMapper.readValue(inputTargetsFile, new TypeReference<>() {
        });
        log.info("Read {} ({} targets)", inputTargetsFile, inputTargets.size());

        if (resultsFile.getParentFile() != null) {
            resultsFile.getParentFile().mkdirs();
        }

        HashSet<ResultID> existingResults = new HashSet<>();

        try (BufferedReader r = new BufferedReader(new FileReader(resultsFile))) {
            String line;
            while ((line = r.readLine()) != null) {
                Result result = jsonMapper.readValue(line, Result.class);
                existingResults.add(result.id());
            }
            log.info("Read {} existing results from {}", existingResults.size(), resultsFile);
        } catch (FileNotFoundException _) {
            log.info("Results file {} does not exist", resultsFile);
        }

        // A single analyze task takes about 30 seconds and spends most time waiting on calls to OTP. OTP runs on the
        // same machine and is cpu-bound.
        var nThreads = Runtime.getRuntime().availableProcessors();
        try (
                ExecutorService executor = Executors.newFixedThreadPool(nThreads);
                BufferedWriter resultsFileWriter = new BufferedWriter(new FileWriter(resultsFile, true));
        ) {
            int skipped = 0;
            ArrayList<AnalyzeTask> tasks = new ArrayList<>();
            for (TargetPlace target : inputTargets) {
                for (StartingPlace start : inputStarts) {
                    if (existingResults.contains(new ResultID(start.id(), target.id()))) {
                        skipped++;
                        continue;
                    }
                    tasks.add(new AnalyzeTask(resultsFileWriter, start, target));
                }
            }

            log.info("Analyzing {} start -> target pairs, skipped {} already in results", tasks.size(), skipped);
            var startTime = Instant.now();
            ArrayList<Throwable> failures = new ArrayList<>();
            for (var fut : executor.invokeAll(tasks)) {
                if (fut.state() == Future.State.FAILED) {
                    failures.add(fut.exceptionNow());
                }
            }
            if (!failures.isEmpty()) {
                log.error("{} failure(s)", failures.size());
                System.exit(1);
            }
            var endTime = Instant.now();
            var elapsed = Duration.between(startTime, endTime);
            var avgAnalysisTime = tasks.isEmpty() ? Duration.ofMillis(0) : elapsed.dividedBy(tasks.size());
            log.info("All done! Analyzed {} start->target pairs in {} ({} / analysis on average)", tasks.size(), elapsed, avgAnalysisTime);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }
}
