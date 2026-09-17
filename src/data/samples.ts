import type { SampleMeta } from "../types.ts";

export const PASTE_PLACEHOLDER = `Paste a Hermes / OpenClaw SKILL.md.

---
name: example-skill
description: Use this when the operator needs a bounded playbook.
triggers:
  - example
tools:
  - shell
---

# Example skill

## When to Use

- The operator asks for a bounded playbook

## Steps

1. Read the request.
2. Follow the steps.
3. Stop for a human on anything consequential.
`;

export const SAMPLES: SampleMeta[] = [
  {
    id: "inbox-triage",
    file: "/samples/inbox-triage.md",
    label: "Inbox triage",
    blurb: "Solid playbook",
    tone: "playbook",
  },
  {
    id: "standup-notes",
    file: "/samples/standup-notes.md",
    label: "Standup notes",
    blurb: "Good stub",
    tone: "stub",
  },
  {
    id: "release-runbook",
    file: "/samples/release-runbook.md",
    label: "Release train",
    blurb: "Oversized",
    tone: "oversize",
  },
  {
    id: "lab-letter",
    file: "/samples/lab-letter.md",
    label: "Lab letter",
    blurb: "No frontmatter",
    tone: "warn",
  },
];
