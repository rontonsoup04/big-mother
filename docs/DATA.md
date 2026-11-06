# Beehive data guide (for front-end work)

Everything the front end needs is in two files. Import from them; don't query Supabase directly from screens.

- `src/lib/data.js`: sign-in, centres, staff certificates, compliance records, incidents, updates, chat messages
- `src/lib/beehive.js`: audit readiness, certificate self-service, medical updates, parent messages, audit log, file uploads

All functions are `async` and throw an `Error` whose message can be shown to the user as-is. The database enforces who can do what (row-level security), so a screen can't leak data even if it calls the wrong function.

## Roles

| Role | Joins with | Sees |
|---|---|---|
| owner / director | creates the centre | everything for their centre, including the audit log |
| educator | staff code | centre records; only their own certificates; can't approve certificates, medical updates or edit the checklist |
| parent | family code, then linked to a child by the owner | only their own child's medical updates and **sent** messages |

`getMe()` returns `{ id, full_name, role, centre_id, centre: { name, staff_code, family_code } }`.

## Flow 1: Compliance (audit readiness)

| Step | Call | Notes |
|---|---|---|
| 1. Generate checklist | `generateChecklist()` → `getDraftChecklist()` | 16 items across 4 areas, each with `source_ref` (e.g. "Reg 97") and `evidence_hint` |
| 1. Owner removes items | `removeChecklistItem(id)` | |
| 1. Approve | `approveChecklist()` | Becomes the baseline. Nothing is scored until approved. |
| 2. Readiness | `getReadiness()` | `{ score: 88, green, yellow, red, total_items }` → "88% Audit-Ready" |
| 2. Items | `getChecklist()` | Each row: `area`, `title`, `source_ref`, `status` (`green`/`yellow`/`red`), `reason`, `last_updated` |
| 2. Top Gaps | `getTopGaps(5)` | Red first |
| 3. Close a gap | `addEvidence({ centreId, userId, checklistItemId, title, recordedOn, file })` | Item turns green, score updates, audit entry written |
| 4. Spot check | `spotCheckSearch("WWCC")` | Rows: `kind`, `title`, `detail`, `status`, `last_updated` |
| 5. Regulation change | `applyRegulationUpdate(title, summary, ["sleep"])` | Matching items show "Review Required" (yellow) |
| 5. Accept review | `acceptReview(itemId)` | |
| 5. Export | `getAuditReportData()` | Grouped by area with evidence, ready to render as a PDF |

How status is worked out:
- **Documents** (policies, drills): red if no evidence or older than the item's review period, yellow when nearly due.
- **Certificates**: from the staff register. Red if any are expired, yellow if any are expiring.
- **Incidents**: red if any 24-hour notice is overdue.
- **Medical**: yellow or red if parent updates are waiting for approval.

## Flow 2: Staff certification

| Step | Call |
|---|---|
| 1. Portal | `getCertificatePortal()` → each row has `status` and `renewal_state` ("Renewal prompt sent (30 days remaining)", "Renewal submitted, awaiting approval") |
| 2. Reminders | Scheduled automatically in the database when a certificate is added or renewed. Sending SMS/email is not built yet. |
| 3. Educator uploads | `submitCertificate({ centreId, typeCode: "FIRST_AID", expiryDate, file })` |
| 4. Director verifies | `getPendingCertificates()` → `reviewCertificate(id, true)` (register updated, next reminder pushed out) |

## Flow 3: Parent medical updates

| Step | Call |
|---|---|
| 2. Parent submits | `submitMedicalUpdate({ centreId, childId, userId, category: "allergy", condition, instructions, file, confirmed: true })` |
| 3. Automatic receipt | Sent by the database instantly ("Receipt confirmed: Leo's …") |
| 3. Director banner | `getMedicalFlags()` + `watchMedicalFlags(cb)` for live updates |
| 4. Approve & publish | `reviewMedicalUpdate(id, true)` (record locks, parent gets an "active in Room 1" message) |
| 5. Room roster | `getMedicalRoster("Possums")` |

## Messages to parents (AI drafts, staff approve)

Rules built into the database:
- Messages about a child's wellbeing or an incident are always **drafts** until a staff member approves them. A draft can't be inserted as "sent".
- Only **receipts and reminders** send automatically.
- The audit log keeps both the AI draft and the final text for every approved message.

| Step | Call |
|---|---|
| Draft from a note | `draftMessageText({ childFirstName, parentFirstName, note, trigger })` (template for now; the web app uses Claude through beehive-demo/api/ask.js) → `createMessageDraft({...})` |
| Review queue | `getMessageDrafts()`, `updateDraft(id, body)`, `cancelDraft(id)` |
| Send | `approveAndSend(id, finalBody)` (an incident message also marks the parent as notified) |
| Automatic reminder | `requestDocument(childId, "updated immunisation history statement")` |
| Parent inbox | `getSentMessages(childId)`, `markMessagesRead(childId)`, `watchParentMessages(childId, cb)` |

## Files

`uploadFile(centreId, folder, file)` stores files in the private `beehive` bucket at `<centre_id>/<folder>/…`. `fileUrl(path)` returns a 5-minute viewing link. Parents can only use `<centre_id>/medical/<their child's id>/…`.

## Demo data

Owner/director: `loadDemoData()` then `loadBeehiveDemo()`. The centre ends up about 60% audit-ready, with red gaps for the 2023 sun protection policy, an evacuation drill not logged this quarter, expired first aid/CPR and overdue incident notices, plus one AI message draft waiting for approval.

## Not built yet

- Sending SMS/email (reminders and messages are recorded and shown in-app; connect Twilio/Resend or Power Automate)
- Reading the expiry date from a certificate photo (needs a vision model; `extractedByAi` flag is ready)
- Calling an AI model (Claude) for checklist wording and regulation summaries
- PDF rendering of `getAuditReportData()`
