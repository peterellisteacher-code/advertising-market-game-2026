export { default } from "../function-bundles/teacher-accounts.mjs";

export const config = {
  path: [
    "/api/teacher/accounts",
    "/api/teacher/accounts/:username/password",
    "/api/teacher/accounts/:username/reset"
  ],
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
