---
name: release-runbook
description: Use this when a tagged release is going out and the operator needs a bounded train, rollback, and human holds.
version: "2.4.0"
license: MIT
triggers:
  - tagged release
  - cut the train
  - prod deploy
  - rollback window
tools:
  - name: git
    purpose: tag and inspect the train
  - name: gh
    purpose: checks, release notes, holds
  - name: shell
    purpose: build, migrate, smoke
  - name: pager
    purpose: page the on-call if smoke fails
metadata:
  openclaw:
    requires:
      bins:
        - git
        - gh
        - docker
      env:
        - GH_TOKEN
  hermes:
    tags:
      - release
      - ops
      - production
---

# Release runbook

Ship a tagged build with a written rollback and a human on the merge. This file is intentionally long so the card has to truncate.

## When to Use

- A release tag is requested for production
- Staging is green and the operator says cut the train
- A rollback window is still open from the last ship
- Hotfix on a frozen branch
- The weekly train is late and people want to "just ship"

## Steps

1. Confirm the tag name, the target environment, and who is on-call for the next two hours.
2. Read the last release notes and the open incidents. If anything sev-1 is live, stop.
3. Diff main against the previous tag. List migrations, feature flags, and irreversible steps.
4. Run the test suite and the staging smoke. Record the SHA that went green.
5. Draft the release notes. Do not publish yet.
6. Ask a human to approve the production deploy. Name them in the log.
7. Tag the SHA. Push the tag. Do not move the tag after it is public.
8. Apply migrations with a backup taken first. Pause if a migration is irreversible and unreviewed.
9. Roll the app. Watch error rate, latency, and the first five synthetic checks.
10. Run the smoke script against production URLs, not localhost.
11. Publish the notes only after smoke is green for ten minutes.
12. Stay in the channel until the rollback window closes or the on-call takes the watch.
13. If smoke fails, roll back to the previous tag. Do not forward-fix in production.
14. File the post-ship note: SHA, tag, on-call, what was refused.

## Inputs / tools

- **git** — tags, diffs, SHA
- **gh** — checks, release, holds
- **docker** — image build and push
- **shell** — migrate and smoke
- **pager** — wake a human

## Refuse

- Do not skip tests because the train is late.
- Do not deploy from a dirty working tree.
- Do not run irreversible migrations without a named human.
- Do not publish secrets, tokens, or customer data in the notes.
- Do not force-push the release tag.
- Do not page the whole company for a yellow check.

## Rollback

1. Revert traffic to the previous tag.
2. Restore the backup only if a migration already landed.
3. Write the incident stub. A human owns the rest.

## Success criteria

- Tag points at the green SHA.
- Smoke is green.
- Notes are public and secret-free.
- On-call is named.
- Rollback was written before the ship, not after.

## Pitfalls

- "Quick hotfix" that skips staging.
- Moving a published tag.
- Running the smoke against the laptop.

## Changelog dump (padding)

The following is operator lore that should not all land on a one-pager. Keep it in the skill file, not the card.

- 2024-11: first train, manual docker login, too many pings.
- 2024-12: added rollback section after a bad migration.
- 2025-02: required named human on irreversible steps.
- 2025-04: stopped publishing notes before smoke.
- 2025-06: bins list for OpenClaw.
- 2025-08: pager only for red smoke, not yellow checks.
- 2025-10: freeze window during the lab letter week.
- 2026-01: this file got too long on purpose.
- 2026-03: still too long.
- 2026-06: yes, still.

If you are reading this on the card, the compositor failed to truncate. Cut it.
