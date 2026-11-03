// ANORA admin — nilai-siswa.js (tab Nilai di detail siswa)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { h, ganti, elMemuat, elGalat, elKosong, angka } from "../ui.js";
import { sel } from "../widget.js";
import { fmtWaktu, namaStatus } from "../waktu.js";

export async function tampilNilaiSiswa(wadah, s) {
  ganti(wadah, elMemuat());
  try {
    const r = await ambil(supabase.from("attempts")
      .select("id,kind,material_id,tryout_id,score,correct_count,total_count,status,submitted_at,materials(title),tryouts(title)")
      .eq("student_id", s.id).in("status", ["submitted", "expired"]).order("submitted_at", { ascending: false }).limit(1000));
    if (!r.length) { ganti(wadah, elKosong("Belum ada nilai.", "Nilai muncul setelah siswa mengumpulkan latihan atau try out.", "medali")); return; }
    const rata = (arr) => (arr.length ? angka(arr.reduce((a, x) => a + Number(x.score || 0), 0) / arr.length) : "—");
    const lat = r.filter((x) => x.kind === "latihan"), to = r.filter((x) => x.kind === "tryout");
    const kartu = (label, nilai) => h("div", { class: "kartu-stat" }, h("span", { class: "stat-nilai" }, nilai), h("span", { class: "stat-label" }, label));
    ganti(wadah, h("div", { class: "halaman" },
      h("div", { class: "stat-grid" },
        kartu("Rata-rata latihan", rata(lat)), kartu("Rata-rata try out", rata(to)),
        kartu("Bab latihan selesai", angka(new Set(lat.map((x) => x.material_id)).size)), kartu("Percobaan try out", angka(to.length))),
      h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
        h("thead", {}, h("tr", {}, ["Judul", "Jenis", "Nilai", "Benar", "Selesai", "Status"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", {}, r.map((a) => h("tr", {},
          sel("Judul", (a.kind === "tryout" ? a.tryouts && a.tryouts.title : a.materials && a.materials.title) || "—"),
          sel("Jenis", h("span", { class: "badge " + (a.kind === "tryout" ? "b-biru" : "b-hijau") }, a.kind === "tryout" ? "Try Out" : "Latihan")),
          sel("Nilai", h("strong", {}, angka(a.score))),
          sel("Benar", `${a.correct_count} / ${a.total_count}`),
          sel("Selesai", fmtWaktu(a.submitted_at)),
          sel("Status", namaStatus(a.status)))))))));
  } catch (e) { ganti(wadah, elGalat(pesanGalat(e), () => tampilNilaiSiswa(wadah, s))); }
}