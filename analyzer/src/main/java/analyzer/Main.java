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

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

public class Main {
    private static final Logger log = LoggerFactory.getLogger(Main.class);

    public static void main(String[] args) throws IOException {
        if (args.length != 3) {
            System.err.println("Usage: <starts.json> <targets.json> <output.json>");
        }
        var inputStartsFile = new File(args[0]);
        var inputTargetsFile = new File(args[1]);
        var outputFile = new File(args[2]);
        log.info("analyzer (starts {}, targets {}, output {})", inputStartsFile, inputTargetsFile, outputFile);


        DefaultPrettyPrinter jsonPrettyPrinter = new DefaultPrettyPrinter();
        jsonPrettyPrinter.indentArraysWith(DefaultIndenter.SYSTEM_LINEFEED_INSTANCE);

        JsonMapper jsonMapper = JsonMapper.builder()
                .enable(SerializationFeature.INDENT_OUTPUT)
                .changeDefaultPropertyInclusion(incl -> incl.withValueInclusion(JsonInclude.Include.NON_NULL))
                .defaultPrettyPrinter(jsonPrettyPrinter)
                .build();

        List<StartingPlace> inputStarts = jsonMapper.readValue(inputStartsFile, new TypeReference<>() {
        });
        log.info("Read {} ({} starts)", inputStartsFile, inputStarts.size());

        List<TargetPlace> inputTargets = jsonMapper.readValue(inputTargetsFile, new TypeReference<>() {
        });
        log.info("Read {} ({} targets)", inputTargetsFile, inputTargets.size());

        if (outputFile.getParentFile() != null) {
            outputFile.getParentFile().mkdirs();
        }

        Output output;
        try {
            output = jsonMapper.readValue(outputFile, Output.class);
        } catch (JacksonIOException err) {
            output = new Output();
        }

        var analyzer = new Analyzer(output);

        int skipped = 0;
        for (TargetPlace target : inputTargets) {
            for (StartingPlace start : inputStarts) {
                if (output.containsResult(start.id(), target.id())) {
                    skipped++;
                    continue;
                }

                log.info("Analyzing {} from {}", target.id(), start.id());
                Instant startTime = Instant.now();
                analyzer.analyze(start, target);
                Instant endTime = Instant.now();
                log.info("Analyzed {} from {} in {}", target.id(), start.id(), Duration.between(startTime, endTime));

                jsonMapper.writeValue(outputFile, output);
            }
        }
        log.info("Skipped {} analyses as results were already in output", skipped);
        jsonMapper.writeValue(outputFile, output);
    }
}
