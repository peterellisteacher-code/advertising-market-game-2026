export { default } from "../functions/openverse-image.mjs";

export const config = {
  path: "/api/openverse-image/:id",
  rateLimit: {
    windowLimit: 600,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
