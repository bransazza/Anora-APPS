// ANORA admin — tryout-hasil.js (hasil dan analisis satu try out)
import { supabase, ambil, ambilCount, pesanGalat } from "../supabase.js";
import { UUID } from "../api.js";
import { h, ganti, elMemuat, elGalat, elKosong, angka } from "../ui.js";
import { navHalaman, sel } from "../widget.js";
import { fmtWaktu, fmtDurasi, namaStatus } from "../waktu.js";

const PER = 25;

export async function tampil(wadah, ctx) {
  const id = ctx.params.id;
  ganti(wadah, elMemuat());
  let t = null, stats = null;
  if (UUID.test(id)) {
    try {
      [t, stats] = await Promise.all([
        ambil(supabase.from("tryouts").select("id,title,duration_minutes").eq("id", id).maybeSingle()),
        ambil(supabase.rpc("admin_tryout_stats", { p_tryout_id: id })),
      ]);
    } catch (e) { if (ctx.aktif()) ganti(wadah, elGalat(pesanGalat(e), () => tampil(wadah, ctx))); return; }
  }
  if (!ctx.aktif()) return;
  if (!t) { ganti(wadah, elKosong("Try out tidak ditemukan", "Mungkin sudah dihapus.", "jam", h("a", { class: "tombol tombol-utama", href: "#/tryout" }, "Kembali"))); return; }
  ctx.setJudul("Hasil: " + t.title);
  const r = stats.ringkas || {};
  const kartu = (label, nilai) => h("div", { class: "kartu-stat" }, h("span", { class: "stat-nilai" }, nilai), h("span", { class: "stat-label" }, label));
  const tabelWadah = h("div");
  let hal = 1, token = 0;

  async function muat() {
    const n = ++token;
    ganti(tabelWadah, elMemuat());
    try {
      const { data, count } = await ambilCount(supabase.from("attempts")
        .select("id,score,correct_count,total_count,status,started_at,submitted_at,students!inner(child_name,username)", { count: "exact" })
        .eq("tryout_id", id).in("status", ["submitted", "expired"]).order("submitted_at", { ascending: false }).range((hal - 1) * PER, hal * PER - 1));
      if (n !== token) return;
      if (!count) { ganti(tabelWadah, elKosong("Belum ada percobaan selesai.", "Hasil muncul setelah siswa mengumpulkan try out.", "jam")); return; }
      ganti(tabelWadah,
        h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
          h("thead", {}, h("tr", {}, ["Siswa", "Selesai", "Nilai", "Benar", "Durasi pengerjaan", "Status"].map((x) => h("th", { scope: "col" }, x)))),
          h("tbody", {}, data.map((a) => h("tr", {},
            sel("Siswa", h("strong", {}, a.students.child_name), h("span", { class: "sel-kecil" }, a.students.username)),
            sel("Selesai", fmtWaktu(a.submitted_at)),
            sel("Nilai", h("strong", {}, angka(a.score))),
            sel("Benar", `${a.correct_count} / ${a.total_count}`),
            sel("Durasi pengerjaan", fmtDurasi(a.started_at, a.submitted_at)),
            sel("Status", h("span", { class: "badge " + (a.status === "expired" ? "b-kuning" : "b-hijau") }, namaStatus(a.status)))))))),
        navHalaman({ hal, total: count, per: PER, saatPindah: (p) => { hal = p; muat(); } }));
    } catch (e) { if (n === token) ganti(tabelWadah, elGalat(pesanGalat(e), muat)); }
  }

  ganti(wadah, h("div", { class: "halaman" },
    h("a", { href: "#/tryout" }, "← Kembali ke daftar try out"),
    h("div", { class: "kepala-bagian" }, h("div", {}, h("h2", { class: "rapat" }, t.title), h("p", { class: "lembut rapat" }, `${t.duration_minutes} menit`)),
      h("a", { class: "tombol tombol-garis", href: "#/tryout/soal/" + id }, "Kelola soal")),
    h("div", { class: "stat-grid" },
      kartu("Percobaan selesai", angka(r.jumlah || 0)), kartu("Siswa berbeda", angka(r.siswa || 0)),
      kartu("Rata-rata", r.jumlah ? angka(r.rata) : "—"), kartu("Tertinggi", r.jumlah ? angka(r.tertinggi) : "—"), kartu("Terendah", r.jumlah ? angka(r.terendah) : "—")),
    h("section", { class: "kartu", "aria-labelledby": "jdl-analisis" },
      h("h2", { id: "jdl-analisis" }, "Soal yang paling banyak salah"),
      h("p", { class: "bantuan" }, "Soal yang tidak dijawab dihitung salah. Maksimal 10 soal, dari persentase salah tertinggi."),
      (stats.soal || []).length
        ? h("div", { class: "daftar-polos" }, stats.soal.map((s) => h("div", { class: "baris-analisis" },
            h("p", {}, h("strong", {}, `Soal no. ${s.pos}`), " · ", s.teks),
            h("p", { class: "lembut" }, `${s.salah} dari ${s.total} percobaan salah (${angka(s.persen)}%)`),
            h("div", { class: "bar-salah", role: "img", "aria-label": `${angka(s.persen)} persen salah` }, h("span", { style: `width:${Math.min(100, Math.max(0, s.persen))}%` })))))
        : h("p", { class: "lembut" }, "Belum ada data. Analisis muncul setelah ada percobaan selesai.")),
    h("section", { "aria-labelledby": "jdl-semua" }, h("h2", { id: "jdl-semua" }, "Semua percobaan"), tabelWadah)));
  await muat();
}