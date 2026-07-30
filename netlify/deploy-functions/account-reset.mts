export { default } from "../function-bundles/account-reset.mjs";

export const config = {
  path: ["/api/account/reset"],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
