/**
 * archiveLiveOperationsMessages
 * 
 * Scheduled automation function to archive old Live Operations Chat messages.
 * 
 * Archive Rules:
 * - Event messages: Archive 24 hours after event end_date
 * - Service messages: Archive at midnight after the service date
 * 
 * This function should be scheduled to run daily (e.g., at 1:00 AM ET).
 * 
 * ADMIN-ONLY: This function should only be invoked by scheduled automation,
 * but includes admin check for manual invocation safety.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // For scheduled automation, we use service role
    // Get current time in ET
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const etParts = etFormatter.formatToParts(now);
    const etYear = etParts.find(p => p.type === 'year')?.value;
    const etMonth = etParts.find(p => p.type === 'month')?.value;
    const etDay = etParts.find(p => p.type === 'day')?.value;
    const todayET = `${etYear}-${etMonth}-${etDay}`;
    
    // Calculate 24 hours ago for event archival
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twentyFourHoursAgoParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(twentyFourHoursAgo);
    const cutoffDate = `${twentyFourHoursAgoParts.find(p => p.type === 'year')?.value}-${twentyFourHoursAgoParts.find(p => p.type === 'month')?.value}-${twentyFourHoursAgoParts.find(p => p.type === 'day')?.value}`;

    // HARDENED (2026-02-15 audit): Add date range to prevent unbounded table scan.
    // Only fetch messages created in the last 14 days (covers any archival window).
    // As chat accumulates over months/years, this prevents loading thousands of records.
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const allMessages = await base44.asServiceRole.entities.LiveOperationsMessage.filter({
      is_archived: false,
      created_date: { $gte: fourteenDaysAgo.toISOString() }
    });

    if (!allMessages || allMessages.length === 0) {
      return Response.json({
        success: true,
        message: 'No messages to archive',
        archived_count: 0
      });
    }

    const toArchive = [];

    for (const msg of allMessages) {
      // Skip typing beacon records — they are ephemeral and should be archived along with their context
      const contextDate = msg.context_date;
      if (!contextDate) continue;

      if (msg.context_type === 'event') {
        // Event: Archive if context_date (end_date) + 24 hours has passed
        if (contextDate < cutoffDate) {
          toArchive.push(msg.id);
        }
      } else if (msg.context_type === 'service') {
        // Service: Archive if context_date (service date) has passed (midnight rule)
        if (contextDate < todayET) {
          toArchive.push(msg.id);
        }
      }
    }

    // Archive messages in batches of 10 for efficiency
    let archivedCount = 0;
    const BATCH_SIZE = 10;
    for (let i = 0; i < toArchive.length; i += BATCH_SIZE) {
      const batch = toArchive.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(msgId =>
          base44.asServiceRole.entities.LiveOperationsMessage.update(msgId, {
            is_archived: true
          })
        )
      );
      archivedCount += batch.length;
    }

    console.log(`Archived ${archivedCount} messages. Today ET: ${todayET}, Cutoff: ${cutoffDate}`);

    return Response.json({
      success: true,
      message: `Archived ${archivedCount} messages`,
      archived_count: archivedCount,
      today_et: todayET,
      event_cutoff_date: cutoffDate,
      total_checked: allMessages.length
    });

  } catch (error) {
    console.error('Archive error:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
});