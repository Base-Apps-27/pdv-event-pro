export function formatTimeToEST(time24) {
  if (!time24) return "";
  
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const hours12 = hours % 12 || 12;
  
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function format24HourTime(time24) {
  return formatTimeToEST(time24);
}