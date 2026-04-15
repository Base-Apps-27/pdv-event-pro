/* eslint-disable */
// # StreamBlocks: Complete Implementation Plan

## Executive Summary
**Objective**: Enable livestream coordination that runs parallel to in-person events with ~80% overlap and ~20% divergent content, without duplicating events, splitting chat, or losing timing synchronization.

**Solution**: StreamBlocks - a parallel timeline entity that anchors to main program segments and automatically inherits timing adjustments.

---

## 1. ARCHITECTURAL CONSTRAINTS (Non-Negotiable)

### Hard Requirements
- ✅ One event remains the single source of truth
- ✅ No duplicate Event entity
- ✅ No split chat or coordination context
- ✅ Timing changes in main program automatically affect livestream where appropriate
- ✅ Livestream coordination must feel like a real "run of show," not documentation
- ✅ A simple notes field is NOT acceptable

---

## 2. BLOCK TYPES (Four Types)

### 1. LinkBlock
- **Purpose**: References a Main Program Segment
- **Behavior**: Inherits timing changes automatically
- **Use Case**: When stream mirrors the room

### 2. InsertBlock
- **Purpose**: Livestream-only content
- **Behavior**: Can occur before, during, or after the main program
- **Use Case**: Pre-show, interviews, extra panels

### 3. ReplaceBlock
- **Purpose**: Explicitly replaces a Main Segment on the stream
- **Behavior**: Override timing from parent segment
- **Use Case**: Main = Break, Stream = Panel

### 4. OfflineBlock
- **Purpose**: Stream goes dark / holding screen / standby
- **Behavior**: No content transmission
- **Use Case**: Technical breaks, transitions

---

## 3. ANCHORING & TIMING SYSTEM

### Anchor Points (4 Options)
1. **before_start** - Before the anchor segment begins
2. **at_start** - When the anchor segment begins
3. **at_end** - When the anchor segment ends
4. **absolute** - Fixed time (HH:MM), no segment anchor

### Offset System
- **Type**: Integer (minutes)
- **Positive offset**: After the anchor point
- **Negative offset**: Before the anchor point

### Critical Principle: Computed Timing (Non-Stored)
**StreamBlocks NEVER store resolved times.** Timing is computed at render time using `resolveBlockTime`.

---

## 4. SCHEMA DEFINITION

### Entity: StreamBlock
- `session_id` (Required)
- `block_type` (link, insert, replace, offline)
- `anchor_segment_id`
- `anchor_point`
- `offset_min`
- `absolute_time`
- `duration_min`
- `title` (Required)
- `presenter`
- `description`
- `stream_notes`
- `stream_actions` (Array of cues)
- `color_code`

### Entity: Session (Modification)
- `has_livestream` (Boolean)

---

## 5. PHASED IMPLEMENTATION

### Phase 1: Data Model + Editing Capability
- Schema creation
- StreamBlockList component (Editor)
- StreamBlockForm component

### Phase 2: Stream Coordinator Live View
- PublicProgramView `?view=livestream`
- NOW/NEXT block display
- Divergence indicator
- Real-time timing computation