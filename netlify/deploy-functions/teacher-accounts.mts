export { default } from "../function-bundles/teacher-accounts.mjs";

export const config = {
  path: [
    "/api/teacher/accounts",
    "/api/teacher/accounts/:username/password",
    "/api/teacher/accounts/:username/reset",
    "/api/teacher/image-lab",
    "/api/teacher/image-lab/global",
    "/api/teacher/image-lab/accounts/:username",
    "/api/teacher/image-lab/accounts/:username/add",
    "/api/teacher/image-lab/accounts/:username/revoke",
    "/api/teacher/image-lab/batch"
  ],
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
