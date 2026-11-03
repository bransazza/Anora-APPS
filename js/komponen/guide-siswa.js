// ANORA admin — guide-siswa.js (tab Parent Guide di detail siswa)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { h, ganti, elMemuat, elGalat, elKosong, tanggalPanjang } from "../ui.js";
import { sel } from "../widget.js";
import { potong } from "../util.js";
import { formGuide, simpanPanduan, ubahGuide, hapusGuide } from "./form-guide.js";

export async function tampilGuideSiswa(wadah, s) {
  const daftar = h("div");
  const f = formGuide({ siswa: [s], tetap: s, saatSimpan: async (v) => { await simpanPanduan(v); await muat(); } });
  ganti(wadah, h("div", { class: "halaman" },
    h("section", { "aria-labelledby": "jdl-tulis-pg" }, h("h2", { id: "jdl-tulis-pg" }, "Tulis panduan untuk " + s.child_name), f.el),
    h("section", { "aria-labelledby": "jdl-daftar-pg" }, h("h2", { id: "jdl-daftar-pg" }, "Panduan sebelumnya"), daftar)));
  await muat();

  async function muat() {
    ganti(daftar, elMemuat());
    try {
      const r = await ambil(supabase.from("parent_guides").select("id,date,title,content").eq("student_id", s.id)
        .order("date", { ascending: false }).order("created_at", { ascending: false }).limit(200));
      if (!r.length) { ganti(daftar, elKosong("Belum ada parent guide.", "Panduan yang Anda kirim akan tampil di sini.", "panduan")); return; }
      ganti(daftar, h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
        h("thead", {}, h("tr", {}, ["Tanggal", "Judul", "Cuplikan", "Aksi"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", {}, r.map((x) => h("tr", {},
          sel("Tanggal", tanggalPanjang(x.date)), sel("Judul", h("strong", {}, x.title)), sel("Cuplikan", potong(x.content, 90)),
          h("td", { "data-label": "" }, h("div", { class: "isi-sel aksi-baris" },
            h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => ubahGuide(x, muat) }, "Ubah"),
            h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => hapusGuide(x, s.child_name, muat) }, "Hapus")))))))));
    } catch (e) { ganti(daftar, elGalat(pesanGalat(e), muat)); }
  }
}