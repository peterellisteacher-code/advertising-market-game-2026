# Live Advertising Market activation

The live-room backend is configured for Netlify project
`advertising-market-game-2026` (site ID
`fffc6f57-3fd2-44e3-9247-05a5f746351d`). The project has an outer Netlify
visitor password. That outer password protects the site; the distinct pair
accounts inside the game isolate each pair's saved work.

## Server-only environment

The following values are configured in Netlify for function/runtime scope:

```text
MARKET_CLASSROOM_CODE=<teacher-only room-creation code>
MARKET_SIGNING_SECRET=<at least 32 random characters>
```

No secret value belongs in this file, `netlify.toml`, Vite variables, browser
code, HTML, logs, screenshots, or source control. If either value is absent or
invalid, both market functions fail closed with `MARKET_NOT_CONFIGURED`.

The classroom code authorises a teacher to create a room. It is not a pair
account password and is never needed to join an existing room. The signing
secret authenticates short-lived room capabilities and must be rotated between
cohorts if exposure is suspected. Rotating it immediately invalidates every
active room session.

## Classroom lifecycle

1. The teacher creates a room with the teacher-only classroom code, opening
   wallet, and cohort size. The normal default is 15 teams.
2. The game returns a six-character room code in `ABC-234` form. Each pair
   joins with that room code and a display alias.
3. Pairs publish their finished campaign cards. The teacher can approve,
   return, or hide each submission before opening the market.
4. When the teacher opens the market, pairs spend their wallets on other
   teams' products. Their own campaign is never purchasable by that pair.
5. Pairs finish shopping; the teacher opens the reveal only after the market
   phase is complete, then closes the room at the end of the activity.

Room capabilities expire after six hours. State and artwork use the strongly
consistent Netlify Blobs store `advertising-market-live-rooms`. State changes
use compare-and-swap retries, command receipts make retried actions idempotent,
and uploaded artwork is signature-checked PNG data with bounded byte and
per-team limits. Responses are same-origin, private, and `no-store` where they
carry room state or artwork.

## Preview-deploy gate

Complete these checks on a password-protected preview deploy before publishing
student access:

1. Confirm an unauthenticated visitor meets the Netlify password challenge.
2. Create one teacher room with the configured classroom code. Confirm a wrong
   code is denied without creating a room.
3. Join at least three disposable pair teams. Confirm duplicate aliases,
   malformed room codes, and a 16th team in the 15-team default room fail
   closed without changing the room.
4. Publish three distinct PNG campaign cards, review one as approved, one as
   returned, and one as hidden, then confirm only approved current submissions
   appear to buyers.
5. Open the market. Confirm a pair cannot buy its own product, cannot spend
   beyond its wallet, and cannot replay the same request to pay twice.
6. Issue two concurrent purchases against the same wallet and verify the final
   balance and seller receipts are consistent with exactly the accepted
   commands.
7. Finish every pair, open the reveal, and confirm the earnings order and
   purchase totals match the accepted receipts.
8. Reload teacher and pair MacBook tabs during build, review, market, and reveal
   phases. Confirm each resumes only its own role and room.
9. Expire or corrupt a capability and confirm only `INVALID_SESSION` or
   `SESSION_EXPIRED` is returned, with no room snapshot, token, or artwork.
10. Inspect browser and Netlify logs. Confirm they expose no classroom code,
    signing secret, capability token, cookie, pair-account token, or synthetic
    account email.

Production publishing remains blocked until this preview-deploy matrix passes.
Expired room entries are not a licence for silent cleanup: any later deletion
from Netlify Blobs must follow Peter's explicit deletion approval rule.
