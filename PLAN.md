# Submission Processing Consolidation Plan

## Current State Summary

Three distinct submission types exist, each with different needs:

| Path | Endpoint | Processing | Audit Entity | Target Write |
|------|----------|------------|--------------|--------------|
| **Event Speaker** | `submitSpeakerContent` | Regex + LLM (async) | `SpeakerSubmissionVersion` | `Segment` entity |
| **Weekly Speaker** | `submitWeeklyServiceContent` | Regex + LLM (async) | `SpeakerSubmissionVersion` | `Segment` entity + Service JSON (legacy) |
| **Arts** | `submitArtsSegment` | None (direct write) | `ArtsSubmissionLog` | `Segment` entity |

**Arts is clean and working. No changes needed.** The rest of this plan addresses only the two speaker paths.

---

## Problems Being Solved

1. **Dual automation race**: Every speaker submission triggers BOTH `processNewSubmissionVersion` (on SpeakerSubmissionVersion create) AND `processSegmentSubmission` (on Segment.submission_status='pending'). Both race to parse and write.

2. **Segment ID mismatch**: `processSegmentSubmission` receives a numeric Segment entity ID but filters `SpeakerSubmissionVersion` by that ID. Weekly submissions store composite IDs (`weekly_service|123|9:30am|0|plenaria`), so the filter never matches. Weekly processing only works because `processNewSubmissionVersion` compensates.

3. **Dead code bloat**: `processSubmissionCore.ts` is never called. `submitWeeklyServiceContent` has 130 lines of dead parser code. Contradictory comments across files.

4. **Parser duplication**: BIBLE_BOOKS + `parseScriptureReferences` copied into 6 files.

---

## Design Principles

- **Submit-and-forget**: Public endpoints do thin writes only. No auth, no processing, no delay.
- **Single processing trigger**: One automation per submission. No racing.
- **Arts stays separate**: Direct field writes, no processing pipeline.
- **Safety net remains**: `processPendingSubmissions` catches anything stuck.

---

## Plan

### Step 1: Eliminate the race — disable `processSegmentSubmission` entity automation

**Action**: Remove the entity automation trigger that fires `processSegmentSubmission` when `Segment.submission_status` changes. This is a Base44 backend configuration change (not a code file change).

`processNewSubmissionVersion` becomes the **sole** processing automation, triggered on `SpeakerSubmissionVersion` create.

**Why not the reverse (keep processSegmentSubmission, remove processNewSubmissionVersion)?** Because `processSegmentSubmission` has the segment ID mismatch bug for weekly services. `processNewSubmissionVersion` already handles both event and weekly paths correctly.

> Note: The Segment.submission_status='pending' update in both submit endpoints is KEPT. It provides immediate admin visibility ("this segment has a pending submission"). It just won't trigger a second processor anymore.

### Step 2: Clean up `processNewSubmissionVersion` — remove contradictory skip guard

**File**: `functions/processNewSubmissionVersion.ts`

The skip guard at line 158-161 says "SKIP if already processed (inline processing by submitWeeklyServiceContent v3.0)". But v3.0 inline processing was removed (line 296-308 of submitWeeklyServiceContent shows "SUBMISSION ONLY MODE" with no parsing). Weekly submissions are now created with `processing_status: 'pending'`, so this guard is fine as-is but the **comment is wrong and misleading**.

- Update the comment to reflect reality: submissions arrive as 'pending', this guard prevents re-processing if the safety net already caught it.
- Remove the weekly "FALLBACK" label (lines 279-282). This IS the primary weekly path now, not a fallback.

### Step 3: Clean up `processNewSubmissionVersion` weekly path — entity-first resolution

**File**: `functions/processNewSubmissionVersion.ts`

Currently the weekly path (lines 281-358) writes to Service JSON first, then does a "dual-write" to the Segment entity as a secondary step. Since `submitWeeklyServiceContent` already resolves and writes to the Segment entity directly, flip the priority:

- **Primary**: Resolve Segment entity from composite ID (Session lookup, same pattern as submitWeeklyServiceContent lines 270-286)
- **Fallback**: Service JSON slot (for pre-entity-lift services only)
- Write `submission_status: 'processed'` to the Segment entity (not just Service JSON)
- This ensures `processSegmentSubmission` (if accidentally re-enabled) would see 'processed' and skip

### Step 4: Remove dead code from `submitWeeklyServiceContent`

**File**: `functions/submitWeeklyServiceContent.ts`

