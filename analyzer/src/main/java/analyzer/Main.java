package analyzer;

import analyzer.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
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

        var jsonMapper = JsonMapper.builder().enable(SerializationFeature.INDENT_OUTPUT).build();

        List<StartingPlace> starts = jsonMapper.readValue(inputStartsFile, new TypeReference<>() {
        });
        log.info("Read {} ({} starts)", inputStartsFile, starts.size());

        List<InputTargetPlace> inputTargets = jsonMapper.readValue(inputTargetsFile, new TypeReference<>() {
        });
        log.info("Read {} ({} targets)", inputTargetsFile, inputTargets.size());

        var analyzer = new Analyzer();
        analyzer.analyze(starts, inputTargets);
        Output output = analyzer.output();

        if (outputFile.getParentFile() != null) {
            outputFile.getParentFile().mkdirs();
        }
        jsonMapper.writeValue(outputFile, output);
        log.info("Wrote output {} ({} starts, {} targets)", outputFile, output.starts().size(), output.targets().size());
    }
}
