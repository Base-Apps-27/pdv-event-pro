# Segment Editor Regression Checklist

## Purpose
Manual verification checklist for segment CRUD operations. Run after ANY change to:
- `components/session/SegmentList.jsx`
- `components/session/SegmentFormTwoColumn.jsx`
- `components/utils/queryKeys.js`
- `components/utils/segmentTypeDisplay.js`
- `pages/EventDetail.js`
- `components/event/SessionManager.jsx`
- `functions/getSegmentsBySessionIds.js`

---

## Pre-Test Setup
1. Open browser DevTools → Console tab
2. Clear console
3. Navigate to EventDetail page for a test event
4. Uncomment debug logs in EventDetail.js (search for "DEV-ONLY")
5. Observe: `[EventDetail] segments queryFn RUNNING` log appears

---

## Test 1: CREATE Segment
**Steps:**
1. Click "Add Segment" on any session
2. Fill required fields (Title, Type, Start Time, Duration)
3. For Panel type: fill `panel_panelists` field
4. Click "Crear"

**Expected:**
- [ ] Console shows: `[EventDetail] segments queryFn RUNNING` (refetch triggered)
- [ ] New segment appears in list immediately
- [ ] List shows correct "Responsible" field:
  - Panel → shows `panel_panelists` value (NOT presenter)
  - Plenaria → shows "Predicador: {presenter}"
  - Alabanza → shows "Líder: {presenter}"
- [ ] No page refresh required

---

## Test 2: UPDATE Segment (Panel Panelists)
**Steps:**
1. Open existing Panel segment for edit
2. Change `panel_panelists` value
3. Click "Guardar"

**Expected:**
- [ ] Console shows: `[EventDetail] segments queryFn RUNNING` (refetch triggered)
- [ ] List row updates immediately with new panelists value
- [ ] Re-open editor → shows new value (not stale)

---

## Test 3: UPDATE Segment (Other Types)
**Steps:**
1. Open existing Plenaria segment for edit
2. Change `presenter` value
3. Click "Guardar"

**Expected:**
- [ ] Console shows: `[EventDetail] segments queryFn RUNNING`
- [ ] List shows "Predicador: {new value}"

---

## Test 4: DELETE Segment
**Steps:**
1. Click delete icon on any segment
2. Confirm deletion

**Expected:**
- [ ] Console shows: `[EventDetail] segments queryFn RUNNING`
- [ ] Segment disappears from list immediately
- [ ] No orphan data in other views

---

## Test 5: REORDER Segments
**Steps:**
1. Use up/down arrows to reorder segments
2. Move segment from position 2 to position 1

**Expected:**
- [ ] Console shows: `[EventDetail] segments queryFn RUNNING`
- [ ] Order persists after page refresh

---

## Test 6: Cross-Session Consistency
**Steps:**
1. Create segment in Session A
2. Switch to Calendar tab
3. Switch back to Sessions tab

**Expected:**
- [ ] New segment still visible
- [ ] No duplicate entries
- [ ] Order preserved

---

## Test 7: Panel Type Display Contract
**Steps:**
1. Create new Panel segment with:
   - `presenter`: "WRONG VALUE"
   - `panel_panelists`: "Correct Panelist Names"
2. Save and observe list

**Expected:**
- [ ] List shows "Correct Panelist Names"
- [ ] List does NOT show "WRONG VALUE"
- [ ] This proves Panel type uses correct field

---

## Test 8: Network Tab Verification
**Steps:**
1. Open DevTools → Network tab
2. Filter by "getSegmentsBySessionIds"
3. Create/Update/Delete a segment

**Expected:**
- [ ] Network request fires after mutation completes
- [ ] Response contains updated segment data
- [ ] No duplicate requests (exactly 1 call per invalidation)

---

## Failure Handling
If ANY test fails:
1. Document which test failed
2. Copy console output
3. Check AttemptLog for related entries
4. Do NOT deploy until fixed

---

## Post-Verification Cleanup
After all tests pass:
1. Re-comment debug console.log statements in EventDetail.js
2. Commit with message: "Verified segment CRUD operations"

---

## Architecture Notes

### Canonical Cache (Event-Level)
The event-level segments query is the **source of truth**:
```js
queryKey: ['segments', eventId, sessionIdsKey]
```

### Derived Display
- SessionManager receives `segments` as prop from EventDetail
- SegmentList receives `segments` as prop from SessionManager
- UI components NEVER fetch segments directly for display

### Validation-Only Query (Session-Level)
```js
queryKey: ['segments', sessionId]
```
Used ONLY in SegmentFormTwoColumn for:
- Calculating suggested start times
- Detecting time overlaps during save
- This data is NOT rendered in any UI

### Invalidation Contract
All mutations call `invalidateSegmentCaches(queryClient)` which:
- Matches `key[0] === 'segments'` OR `key[0] === 'allSegments'`
- Invalidates BOTH event-level and session-level caches
- See `components/utils/queryKeys.js` for implementation

---

## Related Documentation
- `components/utils/queryKeys.js` - Query key contracts and invalidation
- `components/utils/segmentTypeDisplay.js` - Type-to-field display mapping
- `entities/Decision` - "Segment Query Key Centralization" decision record
- `entities/AttemptLog` - Implementation attempt history