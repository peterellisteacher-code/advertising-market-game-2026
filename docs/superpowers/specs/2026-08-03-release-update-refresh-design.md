# Release Update Refresh Design

## Problem

An installed service worker can keep an older application shell open after a
new production release. This can leave students on obsolete login code even
though Netlify is serving the corrected release.

## Approved behaviour

The generated release service worker will refresh existing game tabs only when
a different, complete release activates:

1. Installation must successfully verify and cache every core release asset.
2. The release cache identity combines the static-asset hash with an explicit
   worker-policy revision, so a worker-only policy change also creates a new
   release cache.
3. Activation checks whether an older `ad-market-*` release cache exists.
4. If an older release exists, the worker removes obsolete release caches and
   navigates each currently controlled window client to its existing URL once.
5. If no older release exists, the worker treats this as first installation and
   does not refresh the page.

Ordinary visits, update checks that find no changed worker, and failed installs
must never trigger a refresh. API routes remain outside the service-worker
cache, so the change does not alter account progress or asset persistence.

## Why the worker owns the refresh

A page-level `controllerchange` listener cannot repair the first affected tab
because its stale JavaScript predates that listener. The newly activated worker
can refresh a controlled stale tab without relying on application code already
loaded in that tab.

## Safety and failure handling

- The new release becomes active only after its core precache has completed.
- A refresh is tied to the presence of a previous release cache, not to page
  load or registration.
- Navigation retains the current path and query string.
- A client that has already closed or cannot be navigated is ignored; it must
  not prevent other clients or cache cleanup from completing.
- An expired Netlify visitor session can still block the new worker download.
  The visitor gate must be unlocked once in that situation; the worker can then
  install and perform the release refresh.

## Verification

Build-contract tests will prove that the generated worker:

- refreshes controlled window clients when an older release cache exists;
- does not refresh on first installation;
- performs refresh only after a successful verified install and activation;
- preserves API and release-metadata network bypasses; and
- retains the network-first navigation strategy and offline fallback.

The focused tests, typecheck, production build, repository synchronisation
gate, and hosted production smoke check must pass before completion is claimed.
