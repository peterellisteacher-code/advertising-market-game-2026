export { default } from "../function-bundles/studio-coach.mjs";

export const config = {
  path: ["/api/image-lab/coach"],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
