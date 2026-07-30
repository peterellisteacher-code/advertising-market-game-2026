export { default } from "../function-bundles/teacher-session.mjs";

export const config = {
  path: [
    "/api/teacher/login",
    "/api/teacher/session",
    "/api/teacher/logout"
  ],
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
