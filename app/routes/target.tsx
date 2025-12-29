import { resultMap, startMap, targetMap } from "results/parse";
import type { Route } from "./+types/target";
import { data } from "react-router";
import { resultID, type Result, type Start, type Target } from "results/schema";
import RouteNameComponent from "~/RouteNameComponent";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData.target.name }];
}

type HydratedResult = Result & { startData: Start; targetData: Target };

export async function loader({ params }: Route.LoaderArgs) {
  const target = targetMap.get(params.id);
  if (!target) {
    throw data(null, { status: 404 });
  }

  const results: HydratedResult[] = [];
  for (const start of startMap.values()) {
    const result = resultMap.get(resultID(start.id, target.id));
    if (result)
      results.push({ ...result, startData: start, targetData: target });
  }

  const gmapsEmbedKey = process.env.GOOGLE_MAPS_EMBED_KEY;

  return { target, results, gmapsEmbedKey };
}

export default function Target({ loaderData }: Route.ComponentProps) {
  const { target, results, gmapsEmbedKey } = loaderData;
  return (
    <div className="prose max-w-4xl">
      <h1>{target.description}</h1>

      <iframe
        width="500"
        height="300"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen={true}
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://www.google.com/maps/embed/v1/place?q=${target.lngLat[1]}%2C${target.lngLat[0]}&zoom=8&key=${gmapsEmbedKey}`}
      ></iframe>

      <h2>Hikes from {target.name}</h2>
      <ul>
        {target.routes.map((r) => (
          <li key={r.page}>
            <RouteNameComponent route={r} />
          </li>
        ))}
      </ul>

      <h2>Getting to {target.name} by public transit</h2>
      {results.map((r) => (
        <ResultComponent result={r} key={`${r.start}:${r.target}`} />
      ))}
    </div>
  );
}

function ResultComponent({ result: r }: { result: HydratedResult }) {
  return (
    <div>
      <h3>
        From {r.startData.name} to {r.targetData.name}
      </h3>

      {Object.entries(r.itineraries).map(([day, itineraries]) => (
        <div key={day}>
          <p>{day}</p>
          {itineraries.outbounds.length} outbound, {itineraries.returns.length}{" "}
          returns
        </div>
      ))}
    </div>
  );
}
