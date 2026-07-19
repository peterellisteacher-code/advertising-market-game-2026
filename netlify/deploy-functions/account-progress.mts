export { default } from "../function-bundles/account-progress.mjs";

export const config = {
  path: ["/api/account/progress"],
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
