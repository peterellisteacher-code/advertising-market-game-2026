export { default } from "../function-bundles/account-session.mjs";

export const config = {
  path: [
    "/api/account/signup",
    "/api/account/login",
    "/api/account/session",
    "/api/account/logout"
  ],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
