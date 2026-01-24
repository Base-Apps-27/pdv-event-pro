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
  
  // Parse ISO string to Date in UTC
  const date = new Date(isoTimestamp);
  
  // Create formatter for EST timezone, 24-hour format
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/New_York'
  });
  
  // Get parts and reconstruct HH:MM:SS
  const parts = estFormatter.formatToParts(date);
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';
  const second = parts.find(p => p.type === 'second')?.value || '00';
  
  return `${hour}:${minute}:${second}`;
}