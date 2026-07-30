export { default } from "../function-bundles/account-assets.mjs";

export const config = {
  path: ["/api/account/assets/:sha256"],
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
