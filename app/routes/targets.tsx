import type { Route } from "./+types/targets";
import { targetMap as parsedTargets } from "results/parse";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "All Route Locations - Munro Access" },
    {
      name: "description",
      content: "Complete list of route starting locations for Munros",
    },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const targets = Array.from(parsedTargets.values()).sort((a, b) =>
    a.description.localeCompare(b.description)
  );
  return { targets };
}

export default function Targets({ loaderData }: Route.ComponentProps) {
  const { targets } = loaderData;

  return (
    <>
      {/* Navigation */}
      <nav className="mb-6">
        <Link
          to="/"
          className="text-traditional-navy-700 underline text-sm hover:no-underline"
        >
          Back to all routes
        </Link>
      </nav>

      {/* Header */}
      <header className="border-b-[3px] border-traditional-navy-700 pb-4 mb-6">
        <h1 className="font-serif text-[2rem] font-normal text-traditional-navy-900 m-0 mb-2.5">
          All Route Locations
        </h1>
        <p className="font-sans text-base text-gray-600 m-0">
          {targets.length} starting locations for Munro routes
        </p>
      </header>

      {/* Info box */}
      <div className="bg-gray-50 border border-gray-300 p-5 mb-8 leading-relaxed">
        <p className="text-sm text-gray-600 m-0">
          These are the trailhead locations where routes begin. Click on a
          location to see all available routes and public transport options.
        </p>
      </div>

      {/* Targets table */}
      <section>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="py-2.5 px-2.5 text-left font-bold">Location</th>
              <th className="py-2.5 px-2.5 text-left font-bold">Description</th>
              <th className="py-2.5 px-2.5 text-left font-bold">Routes</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => (
              <tr key={target.id} className="border-b border-gray-200">
                <td className="py-3 px-2.5 align-top">
                  <span className="text-gray-600 text-[13px]">
                    {target.name}
                  </span>
                </td>
                <td className="py-3 px-2.5 align-top">
                  <Link
                    to={`/target/${target.id}`}
                    className="text-traditional-navy-700 underline font-bold"
                  >
                    {target.description}
                  </Link>
                </td>
                <td className="py-3 px-2.5 align-top text-gray-600">
                  {target.routes.length} route
                  {target.routes.length !== 1 ? "s" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

    </>
  );
}
