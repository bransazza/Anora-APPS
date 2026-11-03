// ANORA admin — nilai.js (rekap nilai semua siswa: latihan dan try out)
import { supabase, ambil, ambilCount, pesanGalat } from "../supabase.js";
import { semuaSiswa } from "../api.js";
import { h, ikon, ganti, elMemuat, elGalat, elKosong, angka } from "../ui.js";
import { kolom, navHalaman, toast, sel } from "../widget.js";
import { unduhCsv } from "../util.js";
import { fmtWaktu, namaStatus } from "../waktu.js";

const PER = 25;
const KOL = "id,kind,score,correct_count,total_count,status,submitted_at,students!inner(child_name,grade,username),materials(title),tryouts(title)";

export async function tampil(wadah, ctx) {
  ganti(wadah, elMemuat());
  let siswa = [];
  try { siswa = await semuaSiswa(); } catch (e) { ganti(wadah, elGalat(pesanGalat(e), () => tampil(wadah, ctx))); return; }
  if (!ctx.aktif()) return;

  const kJenis = kolom({ label: "Jenis", pilihan: [["", "Semua"], ["latihan", "Latihan"], ["tryout", "Try Out"]] });
  const kKelas = kolom({ label: "Kelas siswa", pilihan: [["", "Semua"], ...[1, 2, 3, 4, 5, 6].map((n) => [String(n), "Kelas " + n])] });
  const kSiswa = kolom({ label: "Siswa", pilihan: [["", "Semua siswa"], ...siswa.map((s) => [s.id, s.child_name])] });
  const kDari = kolom({ label: "Dari tanggal", tipe: "date" });
  const kSampai = kolom({ label: "Sampai tanggal", tipe: "date" });
  const ringkasan = h("p", { role: "status", style: "font-weight:800;margin:0" });
  const hasil = h("div");
  const tombolCsv = h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => ekspor() }, ikon("unduh", 16), "Ekspor CSV");
  let hal = 1, token = 0;

  function q(kol, opsi) {
    let x = supabase.from("attempts").select(kol, opsi).in("status", ["submitted", "expired"]);
    if (kJenis.kontrol.value) x = x.eq("kind", kJenis.kontrol.value);
    if (kKelas.kontrol.value) x = x.eq("students.grade", Number(kKelas.kontrol.value));
    if (kSiswa.kontrol.value) x = x.eq("student_id", kSiswa.kontrol.value);
    if (kDari.kontrol.value) x = x.gte("submitted_at", kDari.kontrol.value + "T00:00:00+07:00");
    if (kSampai.kontrol.value) x = x.lte("submitted_at", kSampai.kontrol.value + "T23:59:59+07:00");
    return x;
  }
  const judulDari = (a) => (a.kind === "tryout" ? a.tryouts && a.tryouts.title : a.materials && a.materials.title) || "—";

  async function muat() {
    const n = ++token;
    ganti(hasil, elMemuat());
    try {
      const { data, count } = await ambilCount(q(KOL + "", { count: "exact" }).order("submitted_at", { ascending: false }).range((hal - 1) * PER, hal * PER - 1));
      // rata-rata dihitung dari sampai 5000 nilai pertama hasil filter
      let jumlah = 0, total = 0;
      for (let dari = 0; dari < 5000; dari += 1000) {
        const s = await ambil(q("score,students!inner(grade)").range(dari, dari + 999));
        s.forEach((x) => { if (x.score !== null) { jumlah++; total += Number(x.score); } });
        if (s.length < 1000) break;
      }
      if (n !== token) return;
      ringkasan.textContent = `${angka(count)} percobaan` + (jumlah ? ` · rata-rata nilai ${angka(total / jumlah)}` : "");
      if (!count) { ganti(hasil, elKosong("Tidak ada nilai yang cocok.", "Ubah filter, atau tunggu siswa mengumpulkan latihan/try out.", "medali")); return; }
      if (!data.length && hal > 1) { hal = 1; muat(); return; }
      ganti(hasil,
        h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
          h("thead", {}, h("tr", {}, ["Siswa", "Judul", "Jenis", "Nilai", "Benar", "Selesai", "Status"].map((t) => h("th", { scope: "col" }, t)))),
          h("tbody", {}, data.map((a) => h("tr", {},
            sel("Siswa", h("strong", {}, a.students.child_name), h("span", { class: "sel-kecil" }, `Kelas ${a.students.grade}`)),
            sel("Judul", judulDari(a)),
            sel("Jenis", h("span", { class: "badge " + (a.kind === "tryout" ? "b-biru" : "b-hijau") }, a.kind === "tryout" ? "Try Out" : "Latihan")),
            sel("Nilai", h("strong", {}, angka(a.score))),
            sel("Benar", `${a.correct_count} / ${a.total_count}`),
            sel("Selesai", fmtWaktu(a.submitted_at)),
            sel("Status", namaStatus(a.status))))))),
        navHalaman({ hal, total: count, per: PER, saatPindah: (p) => { hal = p; muat(); } }));
    } catch (e) { if (n === token) ganti(hasil, elGalat(pesanGalat(e), muat)); }
  }

  async function ekspor() {
    tombolCsv.disabled = true;
    try {
      let semua = [], dari = 0;
      for (;;) {
        const d = await ambil(q(KOL).order("submitted_at", { ascending: false }).range(dari, dari + 999));
        semua = semua.concat(d);
        if (d.length < 1000 || semua.length >= 20000) break;
        dari += 1000;
      }
      unduhCsv("nilai-siswa.csv", [["Nama anak", "Kelas siswa", "Username", "Jenis", "Judul", "Nilai", "Benar", "Total soal", "Selesai", "Status"],
        ...semua.map((a) => [a.students.child_name, a.students.grade, a.students.username, a.kind === "tryout" ? "Try Out" : "Latihan", judulDari(a), a.score, a.correct_count, a.total_count, a.submitted_at, namaStatus(a.status)])]);
      toast(`${semua.length} baris diekspor`);
    } catch { toast("Gagal mengekspor, coba lagi.", "galat"); }
    finally { tombolCsv.disabled = false; }
  }

  [kJenis, kKelas, kSiswa, kDari, kSampai].forEach((k) => k.kontrol.addEventListener("change", () => { hal = 1; muat(); }));
  ganti(wadah, h("div", { class: "halaman" },
    h("div", { class: "filter" }, kJenis.el, kKelas.el, kSiswa.el, kDari.el, kSampai.el),
    h("div", { class: "kepala-bagian" }, ringkasan, tombolCsv), hasil));
  await muat();
}