# Chat Sales Studio

Internal team chat is independent of leads. Customer conversations remain reachable from each lead and from the internal chat when customer leads are loaded.

The administrator sees all 21 agent personas. Each employee gets an individual login created under Chat Sales Studio > Accesos del personal por área. Server-side area and organization checks determine which agents and histories the employee may read. The role selector does not grant permissions. Inventory shares the purchasing agents. Chat threads are shared among authorized members of the same area and the owner.

Persistent Supabase tables store hashed member passwords (scrypt with random salts), hashed 8-hour session tokens, conversations, shared planning notes, and work requests. Anonymous and authenticated Data API roles have no table grants; the server service role accesses them after authorization. Disabling a member blocks existing sessions on the next request. Switching between owner and employee logins clears the other session cookie. Staff logins expose only internal chat navigation. Staff accounts are not automatically emailed.

Shared course dates, metrics, and briefs are explicitly entered through the planning form. They are appended with author and timestamp and included in subsequent agent conversations. Messages use the most recent 25 messages as model context; the UI loads the most recent 100. Older records remain stored. Planning context uses the 30 latest shared entries; the UI displays the latest 50. This is bounded context, not unlimited model memory. Task lists show the latest 100 requests.

Agents generate text proposals, plans, analyses, and deliverables through the existing Gemini service. They do not execute external campaigns, spending, emails, bank validation, enrollment, fiscal issuance, or background jobs from this chat. Work requests are stored as requested; humans record progress and completion with a note. Provider execution must use the corresponding connected module. No claimed guaranteed results or unauthorized discounts.

The INTECA owner organization uses the existing server knowledge source. Other organizations use their own shared context, without importing INTECA's catalog.

Verification: typecheck/build; API tests for unauthenticated denial, area and organization isolation, staff creation/login/disable, shared notes, request idempotency and payload mismatch; database RLS/grant inspection and a rolled-back storage roundtrip. Live provider response and a real employee account require an authenticated session; no production test employees are created automatically.
