export { default } from "../function-bundles/openverse-search.mjs";

export const config = {
  path: "/api/openverse-search",
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
