// ANORA admin — absensi-siswa.js (tab Absensi di detail siswa)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { h, ganti, elMemuat, elGalat, elKosong, lencanaAbsen, tanggalPendek, angka } from "../ui.js";
import { toast, sel } from "../widget.js";
import { formAbsensi, ubahAbsensi, hapusAbsensi } from "./form-absensi.js";

const stat = (label, nilai) => h("div", { class: "kartu-stat" }, h("span", { class: "stat-nilai" }, nilai), h("span", { class: "stat-label" }, label));

export async function tampilAbsensiSiswa(wadah, s) {
  const ringkasan = h("div"), daftar = h("div");
  const f = formAbsensi({});
  const tombol = h("button", { type: "button", class: "tombol tombol-utama" }, "Tambah sesi");
  tombol.addEventListener("click", async () => {
    const { galat, nilai } = f.ambil();
    if (galat) return;
    tombol.disabled = true;
    try {
      await ambil(supabase.from("attendance").insert({ student_id: s.id, ...nilai }));
      toast("Sesi absensi ditambahkan"); f.kosongkan(); await muat();
    } catch { toast("Gagal menyimpan, coba lagi.", "galat"); }
    finally { tombol.disabled = false; }
  });
  ganti(wadah, h("div", { class: "halaman" }, ringkasan,
    h("section", { class: "kartu", "aria-labelledby": "jdl-tambah-abs" }, h("h2", { id: "jdl-tambah-abs" }, "Tambah satu sesi"), f.el, tombol),
    daftar));
  await muat();

  async function muat() {
    ganti(daftar, elMemuat());
    try {
      const r = await ambil(supabase.from("attendance").select("id,date,day,status,topic,notes")
        .eq("student_id", s.id).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(1000));
      const n = (st) => r.filter((x) => x.status === st).length;
      ganti(ringkasan, r.length ? h("div", { class: "stat-grid" },
        stat("Total sesi", angka(r.length)), stat("Hadir", angka(n("Hadir"))), stat("Izin", angka(n("Izin"))),
        stat("Sakit", angka(n("Sakit"))), stat("Tanpa Keterangan", angka(n("Tanpa Keterangan"))),
        stat("Kehadiran", angka(n("Hadir") / r.length * 100) + "%")) : h("div"));
      if (!r.length) { ganti(daftar, elKosong("Belum ada riwayat absensi.", "Tambahkan sesi pertama lewat formulir di atas.", "kalender")); return; }
      ganti(daftar, h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
        h("thead", {}, h("tr", {}, ["Tanggal", "Status", "Materi", "Catatan", "Aksi"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", {}, r.map((x) => h("tr", {},
          sel("Tanggal", `${x.day}, ${tanggalPendek(x.date)}`),
          sel("Status", lencanaAbsen(x.status)),
          sel("Materi", x.topic || "—"),
          sel("Catatan", x.notes || "—"),
          h("td", { "data-label": "" }, h("div", { class: "isi-sel aksi-baris" },
            h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => ubahAbsensi(x, muat) }, "Ubah"),
            h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => hapusAbsensi(x, s.child_name, muat) }, "Hapus")))))))));
    } catch (e) { ganti(daftar, elGalat(pesanGalat(e), muat)); }
  }
}