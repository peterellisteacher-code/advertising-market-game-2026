export { default } from "../functions/market-session.mjs";

export const config = {
  path: ["/api/market/create", "/api/market/join"],
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
