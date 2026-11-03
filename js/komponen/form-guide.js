// ANORA admin — form-guide.js (form parent guide, templat, pratinjau, dialog ubah/hapus)
import { supabase, ambil } from "../supabase.js";
import { h, ikon, renderTeks, tanggalPanjang, hariIniJakarta, selisihHari } from "../ui.js";
import { kolom, dialog, konfirmasi, toast, setKotor } from "../widget.js";
import { validasiGuide, bersihkanCari } from "../util.js";

export const TEMPLAT = [
  { nama: "Pendampingan membaca di rumah", judul: "Pendampingan membaca di rumah",
    isi: "Membaca setiap hari, walau sebentar, membantu anak makin lancar dan paham isi bacaan.\n\nYang bisa Ayah/Bunda lakukan di rumah:\n- Sediakan waktu membaca 10–15 menit setiap hari, misalnya sebelum tidur\n- Minta anak membaca nyaring, lalu dengarkan tanpa terburu-buru mengoreksi\n- Setelah selesai, tanyakan: \"Ceritanya tentang apa?\" dan \"Menurut adik, bagaimana akhirnya?\"\n- Beri pujian untuk usaha anak, bukan hanya untuk hasilnya\n\nJika anak mulai bosan, ganti bacaan dengan topik yang ia sukai." },
  { nama: "Latihan berhitung 10 menit", judul: "Latihan berhitung 10 menit",
    isi: "Latihan singkat tapi rutin lebih berhasil daripada latihan panjang sekali-sekali.\n\nCara mudah di rumah:\n- Siapkan 5–10 soal berhitung sesuai materi terakhir di bimbel\n- Atur waktu 10 menit, tidak perlu lebih\n- Biarkan anak mencoba sendiri dulu; bantu hanya bila ia benar-benar buntu\n- Saat salah, ajak anak menjelaskan caranya, lalu cari bersama di mana letak kelirunya\n- Akhiri dengan satu soal yang mudah supaya anak selesai dengan perasaan berhasil" },
  { nama: "Membangun kepercayaan diri anak", judul: "Membangun kepercayaan diri anak",
    isi: "Anak yang merasa mampu biasanya lebih berani mencoba, termasuk saat soalnya sulit.\n\nYang bisa dilakukan:\n- Puji prosesnya: \"Ibu lihat kamu tidak menyerah\" lebih berarti daripada \"Kamu pintar\"\n- Katakan bahwa salah itu wajar dan bagian dari belajar\n- Hindari membandingkan anak dengan kakak, adik, atau temannya\n- Rayakan kemajuan kecil, misalnya nilai naik sedikit atau berani bertanya\n\nJika anak tampak sangat cemas saat belajar, kabari kami agar bisa kita bantu bersama." },
  { nama: "Persiapan try out", judul: "Persiapan try out",
    isi: "Try out adalah latihan untuk terbiasa dengan soal dan waktu, bukan penentu kemampuan anak.\n\nPersiapan di rumah:\n- Pastikan anak tidur cukup dan sarapan sebelum mengerjakan\n- Siapkan tempat yang tenang, tanpa televisi atau gawai lain\n- Ingatkan anak membaca soal dengan teliti dan mengerjakan yang mudah lebih dulu\n- Setelah selesai, bacalah pembahasan bersama dan catat bagian yang masih sulit\n\nTry out boleh diulang, jadi tidak perlu tegang." },
];

// Pratinjau persis seperti tampilan orang tua
export function pratinjau(date, title, content) {
  const baru = /^\d{4}-\d{2}-\d{2}$/.test(date) && selisihHari(date) <= 7;
  return h("article", { class: "panduan" },
    h("div", { class: "panduan-meta" }, h("time", { datetime: date }, tanggalPanjang(date)), baru ? h("span", { class: "badge b-emas" }, "Baru") : null),
    h("h2", {}, title || "(judul panduan)"),
    h("div", { class: "isi-teks" }, renderTeks(content)));
}

