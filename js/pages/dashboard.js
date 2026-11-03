// ANORA admin — dashboard.js
import { supabase, ambil, ambilCount, pesanGalat } from "../supabase.js";
import { h, ikon, ganti, elMemuat, elGalat, hariIniJakarta, tambahHari, namaHari, tanggalPendek, tanggalDariTs, angka } from "../ui.js";

export async function tampil(wadah, ctx) {
  ganti(wadah, elMemuat());
  try {
    const S = () => supabase.from("students").select("id", { count: "exact", head: true });
    const hari = Array.from({ length: 7 }, (_, i) => tambahHari(hariIniJakarta(), i - 6));
    const [total, aktif, lunas, pending, belum, antrean, ...perHari] = await Promise.all([
      ambilCount(S()), ambilCount(S().eq("is_active", true)), ambilCount(S().eq("payment_status", "Lunas")),
      ambilCount(S().eq("payment_status", "Pending")), ambilCount(S().eq("payment_status", "Belum Bayar")),
      ambil(supabase.from("students").select("id,child_name,grade,created_at").eq("payment_status", "Pending").order("created_at", { ascending: false }).limit(5)),
      ...hari.map((d) => ambilCount(supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", d))),
    ]);
    if (!ctx.aktif()) return;
    ganti(wadah, susun({ total: total.count, aktif: aktif.count, lunas: lunas.count, pending: pending.count, belum: belum.count }, antrean, hari, perHari.map((x) => x.count)));
  } catch (e) {
    if (!ctx.aktif()) return;
    ganti(wadah, elGalat(pesanGalat(e), () => tampil(wadah, ctx)));
  }
}

const kartu = (label, nilai, href) => h("a", { class: "kartu-stat", href }, h("span", { class: "stat-nilai" }, angka(nilai)), h("span", { class: "stat-label" }, label));

function susun(c, antrean, hari, jumlah) {
  const maks = Math.max(1, ...jumlah);
  const alt = "Jumlah catatan absensi 7 hari terakhir: " + hari.map((d, i) => `${namaHari(d)} ${tanggalPendek(d)} ${jumlah[i]}`).join("; ") + ".";
  return h("div", { class: "halaman" },
    h("div", { class: "stat-grid" },
      kartu("Total siswa", c.total, "#/siswa"), kartu("Siswa aktif", c.aktif, "#/siswa?akun=aktif"),
      kartu("Lunas", c.lunas, "#/siswa?status=Lunas"), kartu("Pending", c.pending, "#/siswa?status=Pending"),
      kartu("Belum Bayar", c.belum, "#/siswa?status=Belum%20Bayar")),
    h("div", { class: "aksi-baris" },
      h("a", { class: "tombol tombol-utama", href: "#/siswa/tambah" }, ikon("tambah", 18), "Tambah siswa"),
      h("a", { class: "tombol tombol-garis", href: "#/absensi?mode=input" }, ikon("kalender", 18), "Input absensi hari ini"),
      h("a", { class: "tombol tombol-garis", href: "#/parent-guide?aksi=tulis" }, ikon("panduan", 18), "Tulis parent guide")),
    h("div", { class: "dua-kolom" },
      h("section", { class: "kartu", "aria-labelledby": "jdl-antre" },
        h("h2", { id: "jdl-antre" }, "Perlu dikonfirmasi"),
        antrean.length
          ? h("ul", { class: "daftar-polos" }, antrean.map((s) => h("li", {},
              h("span", {}, h("strong", {}, s.child_name), ` · Kelas ${s.grade} · dibuat ${tanggalDariTs(s.created_at)}`),
              h("a", { class: "tombol tombol-garis kecil", href: "#/siswa/" + s.id }, "Buka"))))
          : h("p", { class: "lembut" }, "Tidak ada siswa berstatus Pending. Semuanya sudah dikonfirmasi.")),
      h("section", { class: "kartu", "aria-labelledby": "jdl-7hari" },
        h("h2", { id: "jdl-7hari" }, "Absensi 7 hari terakhir"),
        h("div", { class: "batang-grid", role: "img", "aria-label": alt },
          hari.map((d, i) => h("div", { class: "batang", "aria-hidden": "true" },
            h("span", {}, jumlah[i]), h("div", { class: "batang-isi", style: `height:${Math.max(3, Math.round(jumlah[i] / maks * 100))}px` }), h("small", {}, namaHari(d).slice(0, 3)))))),
        h("p", { class: "bantuan" }, "Jumlah catatan absensi (satu catatan = satu siswa dalam satu sesi).")));
}