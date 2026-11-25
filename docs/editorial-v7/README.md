# Editorial diversity, version 7

The automatic community calendar now uses eight vector compositions and twelve teaching angles: concepts, common mistakes, illustrative cases, checklists, comparisons, practice exercises, questions, sequences, plain-language explanations, pre-action checks, challenges and saved guides. Lessons derive from each program's allowlisted catalog topics. No generated testimonial, guaranteed outcome, new price, clinical treatment or stock-photo substitution is introduced.

`community-editorial.ts` contains reviewed teaching notes. `community-editorial-svg.ts` produces shared browser/server artwork. Flyers are 1080×1350 and vertical slides 1080×1920. Existing local MP4 rendering uses the same new artwork. The manual studio defaults to this generator; its existing custom-photo, banner and WebM editor remains available separately.

The rolling planner compares the actual headline and teaching copy with the previous seven days on the same channel. It selects another topic/angle/layout on collision and blocks an exhausted bank instead of inventing facts. The immediate prior composition must differ. Cross-platform copies may share an asset. Persisted payloads are retained unchanged during renewal. A pre-publication check compares again with delivered and uncertain jobs. This is a finite reviewed content bank, not a claim that every future post is globally unique. Expanding the official catalog and editorial notes remains necessary over time.

Deploy the v7 migration before the server. Its RPC only activates when the new runtime calls it. It locks pending jobs while replacing queued legacy slots, skips slots already published or with uncertain external results, preserves history, and prevents an old runtime from downgrading calendar state. It does not resend historic posts, change cadence, enable avatar spending, alter enrollment or change WhatsApp credentials.

## Verification

- TypeScript, ESLint and production build.
- 191 functional tests, including calendar renewal, catalog pricing, duplicate teaching content, conditional publication claims and safe external-outcome handling.
- Six compiled API/authentication/webhook tests; four local video worker tests.
- Real catalog simulation: 660 jobs / 30 days, no exhausted candidates; 960 SVG frames fit without overflow.
- Eight compositions visually reviewed in `contact-sheet.jpg`.
- Database transaction test inserts 22 sample slots, verifies idempotence, retirement of queued legacy jobs, preservation of published/uncertain history and protection against downgrade, then rolls back. Script: `scripts/verify-editorial-calendar.ts`.

The schedule still depends on an awake Render service and valid platform credentials. Avatar scripts remain briefs pending authorized production. No sales or engagement result is fabricated.
