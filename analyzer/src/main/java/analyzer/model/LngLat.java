package analyzer.model;

import org.opentripplanner.client.model.Coordinate;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonGenerator;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.annotation.JsonDeserialize;
import tools.jackson.databind.annotation.JsonSerialize;
import tools.jackson.databind.deser.std.StdDeserializer;
import tools.jackson.databind.ser.std.StdSerializer;

@JsonDeserialize(using = LngLat.LngLatDeserializer.class)
@JsonSerialize(using = LngLat.LngLatSerializer.class)
public record LngLat(double lng, double lat) {
    static class LngLatDeserializer extends StdDeserializer<LngLat> {
        public LngLatDeserializer() {
            super(LngLat.class);
        }

        @Override
        public LngLat deserialize(JsonParser p, DeserializationContext ctxt) {
            double[] coords = p.readValueAs(double[].class);
            if (coords.length != 2) {
                throw new IllegalArgumentException("Expected array of 2 doubles for LngLat");
            }
            return new LngLat(coords[0], coords[1]);
        }
    }

    static class LngLatSerializer extends StdSerializer<LngLat> {
        public LngLatSerializer() {
            super(LngLat.class);
        }


        @Override
        public void serialize(LngLat value, JsonGenerator gen, SerializationContext provider) throws JacksonException {
            gen.writeArray(new double[]{value.lng, value.lat}, 0, 2);
        }
    }
}