// Form panduan baru. tetap = siswa terkunci (tab di detail siswa); selain itu pilih banyak penerima.
export function formGuide({ siswa, tetap = null, saatSimpan }) {
  const pilih = new Map();
  if (tetap) pilih.set(tetap.id, tetap);
  let sibuk = false;

  const chips = h("div", { class: "chip-wadah" });
  const jumlah = h("p", { role: "status", style: "font-weight:800" });
  const kCari = kolom({ label: "Cari siswa untuk ditambahkan", tipe: "search", atribut: { autocomplete: "off" } });
  const saran = h("ul", { class: "saran", hidden: true });
  const tgl = kolom({ label: "Tanggal", tipe: "date", nilai: hariIniJakarta() });
  const jdl = kolom({ label: "Judul", atribut: { maxlength: 100, autocomplete: "off" } });
  const isi = kolom({ label: "Isi panduan", jenis: "textarea", atribut: { rows: 9, maxlength: 2000 }, bantuan: "Baris baru dipertahankan. Awali baris dengan “- ” untuk membuat daftar. Tanpa HTML." });
  const hitung = h("p", { class: "bantuan" });
  const pv = h("div", { class: "pratinjau", "aria-label": "Pratinjau" });
  const tombol = h("button", { type: "submit", class: "tombol tombol-utama" }, "Kirim panduan");

  function gambarChips() {
    chips.replaceChildren(...[...pilih.values()].map((s) => h("span", { class: "chip" }, `${s.child_name} (${s.grade})`,
      tetap ? null : h("button", { type: "button", "aria-label": "Hapus " + s.child_name, onclick: () => { pilih.delete(s.id); gambarChips(); } }, ikon("silang", 16)))));
    jumlah.textContent = `${pilih.size} penerima`;
    ubahStatus();
  }
  const ubahStatus = () => setKotor(!!(jdl.kontrol.value || isi.kontrol.value || (!tetap && pilih.size)));
  function gambarPv() {
    hitung.textContent = `${isi.kontrol.value.length}/2000 karakter`;
    pv.replaceChildren(pratinjau(tgl.kontrol.value, jdl.kontrol.value.trim(), isi.kontrol.value));
  }
  const tambahBanyak = (daftar, nama) => {
    if (!daftar.length) { toast(`Tidak ada siswa aktif untuk ${nama}.`, "info"); return; }
    daftar.forEach((s) => pilih.set(s.id, s)); gambarChips();
  };

  kCari.kontrol.addEventListener("input", () => {
    const c = bersihkanCari(kCari.kontrol.value).toLowerCase();
    if (c.length < 2) { saran.hidden = true; return; }
    const cocok = siswa.filter((s) => !pilih.has(s.id) && (s.child_name.toLowerCase().includes(c) || s.username.includes(c))).slice(0, 8);
    saran.replaceChildren(...(cocok.length
      ? cocok.map((s) => h("li", {}, h("button", { type: "button", onclick: () => { pilih.set(s.id, s); kCari.kontrol.value = ""; saran.hidden = true; gambarChips(); } }, `${s.child_name} · Kelas ${s.grade}${s.is_active ? "" : " (nonaktif)"}`)))
      : [h("li", {}, h("p", { class: "bantuan", style: "padding:.6rem .9rem;margin:0" }, "Tidak ada hasil."))]));
    saran.hidden = false;
  });

  const penerima = tetap ? null : h("section", { class: "kartu", "aria-labelledby": "jdl-penerima" },
    h("h2", { id: "jdl-penerima" }, "Penerima"),
    h("div", { class: "aksi-baris", style: "margin-bottom:.75rem" },
      ...[1, 2, 3, 4, 5, 6].map((n) => h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => tambahBanyak(siswa.filter((s) => s.is_active && s.grade === n), `kelas ${n}`) }, `Semua siswa kelas ${n}`)),
      h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => tambahBanyak(siswa.filter((s) => s.is_active), "semua kelas") }, "Semua siswa aktif"),
      h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => { pilih.clear(); gambarChips(); } }, "Kosongkan")),
    kCari.el, saran, jumlah, chips);

  const templat = h("div", { class: "aksi-baris", style: "margin-bottom:1rem" },
    h("span", { class: "label-kecil" }, "Templat cepat:"),
    ...TEMPLAT.map((t) => h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: async () => {
      if ((jdl.kontrol.value || isi.kontrol.value) && !(await konfirmasi({ judul: "Pakai templat?", isi: "Judul dan isi yang sudah ditulis akan diganti dengan templat. Anda tetap bisa mengeditnya.", ya: "Pakai templat" }))) return;
      jdl.kontrol.value = t.judul; isi.kontrol.value = t.isi; jdl.setGalat(""); isi.setGalat(""); gambarPv(); ubahStatus();
    } }, t.nama)));

  const form = h("form", { novalidate: true, class: "halaman", autocomplete: "off" },
    penerima,
    h("section", { class: "kartu", "aria-labelledby": "jdl-isi-guide" },
      h("h2", { id: "jdl-isi-guide" }, "Isi panduan"), templat, tgl.el, jdl.el, isi.el, hitung),
    h("section", { "aria-labelledby": "jdl-pv" }, h("h2", { id: "jdl-pv" }, "Pratinjau (tampilan orang tua)"), pv),
    h("div", {}, tombol));
  [tgl.kontrol, jdl.kontrol, isi.kontrol].forEach((k) => k.addEventListener("input", () => { gambarPv(); ubahStatus(); }));

  function reset() { jdl.kontrol.value = ""; isi.kontrol.value = ""; if (!tetap) { pilih.clear(); } gambarChips(); gambarPv(); setKotor(false); }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sibuk) return;
    const { galat, nilai } = validasiGuide({ date: tgl.kontrol.value, title: jdl.kontrol.value, content: isi.kontrol.value });
    tgl.setGalat(galat.date); jdl.setGalat(galat.title); isi.setGalat(galat.content);
    if (!pilih.size) { toast("Pilih minimal satu penerima.", "galat"); (kCari.kontrol.isConnected ? kCari.kontrol : form).focus?.(); return; }
    const g = galat.date ? tgl : galat.title ? jdl : galat.content ? isi : null;
    if (g) { g.kontrol.focus(); return; }
    sibuk = true; tombol.disabled = true; tombol.textContent = "Mengirim…";
    try {
      await saatSimpan({ ids: [...pilih.keys()], ...nilai });
      reset();
    } catch { toast("Gagal menyimpan panduan, coba lagi.", "galat"); }
    finally { sibuk = false; tombol.disabled = false; tombol.textContent = "Kirim panduan"; }
  });
  gambarChips(); gambarPv();
  return { el: form, reset };
}

