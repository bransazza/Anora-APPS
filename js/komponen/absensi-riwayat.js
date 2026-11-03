// ANORA admin — absensi-riwayat.js (tabel semua absensi dengan filter)
import { supabase, ambil, ambilCount, pesanGalat } from "../supabase.js";
import { semuaSiswa } from "../api.js";
import { h, ganti, ikon, elMemuat, elGalat, elKosong, lencanaAbsen, tanggalPendek, angka } from "../ui.js";
import { kolom, navHalaman, toast, sel } from "../widget.js";
import { STATUS_ABSEN, unduhCsv } from "../util.js";
import { ubahAbsensi, hapusAbsensi } from "./form-absensi.js";

const PER = 25;
const KOL = "id,student_id,date,day,status,topic,notes,students!inner(child_name,grade,username)";

export async function tampilRiwayat(wadah, ctx) {
  ganti(wadah, elMemuat());
  let daftarSiswa = [];
  try { daftarSiswa = await semuaSiswa(); } catch (e) { ganti(wadah, elGalat(pesanGalat(e), () => tampilRiwayat(wadah, ctx))); return; }
  if (!ctx.aktif()) return;

  const kDari = kolom({ label: "Dari tanggal", tipe: "date" });
  const kSampai = kolom({ label: "Sampai tanggal", tipe: "date" });
  const kStatus = kolom({ label: "Status", pilihan: [["", "Semua status"], ...STATUS_ABSEN.map((x) => [x, x])] });
  const kKelas = kolom({ label: "Kelas", pilihan: [["", "Semua kelas"], ...[1, 2, 3, 4, 5, 6].map((n) => [String(n), "Kelas " + n])] });
  const kSiswa = kolom({ label: "Siswa", pilihan: [["", "Semua siswa"], ...daftarSiswa.map((s) => [s.id, `${s.child_name} (Kelas ${s.grade})`])] });
  const ringkasan = h("div", { "aria-live": "polite" });
  const hasil = h("div");
  const tombolCsv = h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => ekspor() }, ikon("unduh", 16), "Ekspor CSV");
  let hal = 1, token = 0;

  const f = () => ({ dari: kDari.kontrol.value, sampai: kSampai.kontrol.value, status: kStatus.kontrol.value, kelas: kKelas.kontrol.value, siswa: kSiswa.kontrol.value });
  function q(kol, opsi) {
    const x = f();
    let r = supabase.from("attendance").select(kol, opsi);
    if (x.dari) r = r.gte("date", x.dari);
    if (x.sampai) r = r.lte("date", x.sampai);
    if (x.status) r = r.eq("status", x.status);
    if (x.kelas) r = r.eq("students.grade", Number(x.kelas));
    if (x.siswa) r = r.eq("student_id", x.siswa);
    return r;
  }
  const urut = (r) => r.order("date", { ascending: false }).order("created_at", { ascending: false });

  async function muat() {
    const n = ++token;
    ganti(hasil, elMemuat());
    try {
      const { data, count } = await ambilCount(urut(q(KOL, { count: "exact" })).range((hal - 1) * PER, hal * PER - 1));
      const daftarStatus = f().status ? [f().status] : STATUS_ABSEN;
      const hitung = await Promise.all(daftarStatus.map((x) => ambilCount(q("id,students!inner(id)", { count: "exact", head: true }).eq("status", x)).then((r) => [x, r.count])));
      if (n !== token) return;
      ganti(ringkasan, h("p", {}, h("strong", {}, `${angka(count)} catatan`), " · ", hitung.map(([x, c]) => `${c} ${x}`).join(" · ")));
      if (!count) { ganti(hasil, elKosong("Tidak ada absensi yang cocok.", "Ubah filter atau input absensi baru.", "kalender")); return; }
      if (!data.length && hal > 1) { hal = 1; muat(); return; }
      ganti(hasil,
        h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
          h("thead", {}, h("tr", {}, ["Tanggal", "Siswa", "Status", "Materi", "Catatan", "Aksi"].map((t) => h("th", { scope: "col" }, t)))),
          h("tbody", {}, data.map((x) => h("tr", {},
            sel("Tanggal", `${x.day}, ${tanggalPendek(x.date)}`),
            sel("Siswa", h("strong", {}, x.students.child_name), h("span", { class: "sel-kecil" }, `Kelas ${x.students.grade}`)),
            sel("Status", lencanaAbsen(x.status)),
            sel("Materi", x.topic || "—"),
            sel("Catatan", x.notes || "—"),
            h("td", { "data-label": "" }, h("div", { class: "isi-sel aksi-baris" },
              h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => ubahAbsensi(x, muat) }, "Ubah"),
              h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => hapusAbsensi(x, x.students.child_name, muat) }, "Hapus")))))))),
        navHalaman({ hal, total: count, per: PER, saatPindah: (p) => { hal = p; muat(); } }));
    } catch (e) { if (n === token) ganti(hasil, elGalat(pesanGalat(e), muat)); }
  }

  async function ekspor() {
    tombolCsv.disabled = true;
    try {
      let semua = [], dari = 0;
      for (;;) {
        const d = await ambil(urut(q(KOL)).range(dari, dari + 999));
        semua = semua.concat(d);
        if (d.length < 1000 || semua.length >= 20000) break;
        dari += 1000;
      }
      unduhCsv("riwayat-absensi.csv", [["Tanggal", "Hari", "Nama anak", "Kelas", "Username", "Status", "Materi", "Catatan"],
        ...semua.map((x) => [x.date, x.day, x.students.child_name, x.students.grade, x.students.username, x.status, x.topic, x.notes])]);
      toast(`${semua.length} baris diekspor`);
    } catch { toast("Gagal mengekspor, coba lagi.", "galat"); }
    finally { tombolCsv.disabled = false; }
  }

  [kDari, kSampai, kStatus, kKelas, kSiswa].forEach((k) => k.kontrol.addEventListener("change", () => { hal = 1; muat(); }));
  ganti(wadah, h("div", { class: "halaman" },
    h("div", { class: "filter" }, kDari.el, kSampai.el, kStatus.el, kKelas.el, kSiswa.el),
    h("div", { class: "kepala-bagian" }, ringkasan, tombolCsv), hasil));
  await muat();
}