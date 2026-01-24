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
    // Parse ISO string to Date
    const date = new Date(isoTimestamp);
    
    // Validate the date is not invalid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', isoTimestamp);
      return '—';
    }
    
    // Format using toLocaleString with explicit EST timezone
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    return '—';
  }
}