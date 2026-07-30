# Live Advertising Market activation

The live market is optional. It uses same-origin Netlify Functions and a
strongly consistent Netlify Blobs store. Each installation must use its own
Netlify site, secrets and disposable test data.

## Server-only environment

Configure these values for Function/runtime scope:

```text
NETLIFY_SITE_ID=<site-id>
MARKET_CLASSROOM_CODE=<teacher-only room-creation code>
MARKET_SIGNING_SECRET=<at least 32 random characters>
```

No secret value belongs in this file, `netlify.toml`, Vite variables, browser
code, HTML, logs, screenshots or source control. If either market value is
absent or invalid, both market Functions fail closed with
`MARKET_NOT_CONFIGURED`.

The classroom code authorises a teacher to create a room. It is not a pair
password and is not needed to join an existing room. The signing secret
authenticates short-lived room capabilities. Rotate it between cohorts or
after suspected exposure; rotation invalidates active room sessions.

## Runtime boundaries

- The normal room limit is 15 teams.
- Room capabilities expire after six hours.
- State and artwork use the `advertising-market-live-rooms` Netlify Blobs
  store.
- State changes use compare-and-swap retries and idempotent command receipts.
- Artwork must be signature-checked, bounded PNG data.
- Responses carrying room state or artwork are same-origin, private and
  `no-store`.

## Preview-deploy gate

Complete this matrix on an isolated preview deploy before enabling student
access:

1. Create a teacher room with the configured classroom code. Confirm a wrong
   code creates no room.
2. Join disposable pair teams. Confirm duplicate aliases, malformed room codes
   and a 16th team in the 15-team default room fail closed without changing
   room state.
3. Publish distinct PNG campaign cards and exercise approve, return and hide.
   Confirm buyers see only approved current submissions.
4. Open the market. Confirm a pair cannot buy its own product, overspend or
   replay one request to pay twice.
5. Issue concurrent purchases against one wallet. Verify balances and seller
   receipts record exactly the accepted commands.
6. Complete the room, open the reveal and verify the ordering and totals.
7. Reload teacher and pair tabs in every phase. Confirm each resumes only its
   own role and room.
8. Expire or corrupt a capability. Confirm the response contains only
   `INVALID_SESSION` or `SESSION_EXPIRED`, with no room snapshot, token or
   artwork.
9. Inspect browser and Function logs. Confirm they expose no classroom code,
   signing secret, capability, cookie, account token or synthetic email.

Production publication remains blocked until the preview matrix passes. Do
not remove expired room data without an explicit, scoped retention decision.
