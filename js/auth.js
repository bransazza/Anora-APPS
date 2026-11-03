// ANORA admin — auth.js (login admin dengan email + password)
import { supabase, ambil, pesanGalat } from "./supabase.js";

export class GalatMasuk extends Error {}

export async function keluar(global = false) {
  try { await supabase.auth.signOut({ scope: global ? "global" : "local" }); } catch { /* abaikan */ }
}

// Hasil: {status:'tidak-ada'} | {status:'bukan-admin'} | {status:'admin', admin:{id,email}}
export async function ambilAdmin() {
  const { data } = await supabase.auth.getSession();
  const u = data?.session?.user;
  if (!u) return { status: "tidak-ada" };
  const baris = await ambil(supabase.from("admins").select("user_id").eq("user_id", u.id).maybeSingle());
  return baris ? { status: "admin", admin: { id: u.id, email: u.email } } : { status: "bukan-admin" };
}

function pesanGalatMasuk(err) {
  const kode = err?.code || "";
  const msg = String(err?.message || "").toLowerCase();
  if (kode === "invalid_credentials" || msg.includes("invalid login")) return "Email atau password salah.";
  if (kode === "user_banned" || msg.includes("banned")) return "Akun ini dinonaktifkan.";
  if (err?.status === 429 || kode === "over_request_rate_limit") return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (err?.name === "AuthRetryableFetchError" || err?.status === 0 || /fetch|network|load failed/.test(msg)) return "Tidak ada koneksi, coba lagi.";
  return "Gagal masuk. Coba lagi.";
}

export async function masuk(emailMentah, password) {
  const email = String(emailMentah || "").trim().toLowerCase();
  if (!email || !password) throw new GalatMasuk("Isi email dan password dulu.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new GalatMasuk("Format email tidak benar.");
  if (!navigator.onLine) throw new GalatMasuk("Tidak ada koneksi, coba lagi.");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new GalatMasuk(pesanGalatMasuk(error));

  let hasil;
  try { hasil = await ambilAdmin(); }
  catch (e) { await keluar(); throw new GalatMasuk(pesanGalat(e)); }
  if (hasil.status !== "admin") { await keluar(); throw new GalatMasuk("Akun ini bukan admin."); }
  return hasil.admin;
}