# Fetch cookie-order primary-source reference

Read-only standards lookup recorded 2026-07-18. This file is evidence of the
source consulted; it is not a substitute for browser integration testing.

Primary source: WHATWG Fetch Standard,
<https://fetch.spec.whatwg.org/>.

- HTTP-network-fetch steps 16–18 (source lines 3167–3173 in the fetched
  document) process and store response `Set-Cookie` headers at step 17 before
  beginning the parallel response-body transmission loop at step 18.
- The Fetch API response-processing guidance (source lines 4925–4930) states
  that a response is handed to its caller after headers are processed and that
  a caller may handle a non-OK status without reading the body.
- The `Set-Cookie` algorithm itself is defined at §3.1.2 (source lines
  1641–1662) and processes each response cookie independently.

Operational consequence for this project: an exclusive Web Lock held from
before `fetch()` until its promise resolves covers the browser's cookie mutation.
Keeping the lock through bounded parsing of accepted bodies is additional
serialization; deliberately ignoring a 401 body does not release the lock before
its `Set-Cookie` headers are processed.
