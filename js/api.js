// ANORA admin — api.js (Edge Function dan data siswa bersama)
import { supabase, ambil } from "./supabase.js";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const KOLOM_SISWA = "id,username,child_name,parent_name,whatsapp,school_origin,grade,payment_status,is_active,created_at";

export class GalatFungsi extends Error {
  constructor(code, message, fields) { super(message); this.code = code; this.fields = fields || {}; }
}

// Panggil Edge Function. Sukses: kembalikan JSON. Gagal: lempar GalatFungsi(code, message, fields).
export async function panggilFungsi(nama, body) {
  const { data, error } = await supabase.functions.invoke(nama, { body });
  if (!error && data && data.ok === true) return data;

  let payload = data && data.ok === false ? data : null;
  if (error && !payload) {
    const r = error.context;
    try { if (r && typeof r.json === "function") payload = await r.json(); } catch { /* abaikan */ }
    if (!payload || !payload.error) {
      if (error.name === "FunctionsFetchError") throw new GalatFungsi("JARINGAN", "Tidak bisa terhubung ke server.");
      const st = r && r.status;
      payload = { error: {
        code: st === 401 ? "UNAUTHENTICATED" : st === 403 ? "FORBIDDEN" : "SERVER",
        message: "Permintaan gagal.",
      } };
    }
  }
  const e = (payload && payload.error) || { code: "SERVER", message: "Terjadi kesalahan di server." };
  if (e.code === "UNAUTHENTICATED" || e.code === "FORBIDDEN") {
    window.dispatchEvent(new CustomEvent("anora:sesi-berakhir", { detail: {} }));
  }
  throw new GalatFungsi(e.code, e.message, e.fields);
}

// Pesan Indonesia dari galat Edge Function. peta = {KODE: pesan} khusus tiap fitur.
export function pesanFungsi(e, peta = {}, umum = "Terjadi kesalahan, coba lagi.") {
  if (e instanceof GalatFungsi) {
    if (e.code === "JARINGAN") {
      return "Tidak bisa terhubung ke server. Periksa internet Anda. Jika internet normal, periksa ALLOWED_ORIGINS di Supabase.";
    }
    if (e.code === "UNAUTHENTICATED" || e.code === "FORBIDDEN") return "Sesi tidak valid, silakan masuk lagi.";
    return peta[e.code] || umum;
  }
  return umum;
}

// Semua siswa (ringan) untuk pilihan. Asumsi: maksimal 1000 siswa.
export async function semuaSiswa() {
  return (await ambil(supabase.from("students").select(KOLOM_SISWA).order("child_name").range(0, 999))) || [];
}