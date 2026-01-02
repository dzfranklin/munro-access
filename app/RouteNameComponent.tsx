import type { Route } from "~/results/schema";

export default function RouteNameComponent({ route }: { route: Route }) {
  return (
    <div>
      {route.name} ({route.stats.distanceKm}km / {route.stats.ascentM}m,{" "}
      {route.stats.timeHours.min}-{route.stats.timeHours.max} hours{" "}
      <a href={route.page} target="_blank">
        walkhighlands
      </a>
      )
    </div>
  );
}
