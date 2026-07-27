# Fresh isolated release-readiness code review

- Candidate: `726cfad84fd5a1d12ab2266b220c6a1c2470cc83`
- Evidence head: `3d0cac2af89a7dab28bb19af3740feda1601e01f`
- Reviewer: fresh isolated Superpowers review (`gpt-5.6-sol`, high reasoning)
- Review mode: read-only

## Strengths

- Teacher routes, same-origin mutation checks, server-held secrets, and password-rotation session invalidation are well separated.
- Image Lab has strong server-authoritative allowance, idempotency, timeout, and uncertain-job reconciliation foundations.
- The candidate includes broad deterministic tests, build contracts, release verification, and fail-closed public-snapshot checks.

## Issues

### Critical (Must Fix)

- `netlify/functions/lib/teacher-account-service.ts:348`, `web/src/main.ts:2110`, `web/src/persistence/account-scoped-draft-store.ts:33` — **Teacher pair reset does not clear or quarantine the pair’s browser state.** The server deletes cloud progress/assets but neither invalidates active pair sessions nor records a reset generation. On login, the client reopens stores derived only from the username before cloud recovery; an already-open pair tab can also continue operating. This contradicts the stated deletion of drafts, designs, uploaded images, and cloud saves, and permits stale work to survive or be saved again. Add a password-preserving session invalidation/reset-generation operation, return that generation at session bootstrap, and purge every username-scoped store/outbox before sync whenever the generation changes. Cover active-tab, shared-device relogin, and save/reset race cases.

### Important (Should Fix)

- `netlify/functions/lib/teacher-account-service.ts:398`, `netlify/functions/lib/teacher-account-service.ts:451`, `netlify/functions/lib/teacher-account-service.ts:519` — **One teacher allowance action is split across independent RPC transactions.** Global enablement is written before either default; account changes split Object Forge and Make It Real; batch changes loop through pairs. A later failure therefore leaves a partially applied action—potentially enabling Image Lab with stale defaults—even though the UI presents one save. Move each logical global/account/batch mutation into one advisory-locked database transaction accepting the full payload, with one journal result and rollback on failure.

- `netlify/functions/lib/teacher-account-service.ts:708`, `web/src/teacher/teacher-dashboard.ts:823`, `web/src/teacher/teacher-dashboard.ts:941`, `web/src/teacher/teacher-dashboard.ts:991` — **Uncertain account operations cannot be reconciled through the product.** A journal record left in `started` permanently rejects the original operation, while each UI retry generates a new operation ID. This can strand a successfully created user or partially completed reset, despite the operations guide requiring inspection of account and operation state. Retain the same ID until a definitive result, expose operation-status lookup, and make journal stages resumable or explicitly reconcilable.

- `web/src/teacher/teacher-dashboard.ts:663`, `web/src/teacher/teacher-playtest-controller.ts:120` — **Teacher dialogs claim modal semantics without providing them.** Setting `<dialog open>` plus `aria-modal="true"` does not create a modal top layer, inert the background, or constrain Tab focus; keyboard users can reach controls behind destructive confirmation dialogs. Use `showModal()`/`close()` and native cancellation, or implement background inerting and a complete focus trap, retaining focus restoration and pending-operation protection.

### Minor (Nice to Have)

None.

## Recommendations

- Fix the reset-generation/session boundary first, then add an end-to-end regression proving a remote teacher reset cannot expose or resurrect prior browser work.
- Make allowance mutations transactionally match the UI actions before enabling paid Image Lab use.
- Add keyboard traversal tests for every teacher dialog.
- **Pending:** required hosted browser QA at 1280×800, 1440×900, and 768×900 has not run. Safari, school-wifi behaviour, and hosted teacher-routing behaviour therefore remain unmeasured.

## Assessment

**Ready to merge?** No

**Reasoning:** The selected-pair reset does not satisfy its documented destructive-data contract, and required hosted browser QA remains pending. The allowance transaction and operation-reconciliation gaps should also be resolved before release.
