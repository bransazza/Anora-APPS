// ANORA admin — soal.js (kelola soal satu bab ATAU satu try out)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { UUID } from "../api.js";
import { parseHash } from "../router.js";
import { h, ikon, ganti, elMemuat, elGalat, elKosong } from "../ui.js";
import { konfirmasi, toast, sel } from "../widget.js";
import { potong } from "../util.js";
import { muatSoal, simpanSoal, urutkanSoal, pathGambar, pesanRpc } from "../komponen/soal-api.js";
import { keItemRpc } from "../komponen/soal-parse.js";
import { bukaEditor } from "../komponen/soal-editor.js";
import { bukaImpor } from "../komponen/soal-impor.js";
import { bukaSalin } from "../komponen/soal-salin.js";
import { bukaAmbil } from "../komponen/soal-ambil.js";
import { bersihkanTakTerpakai, BUCKET_SOAL, BUCKET_BAHAS } from "../gambar.js";

export async function tampil(wadah, ctx) {
  const id = ctx.params.id;
  const tryout = parseHash().path.startsWith("/tryout/");
  const induk = tryout ? { id, jenis: "tryout" } : id;
  ganti(wadah, elMemuat());
  let info = null;
  if (UUID.test(id)) {
    try {
      info = tryout
        ? await ambil(supabase.from("tryouts").select("id,title,subject_id,duration_minutes").eq("id", id).maybeSingle())
        : await ambil(supabase.from("materials").select("id,title,grade,subject_id").eq("id", id).maybeSingle());
    } catch (e) { if (ctx.aktif()) ganti(wadah, elGalat(pesanGalat(e), () => tampil(wadah, ctx))); return; }
  }
  if (!ctx.aktif()) return;
  const balik = tryout ? "#/tryout" : "#/materi";
  if (!info) {
    ganti(wadah, elKosong(tryout ? "Try out tidak ditemukan" : "Bab tidak ditemukan", "Mungkin sudah dihapus.", "buku", h("a", { class: "tombol tombol-utama", href: balik }, "Kembali")));
    return;
  }
  ctx.setJudul("Soal: " + info.title);
  let daftar = [], fokusId = null;
  const hasil = h("div");
  const kembali = tryout ? "#/tryout" : `#/materi?kelas=${info.grade}&mapel=${info.subject_id}`;

  async function muat() {
    ganti(hasil, elMemuat());
    try { daftar = await muatSoal(induk); gambar(); }
    catch (e) { ganti(hasil, elGalat(pesanGalat(e), muat)); }
  }
  const ringkasan = (it) => {
    const ada = [];
    if (it.gambarSoal) ada.push("Soal");
    if (it.opsi.some((o) => o.gambar)) ada.push("Opsi");
    if (it.gambarBahas) ada.push("Pembahasan");
    return ada.length ? ada.map((a) => h("span", { class: "badge b-biru", style: "margin:0 .25rem .25rem 0" }, a)) : "—";
  };

  function gambar() {
    if (!daftar.length) {
      ganti(hasil, elKosong(tryout ? "Try out ini belum punya soal." : "Bab ini belum punya soal.", "Tambahkan satu per satu, lewat input cepat, atau ambil dari soal lain.", "panduan",
        h("button", { type: "button", class: "tombol tombol-utama", onclick: () => bukaEditor({ materialId: induk, item: null, saat: muat }) }, "Tambah soal")));
      return;
    }
    ganti(hasil, h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
      h("thead", {}, h("tr", {}, ["No", "Soal", "Gambar", "Kunci", "Aksi"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, daftar.map((it, i) => h("tr", {},
        sel("No", h("div", { class: "urutan" }, h("span", { class: "no-urut" }, i + 1),
          h("button", { type: "button", class: "ikon-tombol", id: "naik-" + it.id, "aria-label": `Naikkan soal ${i + 1}`, disabled: i === 0, onclick: () => geser(i, -1, "naik-" + it.id) }, ikon("naik", 18)),
          h("button", { type: "button", class: "ikon-tombol", id: "turun-" + it.id, "aria-label": `Turunkan soal ${i + 1}`, disabled: i === daftar.length - 1, onclick: () => geser(i, 1, "turun-" + it.id) }, ikon("turun", 18)))),
        sel("Soal", h("span", { class: "cuplikan" }, potong(it.teks.replace(/\s+/g, " ") || "(soal bergambar)", 110))),
        sel("Gambar", ringkasan(it)),
        sel("Kunci", h("strong", {}, it.kunci || "?")),
        h("td", { "data-label": "" }, h("div", { class: "isi-sel aksi-baris" },
          h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => bukaEditor({ materialId: induk, item: it, saat: muat }) }, ikon("edit", 16), "Ubah"),
          h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => duplikat(it, i) }, ikon("salin", 16), "Duplikat"),
          h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => hapus(it, i) }, ikon("sampah", 16), "Hapus")))))))));
    if (fokusId) {
      const a = document.getElementById(fokusId);
      if (a && !a.disabled) a.focus();
      else document.getElementById(fokusId.replace(/^(naik|turun)/, (x) => (x === "naik" ? "turun" : "naik")))?.focus();
      fokusId = null;
    }
  }

  async function geser(i, arah, idFokus) {
    const j = i + arah;
    if (j < 0 || j >= daftar.length) return;
    const baru = [...daftar];
    [baru[i], baru[j]] = [baru[j], baru[i]];
    const lama = daftar;
    daftar = baru; fokusId = idFokus; gambar();
    try { await urutkanSoal(induk, baru.map((x) => x.id)); }
    catch { daftar = lama; gambar(); toast("Gagal menyimpan urutan, coba lagi.", "galat"); }
  }
  async function duplikat(it, i) {
    try {
      const ids = await simpanSoal(induk, false, [keItemRpc({ ...it, id: undefined })]);
      const urut = daftar.map((x) => x.id);
      urut.splice(i + 1, 0, ids[0]);
      await urutkanSoal(induk, urut);
      toast("Soal diduplikat");
      await muat();
    } catch (e) { toast(pesanRpc(e), "galat"); }
  }
  async function hapus(it, i) {
    const ya = await konfirmasi({ judul: "Hapus soal?", isi: `Hapus soal no. ${i + 1}? Jawaban siswa untuk soal ini ikut terhapus. Tindakan ini tidak bisa dibatalkan.`, ya: "Ya, hapus", bahaya: true });
    if (!ya) return;
    try {
      const r = await ambil(supabase.from("questions").delete().eq("id", it.id).select("id"));
      if (!r.length) throw new Error("kosong");
    } catch { toast("Gagal menghapus soal, coba lagi.", "galat"); return; }
    const p = pathGambar([it]);
    bersihkanTakTerpakai(BUCKET_SOAL, p.soal).catch(() => {});
    bersihkanTakTerpakai(BUCKET_BAHAS, p.bahas).catch(() => {});
    toast("Soal dihapus");
    await muat();
  }

  const buka = (jenis) => bukaImpor({ jenis, materialId: induk, jumlahAda: daftar.length, saat: muat });
  ganti(wadah, h("div", { class: "halaman" },
    h("a", { href: kembali }, tryout ? "← Kembali ke daftar try out" : "← Kembali ke daftar bab"),
    h("div", { class: "kepala-bagian" },
      h("div", {}, h("h2", { class: "rapat" }, info.title),
        h("p", { class: "lembut rapat" }, tryout ? `Soal try out · ${info.duration_minutes} menit` : "Soal latihan pilihan ganda untuk bab ini.")),
      h("div", { class: "aksi-baris" },
        h("button", { type: "button", class: "tombol tombol-utama", onclick: () => bukaEditor({ materialId: induk, item: null, saat: muat }) }, ikon("tambah", 18), "Tambah soal"),
        h("button", { type: "button", class: "tombol tombol-garis", onclick: () => buka("teks") }, "Input cepat: tempel teks"),
        h("button", { type: "button", class: "tombol tombol-garis", onclick: () => buka("sheet") }, "Impor Excel / CSV"),
        tryout
          ? h("button", { type: "button", class: "tombol tombol-garis", onclick: () => bukaAmbil({ tryoutId: id, mapelId: info.subject_id, saat: muat }) }, "Ambil dari soal latihan")
          : h("button", { type: "button", class: "tombol tombol-garis", onclick: () => bukaSalin({ materialId: id, kelas: info.grade, mapelId: info.subject_id, saat: muat }) }, "Salin dari bab lain"))),
    hasil));
  await muat();
}