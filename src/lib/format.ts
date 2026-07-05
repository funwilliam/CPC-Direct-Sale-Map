/** ISO/epoch → 瀏覽器當地時區 YYYY-MM-DD HH:mm (UTC±N)（使用者明定偏好） */
export function fmtLocal(input: string | number): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const oh = Math.floor(Math.abs(off) / 60);
  const om = Math.abs(off) % 60;
  const tz = `UTC${sign}${oh}${om ? ':' + p(om) : ''}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())} (${tz})`;
}
