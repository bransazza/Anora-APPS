// ANORA admin — waktu.js (format waktu Asia/Jakarta)
const fW = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
export const fmtWaktu = (ts) => (ts ? fW.format(new Date(ts)) : "—");
export function fmtDurasi(mulai, selesai) {
  if (!mulai || !selesai) return "—";
  const d = Math.max(0, Math.round((Date.parse(selesai) - Date.parse(mulai)) / 1000));
  return `${Math.floor(d / 60)} mnt ${String(d % 60).padStart(2, "0")} dtk`;
}
export const namaStatus = (s) => (s === "expired" ? "Waktu habis" : "Dikumpulkan");