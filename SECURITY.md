# Security policy

## Supported version

Security fixes are applied to the current `main` branch.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability, exposed credential
or path to student data. Use the repository's **Security** tab to submit a
private vulnerability report.

Include:

- the affected route, file or component;
- the conditions needed to reproduce the issue;
- the likely impact; and
- a minimal reproduction that contains no real credentials or personal data.

Do not test against a real class, production account or another person's
Supabase or Netlify project. Use fake local data and infrastructure you control.

Classroom passwords and deployment credentials are operational configuration,
not public test data. If a credential is exposed, revoke it immediately before
reporting the source-level defect.
