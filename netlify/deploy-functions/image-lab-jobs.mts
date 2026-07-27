export { default } from "../function-bundles/image-lab-jobs.mjs";

export const config = {
  path: [
    "/api/image-lab/jobs",
    "/api/image-lab/jobs/reconcile",
    "/api/image-lab/assets"
  ],
  rateLimit: {
    windowLimit: 1_200,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
