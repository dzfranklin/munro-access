import type { Route } from "./+types/munros";
import { munroMap as parsedMunros } from "results/parse.server";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "All Munros - Munro Access" },
    {
      name: "description",
      content: "Complete list of Munros accessible by public transport",
    },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const munros = Array.from(parsedMunros.values()).sort(
    (a, b) => a.number - b.number
  );
  return { munros };
}

export default function Munros({ loaderData }: Route.ComponentProps) {
  const { munros } = loaderData;

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
        <h1 className="font-serif text-[2rem] font-normal text-theme-navy-900 m-0 mb-2.5">
          All Munros
        </h1>
        <p className="font-sans text-base text-gray-600 m-0">
          Complete list of {munros.length} Munros in Scotland
        </p>
      </header>

      {/* Info box */}
      <div className="bg-gray-50 border border-gray-300 p-5 mb-8 leading-relaxed">
        <p className="text-sm text-gray-600 m-0">
          Click on a munro to see which routes include it and view public
          transport options to reach it.
        </p>
      </div>

      {/* Munros table */}
      <section>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="py-2.5 px-2.5 text-left font-bold">Name</th>
              <th className="py-2.5 px-2.5 text-left font-bold">Links</th>
            </tr>
          </thead>
          <tbody>
            {munros.map((munro) => (
              <tr key={munro.number} className="border-b border-gray-200">
                <td className="py-3 px-2.5">
                  <Link
                    to={`/munro/${munro.slug}`}
                    className="text-theme-navy-700 underline font-bold"
                  >
                    {munro.name}
                  </Link>
                </td>
                <td className="py-3 px-2.5">
                  <a
                    href={munro.page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-theme-green-600 underline text-[13px]"
                  >
                    walkhighlands
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

    </>
  );
}
