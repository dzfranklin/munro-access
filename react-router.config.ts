import type { Config } from "@react-router/dev/config";

import { startMap, targetMap, munroMap, resultMap } from "./results/parse";

export default {
  ssr: false,
  async prerender({ getStaticPaths }) {
    const munroRoutes = Array.from(munroMap.values()).map(
      (m) => `/munro/${m.slug}`
    );

    const targetRoutes = Array.from(targetMap.values()).map(
      (t) => `/target/${t.id}`
    );

    return [...getStaticPaths(), ...munroRoutes, ...targetRoutes];
  },
} satisfies Config;
