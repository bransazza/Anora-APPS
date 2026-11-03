// ANORA admin — siswa-daftar.js (daftar siswa, filter, urutan, ekspor CSV)
import { supabase, ambil, ambilCount, pesanGalat } from "../supabase.js";
import { h, ikon, ganti, elMemuat, elGalat, elKosong, badgeBayar, badgeAktif, tanggalPendek, tanggalDariTs, angka } from "../ui.js";
import { kolom, navHalaman, menuTitik, toast, sel } from "../widget.js";
import { debounce, bersihkanCari, unduhCsv, STATUS_BAYAR } from "../util.js";

const PER = 25;
const URUT = {
  nama: ["Nama A–Z", (q) => q.order("child_name", { ascending: true })],
  terbaru: ["Terbaru", (q) => q.order("created_at", { ascending: false })],
  hadir: ["Kehadiran terendah", (q) => q.order("attendance_pct", { ascending: true, nullsFirst: false }).order("child_name")],
};

export async function tampil(wadah, ctx) {
  const f = {
    q: ctx.query.get("q") || "", status: ctx.query.get("status") || "", kelas: ctx.query.get("kelas") || "",
    akun: ctx.query.get("akun") || "", urut: ctx.query.get("urut") || "nama", hal: Number(ctx.query.get("hal")) || 1,
  };
  if (!URUT[f.urut]) f.urut = "nama";

  const kCari = kolom({ label: "Cari", tipe: "search", nilai: f.q, atribut: { placeholder: "Nama anak, orang tua, atau username", autocomplete: "off" } });
  const kStatus = kolom({ label: "Status bayar", pilihan: [["", "Semua"], ...STATUS_BAYAR.map((x) => [x, x])], nilai: f.status });
  const kKelas = kolom({ label: "Kelas", pilihan: [["", "Semua"], ...[1, 2, 3, 4, 5, 6].map((n) => [String(n), "Kelas " + n])], nilai: f.kelas });
  const kAkun = kolom({ label: "Akun", pilihan: [["", "Semua"], ["aktif", "Aktif"], ["nonaktif", "Nonaktif"]], nilai: f.akun });
  const kUrut = kolom({ label: "Urutkan", pilihan: Object.entries(URUT).map(([k, v]) => [k, v[0]]), nilai: f.urut });
  const jumlah = h("p", { role: "status", style: "font-weight:800;margin:0" });
  const hasil = h("div");
  const tombolCsv = h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => ekspor() }, ikon("unduh", 16), "Ekspor CSV");
  let token = 0;

  function simpanUrl() {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) { if (v && !(k === "urut" && v === "nama") && !(k === "hal" && v === 1)) p.set(k, v); }
    const s = p.toString();
    ctx.gantiHash("#/siswa" + (s ? "?" + s : ""));
  }
  function dasar(kol, opsi) {
    let q = supabase.from("admin_student_overview").select(kol, opsi);
    const t = bersihkanCari(f.q);
    if (t) q = q.or(`child_name.ilike.%${t}%,parent_name.ilike.%${t}%,username.ilike.%${t}%`);
    if (f.status) q = q.eq("payment_status", f.status);
    if (f.kelas) q = q.eq("grade", Number(f.kelas));
    if (f.akun) q = q.eq("is_active", f.akun === "aktif");
    return q;
  }

  async function muat() {
    const n = ++token;
    ganti(hasil, elMemuat());
    try {
      const { data, count } = await ambilCount(URUT[f.urut][1](dasar("*", { count: "exact" })).range((f.hal - 1) * PER, f.hal * PER - 1));
      if (n !== token) return;
      jumlah.textContent = `${angka(count)} siswa ditemukan`;
      if (!count) {
        const adaFilter = f.q || f.status || f.kelas || f.akun;
        ganti(hasil, adaFilter
          ? elKosong("Tidak ada siswa yang cocok.", "Coba ubah kata pencarian atau filter.", "cari")
          : elKosong("Belum ada siswa.", "Tambahkan siswa pertama.", "orang", h("a", { class: "tombol tombol-utama", href: "#/siswa/tambah" }, "Tambah siswa")));
        return;
      }
      if (!data.length && f.hal > 1) { f.hal = 1; simpanUrl(); muat(); return; }
      ganti(hasil, tabel(data), navHalaman({ hal: f.hal, total: count, per: PER, saatPindah: (p) => { f.hal = p; simpanUrl(); muat(); } }));
    } catch (e) { if (n === token) ganti(hasil, elGalat(pesanGalat(e), muat)); }
  }

  function tabel(baris) {
    return h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
      h("thead", {}, h("tr", {}, ["Siswa", "Username", "Kelas", "Pembayaran", "Akun", "Kehadiran", "Sesi terakhir", "Aksi"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, baris.map((s) => h("tr", {},
        sel("Siswa", h("strong", {}, s.child_name), h("span", { class: "sel-kecil" }, s.parent_name || "—")),
        sel("Username", s.username), sel("Kelas", s.grade),
        sel("Pembayaran", badgeBayar(s.payment_status)), sel("Akun", badgeAktif(s.is_active)),
        sel("Kehadiran", s.attendance_total ? `${angka(s.attendance_total)} sesi · ${angka(s.attendance_pct)}%` : "Belum ada sesi"),
        sel("Sesi terakhir", s.last_attendance_date ? tanggalPendek(s.last_attendance_date) : "—"),
        h("td", { "data-label": "" }, h("div", { class: "isi-sel aksi-baris" },
          h("a", { class: "tombol tombol-utama kecil", href: "#/siswa/" + s.id }, "Kelola"),
          h("a", { class: "tombol tombol-garis kecil", href: "#/akun?siswa=" + s.id }, "Reset password"),
          menuTitik("Aksi lainnya untuk " + s.child_name, [["Absensi", `#/siswa/${s.id}?tab=absensi`], ["Parent Guide", `#/siswa/${s.id}?tab=parent-guide`]]))))))));
  }

  async function ekspor() {
    tombolCsv.disabled = true;
    try {
      let semua = [], dari = 0;
      for (;;) {
        const d = await ambil(URUT[f.urut][1](dasar("*")).range(dari, dari + 999));
        semua = semua.concat(d);
        if (d.length < 1000 || semua.length >= 20000) break;
        dari += 1000;
      }
      unduhCsv("siswa-anora.csv", [["Nama anak", "Nama orang tua", "Username", "Kelas", "WhatsApp", "Asal sekolah", "Status bayar", "Akun", "Total sesi", "Hadir", "Kehadiran (%)", "Sesi terakhir", "Dibuat"],
        ...semua.map((s) => [s.child_name, s.parent_name, s.username, s.grade, s.whatsapp, s.school_origin, s.payment_status, s.is_active ? "Aktif" : "Nonaktif", s.attendance_total, s.attendance_hadir, s.attendance_pct, s.last_attendance_date, tanggalDariTs(s.created_at)])]);
      toast(`${semua.length} siswa diekspor`);
    } catch { toast("Gagal mengekspor, coba lagi.", "galat"); }
    finally { tombolCsv.disabled = false; }
  }

  const cariTunda = debounce(() => { f.q = kCari.kontrol.value; f.hal = 1; simpanUrl(); muat(); }, 300);
  kCari.kontrol.addEventListener("input", cariTunda);
  [[kStatus, "status"], [kKelas, "kelas"], [kAkun, "akun"], [kUrut, "urut"]].forEach(([k, nama]) =>
    k.kontrol.addEventListener("change", () => { f[nama] = k.kontrol.value; f.hal = 1; simpanUrl(); muat(); }));

  ganti(wadah, h("div", { class: "halaman" },
    h("div", { class: "kepala-bagian" },
      h("a", { class: "tombol tombol-utama", href: "#/siswa/tambah" }, ikon("tambah", 18), "Tambah siswa"), tombolCsv),
    h("div", { class: "filter" }, kCari.el, kStatus.el, kKelas.el, kAkun.el, kUrut.el),
    jumlah, hasil));
  await muat();
}