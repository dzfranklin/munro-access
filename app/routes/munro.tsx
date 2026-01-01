import { data, Link } from "react-router";
import type { Route } from "./+types/munro";
import { munroMap, targetMap } from "results/parse.server";
import type { Target } from "results/schema";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData.munro.name} - Munro Access` },
    {
      name: "description",
      content: `Routes to climb ${loaderData.munro.name} by public transport`,
    },
  ];
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
    <>
      {/* Navigation */}
      <nav className="mb-6">
        <Link
          to="/"
          className="text-theme-navy-700 underline text-sm hover:no-underline"
        >
          Back to all routes
        </Link>
      </nav>

      {/* Header */}
      <header className="border-b-[3px] border-theme-navy-700 pb-4 mb-6">
        <h1 className="font-serif text-[2rem] font-normal text-theme-navy-900 m-0">
          {munro.name}
        </h1>
      </header>

      {/* Munro info */}
      <div className="mb-8">
        <a
          href={munro.page}
          target="_blank"
          rel="noopener noreferrer"
          className="text-theme-navy-700 underline text-sm"
        >
          View on walkhighlands
        </a>
      </div>

      {/* Routes section */}
      <section>
        <h2 className="font-serif text-2xl font-normal text-theme-navy-900 border-b-2 border-gray-300 pb-2 mb-6">
          Routes to {munro.name}
        </h2>

        {targets.length === 0 ? (
          <div className="bg-gray-50 border border-gray-300 p-5 text-sm text-gray-600">
            No routes found for this munro.
          </div>
        ) : (
          <div className="space-y-6">
            {targets.map((target) => (
              <div key={target.id} className="border-b border-gray-200 pb-6">
                <h3 className="font-serif text-lg font-bold text-theme-navy-900 mb-1">
                  <Link
                    to={`/target/${target.id}`}
                    className="text-theme-navy-700 underline"
                  >
                    {target.name}
                  </Link>
                </h3>
                {target.description !== target.name && (
                  <p className="text-sm text-gray-600 mb-3">
                    {target.description}
                  </p>
                )}

                <div className="pl-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-2">
                    Routes from this location:
                  </h4>
                  <ul className="list-none m-0 p-0 space-y-2">
                    {target.routes.map((route) => (
                      <li key={route.page}>
                        <div className="text-theme-navy-700 text-sm">
                          {route.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {route.stats.distanceKm}km •{" "}
                          {route.stats.timeHours.min}-
                          {route.stats.timeHours.max}h • {route.stats.ascentM}m
                          ascent •{" "}
                          <a
                            href={route.page}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            walkhighlands
                          </a>
                        </div>
                        {route.munros.length > 1 && (
                          <div className="text-xs text-gray-500 mt-1">
                            Also includes:{" "}
                            {route.munros
                              .filter((m) => m.number !== munro.number)
                              .map((m, idx, arr) => (
                                <span key={m.number}>
                                  <Link
                                    to={`/munro/${m.number}-${m.name
                                      .toLowerCase()
                                      .replace(/\s+/g, "-")
                                      .replace(/[^a-z0-9-]/g, "")}`}
                                    className="text-theme-navy-700 underline"
                                  >
                                    {m.name}
                                  </Link>
                                  {idx < arr.length - 1 && ", "}
                                </span>
                              ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
