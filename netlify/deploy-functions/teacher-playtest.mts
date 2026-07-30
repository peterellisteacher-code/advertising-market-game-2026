export { default } from "../function-bundles/teacher-playtest.mjs";

export const config = {
  path: [
    "/api/teacher/playtest/progress",
    "/api/teacher/playtest/assets/:digest",
    "/api/teacher/playtest/reset"
  ],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
