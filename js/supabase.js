// ANORA admin — supabase.js
// Bagian umum sama dengan siswa/js/supabase.js. Perbedaan: storageKey dan fungsi ambilCount.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const url = String(SUPABASE_URL || "").trim();
const kunci = String(SUPABASE_ANON_KEY || "").trim();
export const belumDiatur =
  !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) ||
  url.includes("ISI_DI_SINI") ||
  kunci.length < 20 ||
  kunci.includes("ISI_DI_SINI");

export const supabase = createClient(
  belumDiatur ? "https://belum-diatur.invalid" : url.replace(/\/$/, ""),
  belumDiatur ? "belum-diatur" : kunci,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "anora-admin-auth" } },
);

export function galatSesi(error, status) {
  if (!error) return false;
  return status === 401 || error.code === "PGRST301" || error.code === "PGRST303" || /jwt/i.test(error.message || "");
}

function galatJaringan(e) {
  const pesan = String(e?.message || "");
  return !navigator.onLine || e?.name === "AuthRetryableFetchError" ||
    /failed to fetch|networkerror|network request failed|load failed/i.test(pesan);
}

function tangani(error, status) {
  if (galatSesi(error, status)) window.dispatchEvent(new CustomEvent("anora:sesi-berakhir", { detail: {} }));
}

// Kembalikan data, atau lempar galat.
export async function ambil(janji) {
  const { data, error, status } = await janji;
  if (error) { tangani(error, status); throw error; }
  return data;
}

// Untuk query { count: 'exact' }: kembalikan jumlah (dan data bila ada).
export async function ambilCount(janji) {
  const { data, count, error, status } = await janji;
  if (error) { tangani(error, status); throw error; }
  return { data: data || [], count: count ?? 0 };
}

export function pesanGalat(e) {
  if (galatJaringan(e)) return "Tidak ada koneksi. Periksa internet lalu coba lagi.";
  return "Terjadi kesalahan. Silakan coba lagi.";
}