// Simpan satu baris per siswa dalam satu permintaan
export async function simpanPanduan({ ids, date, title, content }) {
  await ambil(supabase.from("parent_guides").insert(ids.map((id) => ({ student_id: id, date, title, content }))));
  toast(`Parent Guide dikirim ke ${ids.length} siswa`);
}

export function ubahGuide(rec, saat) {
  const tgl = kolom({ label: "Tanggal", tipe: "date", nilai: rec.date });
  const jdl = kolom({ label: "Judul", atribut: { maxlength: 100 }, nilai: rec.title });
  const isi = kolom({ label: "Isi panduan", jenis: "textarea", atribut: { rows: 9, maxlength: 2000 }, nilai: rec.content || "" });
  let kotor = false;
  [tgl, jdl, isi].forEach((k) => k.kontrol.addEventListener("input", () => { kotor = true; }));
  const simpan = h("button", { type: "button", class: "tombol tombol-utama" }, "Simpan");
  const d = dialog({
    judul: "Ubah Parent Guide", lebar: true,
    isi: [h("p", { class: "kotak-peringatan" }, "Panduan yang dikirim ke banyak siswa disimpan terpisah per siswa. Mengubah di sini hanya mengubah panduan milik siswa ini, tidak otomatis ke siswa lain."),
      tgl.el, jdl.el, isi.el,
      h("div", { class: "dlg-aksi" }, h("button", { type: "button", class: "tombol tombol-garis", onclick: () => d.minta() }, "Batal"), simpan)],
    tanyaTutup: async () => !kotor || konfirmasi({ judul: "Tutup tanpa menyimpan?", isi: "Perubahan yang belum disimpan akan hilang.", ya: "Tutup", bahaya: true }),
  });
  simpan.addEventListener("click", async () => {
    const { galat, nilai } = validasiGuide({ date: tgl.kontrol.value, title: jdl.kontrol.value, content: isi.kontrol.value });
    tgl.setGalat(galat.date); jdl.setGalat(galat.title); isi.setGalat(galat.content);
    if (galat.date || galat.title || galat.content) return;
    simpan.disabled = true;
    try {
      const r = await ambil(supabase.from("parent_guides").update(nilai).eq("id", rec.id).select("id"));
      if (!r.length) throw new Error("kosong");
      kotor = false; d.tutup(); toast("Parent Guide diperbarui"); saat();
    } catch { simpan.disabled = false; toast("Gagal menyimpan, coba lagi.", "galat"); }
  });
}

export async function hapusGuide(rec, namaSiswa, saat) {
  const ya = await konfirmasi({ judul: "Hapus Parent Guide?", isi: `Hapus panduan “${rec.title}” milik ${namaSiswa}? Tindakan ini tidak bisa dibatalkan.`, ya: "Ya, hapus", bahaya: true });
  if (!ya) return;
  try {
    const r = await ambil(supabase.from("parent_guides").delete().eq("id", rec.id).select("id"));
    if (!r.length) throw new Error("kosong");
    toast("Parent Guide dihapus"); saat();
  } catch { toast("Gagal menghapus, coba lagi.", "galat"); }
}