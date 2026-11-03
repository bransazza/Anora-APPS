// ANORA admin — gambar.js (kecilkan, unggah, hapus, dan tautan gambar soal)
import { supabase, ambil } from "./supabase.js";

export const BUCKET_SOAL = "soal-gambar";
export const BUCKET_BAHAS = "pembahasan-gambar";
const MAKS_SISI = 1280;
const BATAS_BYTE = 1.9 * 1024 * 1024; // di bawah batas bucket 2 MB
const MAKS_ASLI = 15 * 1024 * 1024;

export function periksaGambar(file) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return "Berkas harus gambar PNG, JPG, WEBP, atau GIF.";
  if (file.size > MAKS_ASLI) return "Gambar terlalu besar (maksimal 15 MB sebelum dikecilkan).";
  return null;
}

// Kecilkan di browser: sisi terpanjang maksimal 1280 px, JPEG berkualitas wajar, latar putih.
export async function kecilkanGambar(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { try { bmp = await createImageBitmap(file); } catch { throw new Error("Gambar tidak bisa dibaca."); } }
  let skala = Math.min(1, MAKS_SISI / Math.max(bmp.width, bmp.height));
  for (let percobaan = 0; percobaan < 4; percobaan++) {
    const w = Math.max(1, Math.round(bmp.width * skala));
    const hh = Math.max(1, Math.round(bmp.height * skala));
    const c = document.createElement("canvas");
    c.width = w; c.height = hh;
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, w, hh);
    x.drawImage(bmp, 0, 0, w, hh);
    for (const q of [0.85, 0.72, 0.6]) {
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= BATAS_BYTE) return blob;
    }
    skala *= 0.8;
  }
  throw new Error("Gambar masih terlalu besar setelah dikecilkan.");
}

export async function unggahGambar(bucket, blob) {
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
  if (error) throw new Error("Gagal mengunggah gambar.");
  return path;
}

export async function hapusGambar(bucket, paths) {
  const p = paths.filter(Boolean);
  if (!p.length) return;
  await supabase.storage.from(bucket).remove(p);
}

export async function urlGambar(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) throw new Error("tautan");
  return data.signedUrl;
}

export async function urlBanyak(bucket, paths) {
  const unik = [...new Set(paths.filter(Boolean))];
  const peta = new Map();
  if (!unik.length) return peta;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unik, 3600);
  (data || []).forEach((d) => { if (d.signedUrl) peta.set(d.path, d.signedUrl); });
  return peta;
}

// Hapus dari storage hanya gambar yang sudah tidak dipakai soal mana pun
export async function bersihkanTakTerpakai(bucket, paths) {
  const kandidat = [...new Set(paths.filter(Boolean))];
  if (!kandidat.length) return;
  const bebas = await ambil(supabase.rpc("admin_unused_images", { p_paths: kandidat }));
  await hapusGambar(bucket, bebas || []);
}