# AGENTS

## Project Positioning

This project is a Web demo used to verify real Easemob server-side capabilities and behavior.

## Core Rule

All features and scenarios in this demo must reflect the real server response truthfully.

Do not add client-side fallback logic that hides, retries, softens, simulates, or masks server behavior, including but not limited to:

- automatic retry for failed server capability calls
- local success simulation when the server fails
- silent downgrade when the server does not support a capability
- optimistic UI that presents a server capability as successful before the server confirms it
- client-side data patching that makes unsupported or failed server behavior appear normal
- compatibility shims added only to make the demo look “usable”

## Implementation Rules

- Prefer exposing raw server success and failure states in the UI and console.
- If the server returns an error, the demo should surface that error instead of hiding it.
- If a capability is unsupported, unavailable, or misconfigured on the server, the demo should show the real result.
- Do not add “兜底” behavior unless the user explicitly requests a special non-demo behavior for a separate purpose.
- Before adding any new feature, first confirm the implementation path is aligned with the real server capability being verified.
- If a Web SDK behavior differs from a REST behavior, do not merge them into one “successful” experience. Expose the distinction clearly.
- Exposing real errors does not mean crashing the page. Failures should keep the page usable and display normal error feedback.

## Logging Rules

- Keep complete console error output for server capability failures.
- When possible, include key request context needed for troubleshooting, such as message ID, target ID, chat type, and current user.
- Do not replace real errors with vague generic messages unless the user explicitly requests product-style copy.

## Documentation Sync

Whenever a feature is added, removed, or behavior is changed, also update:

- `cases_list.md`
- `.codex/prompts/superpowers.md`

`cases_list.md` should reflect the currently implemented demo capabilities only, and should not include `tests/`-only capabilities.
