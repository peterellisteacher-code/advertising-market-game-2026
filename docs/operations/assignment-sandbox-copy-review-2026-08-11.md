# Assignment Sandbox copy review — 11 August 2026

## Stable input

- Scope: the complete `STUDENT_COPY.assignmentSandbox` object used by the sandbox badge, assignment planner, student-image upload and sandbox advertisement-realisation controls.
- UTF-8 JSON size: 4,038 bytes.
- SHA-256: `f07bcb4c484454cd659b85bceb54a235909da9475bad45de815b324ae7edd09e`.
- Required terms retained: AIDA, Attention, Interest, Desire, Action, salience, framing, reading pathway, vector lines, rule of thirds, colour contrast and harmony, pattern, balance and symmetry.

## Content-pedagogy check

The stable corpus passed the project check. It:

- distinguishes a feature, benefit, value, audience response and visible evidence;
- makes Product AIDA and Advertisement AIDA two separate thinking moves;
- uses the page-5 Desire values and composition terminology accurately;
- gives a clear first move without supplying a product, value, message or layout answer; and
- keeps the longer planning surfaces inside native, keyboard-reachable collapsed sections.

## Frozen plain-language review

The frozen `@preset/plain-language-coach` route was invoked exactly once on the stable input. The runner completed successfully and saved the returned response byte-for-byte at:

`release-evidence/assignment-sandbox-plain-language-review-20260811.txt`

- Returned review size: 7,473 bytes.
- Returned review SHA-256: `07d3692b8e49253f074273999096c990d95bb5e99ac78a82c25d91d75990a2b0`.
- Terminal register finding: the remaining suggestions were described as orientation and scaffolding additions, not register failures in the existing sentences.

### Adopted changes

None. The review did not identify a plain-language defect in an existing visible sentence that could be corrected without changing the assignment scope or adding new teaching content.

### Rejected changes

- The proposed completion rule was rejected because an uploaded image is optional and completing these fields does not by itself complete the assignment.
- The proposed mug example was rejected because a worked product answer could steer or be copied by students.
- The proposed advertising-location examples were rejected because they could narrow the student's independently chosen context.
- The proposed composition glosses were rejected because they expanded a compact reference into prescriptive hints; the proposed rule-of-thirds wording was also narrower than the source concept.
- The proposed extra file-signature explanation was rejected because the existing error already states the problem and gives the supported-file recovery path elsewhere in the same upload surface.
- Internal JSON property names mentioned in the critique are not rendered labels; the interface presents the governed student-facing field labels instead.

The reviewed corpus therefore remained byte-for-byte unchanged at its recorded input hash.

## Claude-scrubber MICROCOPY route

No callable Claude-scrubber or MICROCOPY tool exists in the current Codex tool catalog. The repository contains historical slash-command references but no executable route, and the local `.claude` launch/settings files expose no scrubber command. In accordance with the plan, no substitute model was used and the frozen plain-language request was not repeated. Deterministic corpus-source and professional-contract tests are the fallback evidence for this release.
