export { default } from "../function-bundles/product-price-guide.mjs";

export const config = {
  path: ["/api/product-price-guide"],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
