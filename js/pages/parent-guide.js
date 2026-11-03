// ANORA admin — parent-guide.js (menu Parent Guide: daftar dan tulis panduan)
import { supabase, ambilCount, pesanGalat } from "../supabase.js";
import { semuaSiswa } from "../api.js";
import { h, ikon, ganti, elMemuat, elGalat, elKosong, tanggalPanjang } from "../ui.js";
import { kolom, navHalaman, konfirmasi, setKotor, status, sel } from "../widget.js";
import { debounce, bersihkanCari, potong } from "../util.js";
import { formGuide, simpanPanduan, ubahGuide, hapusGuide } from "../komponen/form-guide.js";

const PER = 25;
const KOL = "id,student_id,date,title,content,students!inner(child_name,grade)";

export async function tampil(wadah, ctx) {
  const isi = h("div", { class: "halaman" });
  ganti(wadah, isi);
  if (ctx.query.get("aksi") === "tulis") await tampilTulis(isi, ctx); else await tampilDaftar(isi, ctx);
}

async function tampilTulis(isi, ctx) {
  ganti(isi, elMemuat());
  let siswa;
  try { siswa = await semuaSiswa(); } catch (e) { ganti(isi, elGalat(pesanGalat(e), () => tampilTulis(isi, ctx))); return; }
  if (!ctx.aktif()) return;
  if (!siswa.length) {
    ganti(isi, elKosong("Belum ada siswa", "Tambahkan siswa dulu sebelum menulis panduan.", "orang", h("a", { class: "tombol tombol-utama", href: "#/siswa/tambah" }, "Tambah siswa")));
    return;
  }
  const f = formGuide({ siswa, saatSimpan: simpanPanduan });
  ganti(isi,
    h("div", { class: "kepala-bagian" },
      h("h2", { class: "rapat" }, "Tulis panduan"),
      h("button", { type: "button", class: "tombol tombol-garis", onclick: async () => {
        if (status.kotor && !(await konfirmasi({ judul: "Panduan belum dikirim", isi: "Isian yang belum dikirim akan hilang.", ya: "Kembali ke daftar", bahaya: true }))) return;
        setKotor(false); ctx.gantiHash("#/parent-guide"); tampilDaftar(isi, ctx);
      } }, "← Kembali ke daftar")),
    f.el);
}

async function tampilDaftar(isi, ctx) {
  ganti(isi, elMemuat());
  let daftarSiswa;
  try { daftarSiswa = await semuaSiswa(); } catch (e) { ganti(isi, elGalat(pesanGalat(e), () => tampilDaftar(isi, ctx))); return; }
  if (!ctx.aktif()) return;

  const kSiswa = kolom({ label: "Siswa", pilihan: [["", "Semua siswa"], ...daftarSiswa.map((s) => [s.id, `${s.child_name} (Kelas ${s.grade})`])] });
  const kKelas = kolom({ label: "Kelas", pilihan: [["", "Semua kelas"], ...[1, 2, 3, 4, 5, 6].map((n) => [String(n), "Kelas " + n])] });
  const kDari = kolom({ label: "Dari tanggal", tipe: "date" });
  const kSampai = kolom({ label: "Sampai tanggal", tipe: "date" });
  const kCari = kolom({ label: "Cari judul", tipe: "search", atribut: { autocomplete: "off" } });
  const hasil = h("div");
  let hal = 1, token = 0;

  function q(kol, opsi) {
    let x = supabase.from("parent_guides").select(kol, opsi);
    if (kSiswa.kontrol.value) x = x.eq("student_id", kSiswa.kontrol.value);
    if (kKelas.kontrol.value) x = x.eq("students.grade", Number(kKelas.kontrol.value));
    if (kDari.kontrol.value) x = x.gte("date", kDari.kontrol.value);
    if (kSampai.kontrol.value) x = x.lte("date", kSampai.kontrol.value);
    const t = bersihkanCari(kCari.kontrol.value);
    if (t) x = x.ilike("title", `%${t}%`);
    return x;
  }
  const bukaTulis = () => { ctx.gantiHash("#/parent-guide?aksi=tulis"); tampilTulis(isi, ctx); };

  async function muat() {
    const n = ++token;
    ganti(hasil, elMemuat());
    try {
      const { data, count } = await ambilCount(q(KOL, { count: "exact" }).order("date", { ascending: false }).order("created_at", { ascending: false }).range((hal - 1) * PER, hal * PER - 1));
      if (n !== token) return;
      if (!count) {
        ganti(hasil, elKosong("Belum ada parent guide.", "Tulis panduan pertama untuk orang tua siswa.", "panduan",
          h("button", { type: "button", class: "tombol tombol-utama", onclick: bukaTulis }, "Tulis panduan")));
        return;
      }
      if (!data.length && hal > 1) { hal = 1; muat(); return; }
      ganti(hasil,
        h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
          h("thead", {}, h("tr", {}, ["Siswa", "Tanggal", "Judul", "Cuplikan", "Aksi"].map((t) => h("th", { scope: "col" }, t)))),
          h("tbody", {}, data.map((x) => h("tr", {},
            sel("Siswa", h("strong", {}, x.students.child_name), h("span", { class: "sel-kecil" }, `Kelas ${x.students.grade}`)),
            sel("Tanggal", tanggalPanjang(x.date)), sel("Judul", h("strong", {}, x.title)), sel("Cuplikan", potong(x.content, 90)),
            h("td", { "data-label": "" }, h("div", { class: "isi-sel aksi-baris" },
              h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => ubahGuide(x, muat) }, "Ubah"),
              h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => hapusGuide(x, x.students.child_name, muat) }, "Hapus")))))))),
        navHalaman({ hal, total: count, per: PER, saatPindah: (p) => { hal = p; muat(); } }));
    } catch (e) { if (n === token) ganti(hasil, elGalat(pesanGalat(e), muat)); }
  }

  const tunda = debounce(() => { hal = 1; muat(); }, 300);
  kCari.kontrol.addEventListener("input", tunda);
  [kSiswa, kKelas, kDari, kSampai].forEach((k) => k.kontrol.addEventListener("change", () => { hal = 1; muat(); }));
  ganti(isi,
    h("div", { class: "kepala-bagian" }, h("h2", { class: "rapat" }, "Semua panduan"),
      h("button", { type: "button", class: "tombol tombol-utama", onclick: bukaTulis }, ikon("tambah", 18), "Tulis panduan")),
    h("div", { class: "filter" }, kSiswa.el, kKelas.el, kDari.el, kSampai.el, kCari.el), hasil);
  await muat();
}