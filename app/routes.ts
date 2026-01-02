import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

export default [
  layout("routes/_layout.tsx", [
    index("routes/home.tsx"),
    route("munros", "routes/munros.tsx"),
    route("munro/:slug", "routes/munro.tsx"),
    route("target/:id", "routes/target.tsx"),
    route(
      "target/:id/all-itineraries",
      "routes/target.$id.all-itineraries.tsx"
    ),
    route("targets", "routes/targets.tsx"),
    route("_scoring", "routes/scoring.tsx"),
  ]),
] satisfies RouteConfig;
