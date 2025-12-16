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
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    private static final Logger log = LoggerFactory.getLogger(Main.class);

    private static String formatDuration(Duration d) {
        long hours = d.toHours();
        long minutes = d.toMinutesPart();
        long seconds = d.toSecondsPart();

        if (hours > 0) {
            return String.format("%dh %dm %ds", hours, minutes, seconds);
        } else if (minutes > 0) {
            return String.format("%dm %ds", minutes, seconds);
        } else {
            return String.format("%ds", seconds);
        }
    }

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
            AtomicInteger completedCount = new AtomicInteger(0);
            ArrayList<AnalyzeTask> tasks = new ArrayList<>();
            for (TargetPlace target : inputTargets) {
                for (StartingPlace start : inputStarts) {
                    if (existingResults.contains(new ResultID(start.id(), target.id()))) {
                        skipped++;
                        continue;
                    }
                    tasks.add(new AnalyzeTask(resultsFileWriter, start, target, completedCount));
                }
            }

            log.info("Analyzing {} start -> target pairs, skipped {} already in results", tasks.size(), skipped);

            // Start a background thread for progress logging
            Instant overallStartTime = Instant.now();
            Thread progressLogger = new Thread(() -> {
                Logger progressLog = LoggerFactory.getLogger(Main.class);

                while (!Thread.currentThread().isInterrupted()) {
                    try {
                        Thread.sleep(60_000); // Log every minute

                        int completed = completedCount.get();
                        int total = tasks.size();

                        if (completed > 0 && completed < total) {
                            double progress = (double) completed / total;
                            Duration elapsed = Duration.between(overallStartTime, Instant.now());

                            // Calculate ETA: (elapsed / completed) * remaining
                            long avgMs = elapsed.toMillis() / completed;
                            long remainingMs = avgMs * (total - completed);
                            Duration eta = Duration.ofMillis(remainingMs);

                            progressLog.info("Progress: {}/{} ({:.1f}%) completed, ETA: {}",
                                     completed, total, progress * 100, formatDuration(eta));
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }, "progress-logger");
            progressLogger.setDaemon(true);
            progressLogger.start();

            var startTime = Instant.now();
            var futures = executor.invokeAll(tasks);

            // Stop the progress logger
            progressLogger.interrupt();
            try {
                progressLogger.join(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            ArrayList<TaskFailure> taskFailures = new ArrayList<>();
            for (int i = 0; i < futures.size(); i++) {
                var fut = futures.get(i);
                if (fut.state() == Future.State.FAILED) {
                    Throwable ex = fut.exceptionNow();
                    AnalyzeTask task = tasks.get(i);
                    ResultID id = new ResultID(task.start.id(), task.target.id());

                    // Extract the root cause
                    Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
                    taskFailures.add(TaskFailure.from(id, (Exception) cause, 3));
                }
            }

            if (!taskFailures.isEmpty()) {
                log.error("{} failure(s) after retries:", taskFailures.size());
                for (TaskFailure failure : taskFailures) {
                    log.error("  - {} -> {}: {} ({})",
                              failure.id().start(),
                              failure.id().target(),
                              failure.errorMessage(),
                              failure.errorType());
                }
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
