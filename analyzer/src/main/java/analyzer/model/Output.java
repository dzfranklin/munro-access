package analyzer.model;

import java.util.List;

public record Output(List<StartingPlace> starts, List<OutputTargetPlace> targets) {
}
