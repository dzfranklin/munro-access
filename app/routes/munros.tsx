import type { Route } from "./+types/munros";
import { munroMap as parsedMunros } from "results/parse";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Munros" }];
}

export async function loader({}: Route.LoaderArgs) {
  const munros = Array.from(parsedMunros.values());
  return { munros };
}

export default function Munros({ loaderData }: Route.ComponentProps) {
  const { munros } = loaderData;
  return (
    <div>
      <ul>
        {munros.map((munro) => (
          <li>
            <a href={`/munro/${munro.slug}`}>{munro.name}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
