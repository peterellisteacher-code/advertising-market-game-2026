export { default } from "../function-bundles/image-lab-session.mjs";

export const config = {
  path: ["/api/image-lab/session"],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
