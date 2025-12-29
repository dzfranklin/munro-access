import { data } from "react-router";
import type { Route } from "./+types/munro";
import { munroMap, targetMap } from "results/parse";
import type { Target } from "results/schema";
import RouteNameComponent from "~/RouteNameComponent";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData.munro.name }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const number = parseInt(params.slug.split("-")[0]);
  if (Number.isNaN(number)) {
    throw data(null, { status: 404 });
  }

  const munro = munroMap.get(number);
  if (!munro) {
    throw data(null, { status: 404 });
  }

  const targets: Target[] = [];
  for (const t of targetMap.values()) {
    const routes = t.routes.filter((r) =>
      r.munros.some((m) => m.number === number)
    );
    if (routes.length > 0) {
      targets.push({ ...t, routes });
    }
  }

  return { munro, targets };
}

export default function Munro({ loaderData }: Route.ComponentProps) {
  const { munro, targets } = loaderData;
  return (
    <div className="prose max-w-4xl">
      <h1>{munro.name}</h1>
      <h2>Route starting locations</h2>
      <ul>
        {targets.map((t) => (
          <li key={t.id}>
            <a href={`/target/${t.id}`}>{t.description}</a>
            <ul>
              {t.routes.map((r) => (
                <RouteNameComponent key={r.name} route={r} />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
