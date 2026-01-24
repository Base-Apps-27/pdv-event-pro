export function formatTimeToEST(time24) {
  if (!time24) return "";
  
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function format24HourTime(time24) {
  return formatTimeToEST(time24);
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

    // Format explicitly in America/New_York (handles EST/EDT automatically)
    const formatted = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    }).format(date);

    // Replace non-breaking spaces some browsers insert
    return formatted.replace(/\u202F|\u00A0/g, ' ');
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    return '—';
  }
}