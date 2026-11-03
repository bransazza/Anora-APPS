// ANORA admin — soal-api.js (membaca dan menyimpan soal untuk BAB atau TRY OUT)
// "induk" = id bab (teks) atau { id, jenis: "tryout" }.
import { supabase, ambil } from "../supabase.js";

const normal = (induk) => (typeof induk === "string" ? { id: induk, jenis: "material" } : induk);

export function keItem(q) {
  const k = Array.isArray(q.question_keys) ? q.question_keys[0] : q.question_keys;
  return {
    id: q.id, position: q.position, teks: q.question_text || "", gambarSoal: q.question_image_path || null,
    opsi: (q.options || []).map((o) => ({ id: o.id, teks: o.text || "", gambar: o.image_path || null })),
    kunci: (k && k.correct && k.correct[0]) || null, _kunciMentah: "",
    bahas: (k && k.explanation_text) || "", gambarBahas: (k && k.explanation_image_path) || null,
    refGambar: "", refBahas: "", galat: [],
  };
}

export async function muatSoal(induk) {
  const k = normal(induk);
  const d = await ambil(supabase.from("questions")
    .select("id,position,question_text,question_image_path,options,created_at,question_keys(correct,explanation_text,explanation_image_path)")
    .eq(k.jenis === "tryout" ? "tryout_id" : "material_id", k.id).order("position").order("created_at"));
  return (d || []).map(keItem);
}

// Satu transaksi di server: gagal satu = batal semua. Mengembalikan array id soal.
export async function simpanSoal(induk, ganti, items) {
  const k = normal(induk);
  return k.jenis === "tryout"
    ? await ambil(supabase.rpc("admin_upsert_tryout_questions", { p_tryout_id: k.id, p_replace: ganti, p_items: items }))
    : await ambil(supabase.rpc("admin_upsert_questions", { p_material_id: k.id, p_replace: ganti, p_items: items }));
}
export async function urutkanSoal(induk, ids) {
  const k = normal(induk);
  if (k.jenis === "tryout") await ambil(supabase.rpc("admin_set_tryout_question_order", { p_tryout_id: k.id, p_ids: ids }));
  else await ambil(supabase.rpc("admin_set_question_order", { p_material_id: k.id, p_ids: ids }));
}

export function pathGambar(items) {
  const soal = [], bahas = [];
  for (const it of items) {
    if (it.gambarSoal) soal.push(it.gambarSoal);
    for (const o of it.opsi) if (o.gambar) soal.push(o.gambar);
    if (it.gambarBahas) bahas.push(it.gambarBahas);
  }
  return { soal, bahas };
}
export async function pathGambarBab(induk) { return pathGambar(await muatSoal(induk)); }

export function pesanRpc(e) {
  if (e && ["VALIDATION", "NOT_FOUND", "FORBIDDEN"].includes(e.details)) return e.message;
  if (e && /unggah/i.test(e.message || "")) return e.message;
  if (!navigator.onLine) return "Tidak ada koneksi. Periksa internet lalu coba lagi.";
  return "Gagal menyimpan soal, coba lagi.";
}