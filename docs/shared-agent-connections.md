# Shared platform connections

All agent workspaces can inspect the same owner-level Facebook, Instagram, Meta Ads, Google Ads and YouTube adapters. No duplicate credentials or secrets are passed to browser agents or model prompts. These are global platform-owner accounts; this does not authorize another tenant to use INTECA accounts.

The server performs one read-only identity check at startup and exposes refresh through the existing signed administrator session and advertising action header. Concurrent refreshes coalesce. Evidence expires after 15 minutes and is invalidated when provider environment variables change. No publishing, spending, discount, OAuth permission grant or test message occurs during verification. Logs contain channel, fixed state and timestamp only.

GET `/api/advertising/shared-connections` returns current sanitized evidence. POST `/api/advertising/shared-connections/verify` refreshes all five channels. Every runtime manifest entry references that shared evidence. Configured credentials no longer cause an untested runtime agent to be labeled operational.

This is shared connection access and diagnostics, not an implementation of every advertised agent tool. Existing publishing, campaign, sales and enrollment actions continue through their server-side modules and approval rules. Reading an account does not prove billing, lead webhook delivery, paid conversion attribution, campus enrollment or official fiscal issuance. Those must be tested separately against the configured service.
