---
name: inbox-triage
description: Use this when unread mail from overnight needs sorting into act, hold, or archive.
version: "1.0.0"
license: MIT
triggers:
  - unread overnight
  - inbox zero
tools:
  - name: email
    purpose: read and draft mail
  - name: calendar
    purpose: park holds
metadata:
  hermes:
    tags:
      - workflow
      - email
---

# Inbox triage

Inbox to zero with holds parked for a human. Draft, do not send.

## When to Use

- Unread mail piled up overnight
- The operator asks to triage, sort, or clear the inbox

## Steps

1. Scan subject and sender for the last 24 hours. Skip anything already labeled.
2. Draft replies for routine asks — do not send.
3. Hold threads that need a human (money, legal, unknown vendors) and write why.
4. Archive newsletters and noise. Record the counts: acted, held, archived.

## Inputs / tools

- **email** — read and draft mail
- **calendar** — park review holds
- Input: last 24h window

## Refuse

- Do not auto-reply to lawyers or strangers asking for money.
- Do not send mail without a human read.
- Do not download or forward attachments that look like credentials or invoices you cannot verify.

## Success criteria

- Unread is zero, or remaining unread is listed with a reason.
- Every hold has a one-line why.
- No message was sent.
