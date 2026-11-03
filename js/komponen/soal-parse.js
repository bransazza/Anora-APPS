// ANORA admin — soal-parse.js (membaca teks tempel / baris Excel, validasi soal). Murni, tanpa DOM.
export const HURUF = ["A", "B", "C", "D", "E"];
const RE_OPSI = /^\s*([A-Ea-e])\s*[.)]\s*(.*)$/;
const RE_KUNCI = /^\s*(?:JAWABAN|KUNCI)\s*[:=]\s*(.*)$/i;
const RE_BAHAS = /^\s*PEMBAHASAN\s*:\s*(.*)$/i;
const RE_GB_BAHAS = /^\s*GAMBAR_PEMBAHASAN\s*:\s*(.*)$/i;
const RE_GB = /^\s*GAMBAR\s*:\s*(.*)$/i;

export function itemKosong() {
  return { teks: "", opsi: [], kunci: null, _kunciMentah: "", bahas: "", refGambar: "", refBahas: "", gambarSoal: null, gambarBahas: null, galat: [] };
}

function ambilKunci(v) {
  const t = String(v || "").trim();
  const m = t.match(/^([A-Ea-e])\b/);
  if (m) return m[1].toUpperCase();
  return /^[1-5]$/.test(t) ? HURUF[Number(t) - 1] : null;
}

// Soal dipisah baris kosong. Kata kunci (JAWABAN, PEMBAHASAN, GAMBAR, GAMBAR_PEMBAHASAN) tidak peka huruf besar/kecil.
export function parseTeks(teks) {
  return String(teks || "").replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map(parseBlok);
}

function parseBlok(blok) {
  const it = itemKosong();
  const soal = [], bahas = [];
  let mode = "soal";
  for (const baris of blok.split("\n")) {
    let m;
    if ((m = baris.match(RE_KUNCI))) { it._kunciMentah = m[1].trim(); it.kunci = ambilKunci(m[1]); mode = "kunci"; continue; }
    if ((m = baris.match(RE_GB_BAHAS))) { it.refBahas = m[1].trim(); continue; }
    if ((m = baris.match(RE_GB))) { it.refGambar = m[1].trim(); continue; }
    if ((m = baris.match(RE_BAHAS))) { bahas.push(m[1]); mode = "bahas"; continue; }
    m = baris.match(RE_OPSI);
    if (m && mode !== "bahas" && mode !== "kunci") {
      const huruf = m[1].toUpperCase();
      if (mode === "opsi" || huruf === "A") { it.opsi.push({ id: huruf, teks: m[2].trim() }); mode = "opsi"; continue; }
    }
    if (mode === "soal") soal.push(baris);
    else if (mode === "opsi") { const x = it.opsi[it.opsi.length - 1]; x.teks = (x.teks + " " + baris.trim()).trim(); }
    else if (mode === "bahas") bahas.push(baris);
  }
  it.teks = soal.join("\n").replace(/^\s*\d{1,3}[.)]\s+/, "").trim();
  it.bahas = bahas.join("\n").trim();
  return it;
}

// Baris dari Excel/CSV: kolom no, soal, A..E, kunci, pembahasan, gambar_soal, gambar_pembahasan
export function parseBarisSheet(baris) {
  const hasil = [];
  for (const r0 of baris) {
    const r = Object.fromEntries(Object.entries(r0).map(([k, v]) => [String(k).trim().toLowerCase(), String(v ?? "").trim()]));
    if (!["soal", "a", "b", "c", "d", "e", "kunci", "pembahasan"].some((k) => r[k])) continue;
    const it = itemKosong();
    it.teks = r.soal || "";
    let akhir = -1;
    HURUF.forEach((H, i) => { if (r[H.toLowerCase()]) akhir = i; });
    for (let i = 0; i <= akhir; i++) it.opsi.push({ id: HURUF[i], teks: r[HURUF[i].toLowerCase()] || "" });
    it._kunciMentah = r.kunci || "";
    it.kunci = ambilKunci(r.kunci);
    it.bahas = r.pembahasan || "";
    it.refGambar = r.gambar_soal || "";
    it.refBahas = r.gambar_pembahasan || "";
    hasil.push(it);
  }
  return hasil;
}

// Mengembalikan daftar pesan masalah (kosong = soal siap disimpan).
// berkas = Map nama-huruf-kecil -> File (hanya untuk impor); null untuk soal dari editor.
export function validasiSoal(it, berkas = null) {
  const m = [];
  const adaGambar = !!(it.gambarSoal || it.refGambar);
  if (!it.teks.trim() && !adaGambar) m.push("Isi soal kosong (tulis teks atau sertakan gambar).");
  if (it.teks.length > 2000) m.push("Teks soal lebih dari 2000 karakter.");
  const o = it.opsi;
  if (o.length < 2) m.push("Opsi kurang dari 2.");
  if (o.length > 5) m.push("Opsi lebih dari 5.");
  o.forEach((x, i) => {
    if (x.id !== HURUF[i]) m.push(`Huruf opsi harus berurutan (opsi ke-${i + 1} bertanda ${x.id}).`);
    if (!String(x.teks || "").trim() && !x.gambar) m.push(`Opsi ${HURUF[i] || x.id} kosong.`);
    if (String(x.teks || "").length > 500) m.push(`Opsi ${x.id} lebih dari 500 karakter.`);
  });
  if (!it.kunci) m.push(it._kunciMentah ? `Kunci “${it._kunciMentah}” tidak dikenali (harus A sampai E).` : "Kunci jawaban belum ada.");
  else if (!o.some((x) => x.id === it.kunci)) m.push(`Kunci ${it.kunci} tidak ada di opsi.`);
  if (it.bahas.length > 4000) m.push("Pembahasan lebih dari 4000 karakter.");
  if (berkas) {
    if (it.refGambar && !berkas.has(it.refGambar.toLowerCase())) m.push(`Gambar soal tidak ditemukan: ${it.refGambar}`);
    if (it.refBahas && !berkas.has(it.refBahas.toLowerCase())) m.push(`Gambar pembahasan tidak ditemukan: ${it.refBahas}`);
  }
  return m;
}

// Bentuk yang dikirim ke fungsi database admin_upsert_questions
export function keItemRpc(it) {
  return {
    ...(it.id ? { id: it.id } : {}),
    question_text: String(it.teks || "").trim() || null,
    question_image_path: it.gambarSoal || null,
    options: it.opsi.map((x, i) => ({ id: HURUF[i], text: String(x.teks || "").trim() || null, image_path: x.gambar || null })),
    correct: it.kunci,
    explanation_text: String(it.bahas || "").trim() || null,
    explanation_image_path: it.gambarBahas || null,
  };
}