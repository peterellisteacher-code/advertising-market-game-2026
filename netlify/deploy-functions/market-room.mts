export { default } from "../function-bundles/market-room.mjs";

export const config = {
  path: [
    "/api/market/resume",
    "/api/market/snapshot",
    "/api/market/artwork",
    "/api/market/publish",
    "/api/market/purchase",
    "/api/market/finish",
    "/api/market/review",
    "/api/market/control"
  ],
  rateLimit: {
    windowLimit: 1_200,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
