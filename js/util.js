// ANORA admin — util.js (validasi, format, CSV, password acak)
import { STUDENT_SITE_URL } from "./config.js";

export const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
export const STATUS_ABSEN = ["Hadir", "Izin", "Sakit", "Tanpa Keterangan"];
export const STATUS_BAYAR = ["Pending", "Lunas", "Belum Bayar"];

export function debounce(fn, ms) {
  let t;
  const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  f.batal = () => clearTimeout(t);
  return f;
}
export const potong = (t, n) => { const s = String(t ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
// Buang karakter yang mengganggu filter pencarian PostgREST
export const bersihkanCari = (t) => String(t || "").replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim();

export function usernameValid(u) {
  return /^[a-z0-9._-]{3,30}$/.test(u) && !u.startsWith(".") && !u.endsWith(".") && !u.includes("..");
}
export function sarankanUsername(nama) {
  return String(nama || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "").replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 30);
}

// WhatsApp: hanya angka, +, spasi, -. Hasil: 62xxxxxxxxxx (10-15 digit).
export function normalWA(mentah) {
  const t = String(mentah || "").trim();
  if (!t) return { ok: false, pesan: "Nomor WhatsApp wajib diisi." };
  if (!/^[0-9+\-\s]+$/.test(t) || t.lastIndexOf("+") > 0) {
    return { ok: false, pesan: "Nomor hanya boleh berisi angka, +, spasi, dan -." };
  }
  let d = t.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  if (d.length < 10 || d.length > 15) return { ok: false, pesan: "Nomor harus 10–15 digit." };
  return { ok: true, nilai: d };
}

export function validasiDataSiswa(v) {
  const g = {}, n = {};
  n.child_name = String(v.child_name || "").trim().replace(/\s+/g, " ");
  if (n.child_name.length < 2 || n.child_name.length > 60) g.child_name = "Nama anak 2–60 karakter.";
  n.parent_name = String(v.parent_name || "").trim().replace(/\s+/g, " ");
  if (n.parent_name.length < 2 || n.parent_name.length > 60) g.parent_name = "Nama orang tua 2–60 karakter.";
  const wa = normalWA(v.whatsapp);
  if (!wa.ok) g.whatsapp = wa.pesan; else n.whatsapp = wa.nilai;
  n.school_origin = String(v.school_origin || "").trim().replace(/\s+/g, " ");
  if (!n.school_origin) g.school_origin = "Asal sekolah wajib diisi.";
  else if (n.school_origin.length > 100) g.school_origin = "Maksimal 100 karakter.";
  n.grade = Number(v.grade);
  if (!Number.isInteger(n.grade) || n.grade < 1 || n.grade > 6) g.grade = "Pilih kelas 1–6.";
  return { galat: g, nilai: n };
}

export function validasiAbsensi(v) {
  const g = {}, n = {};
  n.date = String(v.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date) || isNaN(Date.parse(n.date))) g.date = "Tanggal tidak valid.";
  n.day = v.day;
  if (!HARI.includes(n.day)) g.day = "Pilih hari.";
  n.status = v.status;
  if (!STATUS_ABSEN.includes(n.status)) g.status = "Pilih status.";
  n.topic = String(v.topic || "").trim();
  if (!n.topic) g.topic = "Materi / topik wajib diisi.";
  else if (n.topic.length > 150) g.topic = "Maksimal 150 karakter.";
  n.notes = String(v.notes || "").trim();
  if (n.notes.length > 500) g.notes = "Maksimal 500 karakter.";
  return { galat: g, nilai: n };
}

export function validasiGuide(v) {
  const g = {}, n = {};
  n.date = String(v.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date) || isNaN(Date.parse(n.date))) g.date = "Tanggal tidak valid.";
  n.title = String(v.title || "").trim();
  if (n.title.length < 3 || n.title.length > 100) g.title = "Judul 3–100 karakter.";
  n.content = String(v.content || "").replace(/\r\n?/g, "\n").trim();
  if (!n.content) g.content = "Isi panduan wajib diisi.";
  else if (n.content.length > 2000) g.content = "Maksimal 2000 karakter.";
  return { galat: g, nilai: n };
}

// ---------- Password acak (crypto), tanpa karakter membingungkan ----------
const HURUF = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ANGKA = "23456789";
function acakInt(n) {
  const batas = Math.floor(2 ** 32 / n) * n;
  const b = new Uint32Array(1);
  do { crypto.getRandomValues(b); } while (b[0] >= batas);
  return b[0] % n;
}
export function passwordAcak(panjang = 8) {
  const semua = HURUF + ANGKA;
  const c = [HURUF[acakInt(HURUF.length)], ANGKA[acakInt(ANGKA.length)]];
  while (c.length < panjang) c.push(semua[acakInt(semua.length)]);
  for (let i = c.length - 1; i > 0; i--) { const j = acakInt(i + 1); [c[i], c[j]] = [c[j], c[i]]; }
  return c.join("");
}
export function kekuatan(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (!pw) return { teks: "", tingkat: 0 };
  return s <= 2 ? { teks: "Kekuatan: lemah", tingkat: 1 } : s === 3 ? { teks: "Kekuatan: sedang", tingkat: 2 } : { teks: "Kekuatan: kuat", tingkat: 3 };
}

export async function salin(teks) {
  try { await navigator.clipboard.writeText(teks); return true; }
  catch {
    try {
      const a = document.createElement("textarea");
      a.value = teks; a.style.position = "fixed"; a.style.opacity = "0";
      document.body.append(a); a.select();
      const ok = document.execCommand("copy");
      a.remove();
      return ok;
    } catch { return false; }
  }
}

// CSV (BOM agar Excel membaca UTF-8; sel berawalan = + - @ diberi tanda ' agar tidak dijalankan sebagai rumus)
export function unduhCsv(namaBerkas, baris) {
  const esc = (v) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const isi = "\ufeff" + baris.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([isi], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = namaBerkas;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- WhatsApp ----------
const situs = () => (STUDENT_SITE_URL.includes("ISI_DI_SINI") ? "(alamat website siswa)" : STUDENT_SITE_URL);
export const linkWA = (nomor, teks) => `https://wa.me/${nomor}?text=${encodeURIComponent(teks)}`;
export const pesanAkunBaru = ({ parent, anak, username, password }) =>
  `Halo ${parent}, akun belajar ANORA untuk ${anak} sudah dibuat.\n\nUsername: ${username}\nPassword: ${password}\nMasuk di: ${situs()}\n\nMohon disimpan baik-baik. Jika lupa password, hubungi admin bimbel.`;
export const pesanReset = ({ parent, anak, username, password }) =>
  `Halo ${parent}, password akun ANORA untuk ${anak} sudah diganti.\n\nUsername: ${username}\nPassword baru: ${password}\nMasuk di: ${situs()}\n\nMohon disimpan baik-baik.`;