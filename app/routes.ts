import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("munros", "routes/munros.tsx"),
  route("munro/:slug", "routes/munro.tsx"),
  route("target/:id", "routes/target.tsx"),
] satisfies RouteConfig;
