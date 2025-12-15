package analyzer;

import analyzer.model.InputTargetPlace;
import analyzer.model.LngLat;
import analyzer.model.StartingPlace;
import org.junit.jupiter.api.*;

import java.io.IOException;
import java.time.DayOfWeek;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AnalyzerTest {
    final StartingPlace start1 = new StartingPlace("edinburgh", null, new LngLat(-3.188159, 55.95186), 2000);
    final InputTargetPlace target1 = new InputTargetPlace("c1", null, new LngLat(-3.84325, 56.7745));
    // Debug start1 -> target1: <http://localhost:8080/?variables=%257B%2522from%2522%253A%257B%2522coordinates%2522%253A%257B%2522latitude%2522%253A55.95186%252C%2522longitude%2522%253A-3.188159%257D%257D%252C%2522to%2522%253A%257B%2522coordinates%2522%253A%257B%2522latitude%2522%253A56.7745%252C%2522longitude%2522%253A-3.84325%257D%257D%252C%2522dateTime%2522%253A%25222025-12-15T01%253A35%253A59.818Z%2522%257D#5.07/56.44/-3.87>
}
