// Canonical time/date helpers for America/New_York (ET)
// - Time: 12-hour format, e.g. 7:10 PM
// - Date: MM-DD-YYYY
// - Timestamp: h:mm:ss AM/PM with zone (EST/EDT)

export function formatTimeToEST(time24) {
  if (!time24) return "";
  const [hours, minutes] = String(time24).split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function format24HourTime(time24) {
  return formatTimeToEST(time24);
}

export function formatDateET(dateInput) {
  if (!dateInput) return '';
  // If already YYYY-MM-DD, reformat quickly
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (ymd.test(dateInput)) {
    const [y, m, d] = dateInput.split('-');
    return `${m}-${d}-${y}`;
  }
  // Fallback: parse as Date and format in ET
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const mm = parts.find(p => p.type === 'month')?.value || '01';
  const dd = parts.find(p => p.type === 'day')?.value || '01';
  const yyyy = parts.find(p => p.type === 'year')?.value || '1970';
  return `${mm}-${dd}-${yyyy}`;
}

export function formatTimestampToEST(isoTimestamp) {
  if (!isoTimestamp) return '—';
  try {
    // Normalize timestamp: if no timezone info, assume UTC (append Z)
    let ts = String(isoTimestamp);
    const hasTZ = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(ts);
    if (!hasTZ) ts += 'Z';

    const date = new Date(ts);
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', isoTimestamp);
      return '—';
    }

    const formatted = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
      timeZoneName: 'short', // EST/EDT
    }).format(date);
    return formatted.replace(/\u202F|\u00A0/g, ' ');
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    return '—';
  }
}

/**
 * DEV-4 (2026-03-02): Canonical "today in ET" helper.
 * Returns YYYY-MM-DD string in America/New_York timezone.
 * Use this everywhere you need "today's date" to avoid UTC-vs-local bugs.
 * 'en-CA' locale produces YYYY-MM-DD natively from Intl.DateTimeFormat.
 */
export function getTodayET() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

/**
 * DEV-4 (2026-03-02): Parse a YYYY-MM-DD string into a local Date at midnight.
 * Avoids the UTC midnight bug: new Date('2026-03-01') creates UTC midnight,
 * which in EST displays as Feb 28. This splits the string and creates a local Date.
 */
export function parseDateStringLocal(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function formatDateTimeET(isoTimestamp) {
  if (!isoTimestamp) return '';
  let ts = String(isoTimestamp);
  if (!(/[zZ]|[+\-]\d{2}:?\d{2}$/.test(ts))) ts += 'Z';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const date = formatDateET(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' })
      .format(d)
      .replaceAll('/', '-')
  );
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour:'numeric', minute:'2-digit', hour12:true, timeZoneName:'short' }).format(d).replace(/\u202F|\u00A0/g, ' ');
  return `${date} ${time}`;
}