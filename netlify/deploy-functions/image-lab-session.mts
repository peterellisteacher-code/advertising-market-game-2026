export { default } from "../functions/image-lab-session.mjs";

export const config = {
  path: ["/api/image-lab/config", "/api/image-lab/unlock"],
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
