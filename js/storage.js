// ANORA admin — storage.js (unggah / hapus / tautan PDF materi)
import { supabase } from "./supabase.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const BATAS_PDF = 25 * 1024 * 1024; // sama dengan batas bucket materi-pdf
const BUCKET = "materi-pdf";

export class GalatUnggah extends Error {
  constructor(pesan) { super(pesan); this.pesan = pesan; }
}
export const ukuranTeks = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

// Mengembalikan teks galat, atau null bila berkas layak.
export async function periksaPdf(file) {
  if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) return "Berkas harus berformat PDF.";
  if (file.size === 0) return "Berkas kosong.";
  if (file.size > BATAS_PDF) return `Ukuran berkas maksimal 25 MB (berkas ini ${ukuranTeks(file.size)}).`;
  const kepala = await file.slice(0, 1024).text();
  if (!kepala.includes("%PDF-")) return "Isi berkas bukan PDF yang valid.";
  return null;
}

// Unggah dengan bilah kemajuan (XHR ke API Storage). Nama berkas di storage = UUID acak.
export async function unggahPdf(file, saatProgres) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new GalatUnggah("Sesi berakhir. Silakan masuk lagi.");
  const path = `${crypto.randomUUID()}.pdf`;
  await new Promise((ok, gagal) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) saatProgres(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { saatProgres(1); ok(); return; }
      const s = xhr.status;
      gagal(new GalatUnggah(
        s === 401 || s === 403 ? "Tidak punya izin mengunggah. Masuk ulang sebagai admin."
        : s === 413 ? "Ukuran berkas terlalu besar (maksimal 25 MB)."
        : s === 400 ? "Berkas ditolak server. Pastikan berformat PDF dan maksimal 25 MB."
        : `Gagal mengunggah (kode ${s}).`));
    };
    xhr.onerror = () => gagal(new GalatUnggah("Koneksi terputus saat mengunggah. Coba lagi."));
    xhr.onabort = () => gagal(new GalatUnggah("Unggahan dibatalkan."));
    xhr.send(file);
  });
  return path;
}

export async function hapusBerkas(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

// Tautan bertanda tangan berumur 1 jam untuk pratinjau
export async function urlPratinjau(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data || !data.signedUrl) {
    const e = new Error("tautan");
    e.pesan = "Tautan berkas tidak bisa dibuat. Pastikan berkas PDF-nya ada.";
    throw e;
  }
  return data.signedUrl;
}