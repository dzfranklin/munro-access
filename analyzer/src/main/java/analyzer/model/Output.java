package analyzer.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;

public class Output {
    private HashMap<String, StartingPlace> starts = new HashMap<>();
    private HashMap<String, TargetPlace> targets = new HashMap<>();

    private ArrayList<Result> results = new ArrayList<>(); // by target
    private HashSet<String> resultSet = new HashSet<>();

    @JsonProperty
    public void setStarts(List<StartingPlace> starts) {
        this.starts.clear();
        for (var start : starts) {
            this.starts.put(start.id(), start);
        }
    }

    @JsonProperty
    public List<StartingPlace> getStarts() {
        return this.starts.values().stream().toList();
    }

    @JsonProperty
    public void setTargets(List<TargetPlace> targets) {
        this.targets.clear();
        for (var target : targets) {
            this.targets.put(target.id(), target);
        }
    }

    @JsonProperty
    public List<TargetPlace> getTargets() {
        return targets.values().stream().toList();
    }

    @JsonProperty
    public void setResults(ArrayList<Result> results) {
        this.results.clear();
        this.resultSet.clear();
        for (var result : results) {
            this.results.add(result);
            this.resultSet.add(result.id());
        }
    }

    @JsonProperty
    public List<Result> getResults() {
        return this.results;
    }

    public void putStart(StartingPlace start) {
        starts.put(start.id(), start);
    }

    public void putTarget(TargetPlace target) {
        targets.put(target.id(), target);
    }

    public void putResult(Result result) {
        results.add(result);
        resultSet.add(result.id());
    }

    public boolean containsResult(String start, String target) {
        return resultSet.contains(Result.id(start, target));
    }
}
