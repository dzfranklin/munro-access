import type { Config } from "@react-router/dev/config";

import { munroMap } from "./app/results/parse.server";

export default {
  async prerender({ getStaticPaths }) {
    const munroRoutes = Array.from(munroMap.values()).map(
      (m) => `/munro/${m.slug}`
    );

    return [...getStaticPaths(), ...munroRoutes];
  },
} satisfies Config;