- Remove lines 11-143 (BIBLE_BOOKS map + parseScriptureReferences function). These are never called since line 301 skips to "SUBMISSION ONLY MODE".
- Remove the misleading "v3.0 - INLINE PROCESSING" header comment at line 3. Replace with accurate description.

### Step 5: Delete `processSubmissionCore.ts`

**File**: `functions/processSubmissionCore.ts`

This file is never imported or invoked by anything. The `module.exports` pattern doesn't work in Deno Deploy. Delete entirely.

### Step 6: Repurpose `processSegmentSubmission.ts` for admin reprocessing

**File**: `functions/processSegmentSubmission.ts`

Instead of deleting it, repurpose it as an **on-demand reprocessing endpoint** that admins can trigger from `MessageProcessing.jsx` (the "Reprocess" button). This is useful when:
- A submission was manually edited and needs re-parsing
- The safety net missed something
- An admin manually submits content

Changes:
- Remove the entity automation preamble (lines 131-133 event type check)
- Accept a direct invocation with `{ segmentId, content? }` payload
- Keep the existing processing logic (regex + LLM + Segment update)
- This function is only called via `base44.functions.invoke('processSegmentSubmission', ...)` from the admin UI, never by entity automation

### Step 7: Reduce parser duplication (pragmatic approach)

Deno Deploy functions cannot import from each other at runtime. Network-invoking `parseScriptureShared` for a <1ms regex operation adds unnecessary latency. So inline copies are the practical choice.

**Keep inline BIBLE_BOOKS + parser in** (3 files):
- `processNewSubmissionVersion.ts` (primary processor)
- `processPendingSubmissions.ts` (safety net)
- `processSegmentSubmission.ts` (admin reprocessing)

**Remove from** (3 files):
- `submitWeeklyServiceContent.ts` (Step 4 above)
- `processSubmissionCore.ts` (Step 5, deleted entirely)
- Confirm `parseScriptureShared.ts` remains as the canonical reference copy

**Add a sync protocol header** to the 3 remaining inline copies:
```
// BIBLE_BOOKS + parseScriptureReferences: inline copy (Deno Deploy cannot share modules)
// CANONICAL SOURCE: parseScriptureShared.ts
// SYNC: If you change the parser, update all 3 copies + parseScriptureShared.
// Files: processNewSubmissionVersion.ts, processPendingSubmissions.ts, processSegmentSubmission.ts
```

---

## Final Architecture After Changes

```
SPEAKER SUBMISSION FLOW (Event + Weekly):
  Public Form
    │
    ├─ submitSpeakerContent (events)      ─┐
    │   1. Create SpeakerSubmissionVersion  │  "submit and forget"
    │   2. Set Segment.status='pending'     │  (no processing)
    │                                       │
    ├─ submitWeeklyServiceContent (weekly) ─┤
    │   1. Resolve Segment entity           │
    │   2. Set Segment.status='pending'     │
    │   3. Create SpeakerSubmissionVersion  │
    │                                       │
    └───────────────────────────────────────┘
                    │
                    ▼ (entity automation: SpeakerSubmissionVersion.create)
          processNewSubmissionVersion
            1. Read content from SpeakerSubmissionVersion
            2. Regex parse (inline BIBLE_BOOKS)
            3. LLM extraction (bilingual takeaways)
            4. Write results to Segment entity
            5. Mark SpeakerSubmissionVersion as 'processed'
                    │
                    ▼ (safety net, scheduled every N minutes)
          processPendingSubmissions
            catches any SpeakerSubmissionVersion still 'pending'


ARTS SUBMISSION FLOW (unchanged):
  Public Form → submitArtsSegment → Direct Segment.update + ArtsSubmissionLog


ADMIN REPROCESSING:
  MessageProcessing.jsx → processSegmentSubmission (on-demand invoke)
```

---

## Files Changed

| File | Action |
|------|--------|
| `submitWeeklyServiceContent.ts` | Remove dead parser code (~130 lines), update header comment |
| `processNewSubmissionVersion.ts` | Fix comments, make weekly entity-first (flip JSON/entity priority) |
| `processSegmentSubmission.ts` | Repurpose for admin reprocessing (remove entity automation event check) |
| `processSubmissionCore.ts` | Delete |
| `processPendingSubmissions.ts` | Add sync protocol header (no logic changes) |
| Base44 backend config | Disable entity automation on Segment.submission_status for processSegmentSubmission |

**Not changed**: `submitSpeakerContent.ts`, `submitArtsSegment.ts`, `parseScriptureShared.ts`, frontend forms, `MessageProcessing.jsx`
