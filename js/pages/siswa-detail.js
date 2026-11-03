// ANORA admin — siswa-detail.js (kepala siswa + tab Ringkasan, Absensi, Parent Guide, Akun & Password)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { panggilFungsi, pesanFungsi, UUID } from "../api.js";
import { h, ikon, ganti, elMemuat, elGalat, elKosong, badgeBayar, badgeAktif, tanggalPendek, tanggalDariTs, angka } from "../ui.js";
import { kolom, segmen, saklar, tabs, konfirmasi, dialog, toast, setKotor, status } from "../widget.js";
import { validasiDataSiswa, salin, linkWA, STATUS_BAYAR } from "../util.js";
import { tampilAbsensiSiswa } from "../komponen/absensi-siswa.js";
import { tampilGuideSiswa } from "../komponen/guide-siswa.js";
import { tampilReset } from "../komponen/akun-reset.js";
import { tampilNilaiSiswa } from "../komponen/nilai-siswa.js";

const TAB = [["ringkasan", "Ringkasan"], ["absensi", "Absensi"], ["parent-guide", "Parent Guide"], ["nilai", "Nilai"], ["akun", "Akun & Password"]];

export async function tampil(wadah, ctx) {
  ganti(wadah, elMemuat());
  const id = ctx.params.id;
  let s = null;
  if (UUID.test(id)) {
    try { s = await ambil(supabase.from("admin_student_overview").select("*").eq("id", id).maybeSingle()); }
    catch (e) { if (ctx.aktif()) ganti(wadah, elGalat(pesanGalat(e), () => tampil(wadah, ctx))); return; }
  }
  if (!ctx.aktif()) return;
  if (!s) {
    ganti(wadah, elKosong("Siswa tidak ditemukan", "Siswa mungkin sudah dihapus.", "orang", h("a", { class: "tombol tombol-utama", href: "#/siswa" }, "Kembali ke daftar")));
    return;
  }
  ctx.setJudul(s.child_name);

  const kepala = h("section", { class: "kartu", "aria-label": "Data siswa" });
  const panel = h("div", { role: "tabpanel" });
  let tabAktif = TAB.some(([t]) => t === ctx.query.get("tab")) ? ctx.query.get("tab") : "ringkasan";
  const aksi = { perbarui: gambarKepala };

  function gambarKepala() {
    ctx.setJudul(s.child_name);
    ganti(kepala,
      h("div", { class: "kepala-bagian" },
        h("div", {}, h("h2", { class: "rapat" }, s.child_name), h("p", { class: "lembut rapat" }, `Kelas ${s.grade}`)),
        h("div", { class: "aksi-baris" }, badgeBayar(s.payment_status), badgeAktif(s.is_active))),
      h("div", { class: "aksi-baris", style: "margin-top:.75rem" },
        h("span", {}, "Username: ", h("strong", {}, s.username)),
        h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: async () => toast((await salin(s.username)) ? "Username disalin" : "Gagal menyalin") }, ikon("salin", 16), "Salin")),
      h("div", { class: "aksi-baris", style: "margin-top:.5rem" },
        h("span", {}, "WhatsApp: ", h("strong", {}, s.whatsapp || "—")),
        s.whatsapp ? [
          h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: async () => toast((await salin(s.whatsapp)) ? "Nomor disalin" : "Gagal menyalin") }, ikon("salin", 16), "Salin"),
          h("a", { class: "tombol tombol-garis kecil", href: linkWA(s.whatsapp, ""), target: "_blank", rel: "noopener noreferrer" }, ikon("wa", 16), "Buka WhatsApp"),
        ] : null));
  }

  async function pilihTab(nama, dariKlik = true) {
    if (dariKlik && nama === tabAktif) return;
    if (status.kotor && !(await konfirmasi({ judul: "Perubahan belum disimpan", isi: "Perubahan yang belum disimpan akan hilang jika Anda pindah tab.", ya: "Pindah tab", bahaya: true }))) return;
    setKotor(false);
    tabAktif = nama; t.set(nama);
    ctx.gantiHash(`#/siswa/${s.id}?tab=${nama}`);
    panel.setAttribute("aria-labelledby", "tab-" + nama);
    ganti(panel, elMemuat());
    if (nama === "ringkasan") tabRingkasan(panel, s, aksi, ctx);
    else if (nama === "absensi") await tampilAbsensiSiswa(panel, s);
    else if (nama === "parent-guide") await tampilGuideSiswa(panel, s);
    else if (nama === "nilai") await tampilNilaiSiswa(panel, s);
    else await tampilReset(panel, { siswaTetap: s, aktif: ctx.aktif });
  }

  const t = tabs({ label: "Bagian detail siswa", daftar: TAB, awal: tabAktif, saatPilih: (n) => pilihTab(n) });
  ganti(wadah, h("div", { class: "halaman" }, h("a", { href: "#/siswa" }, "← Kembali ke daftar siswa"), kepala, t.el, panel));
  gambarKepala();
  await pilihTab(tabAktif, false);
}

// ---------- Tab Ringkasan ----------
function tabRingkasan(w, s, aksi, ctx) {
  const stat = (label, nilai) => h("div", { class: "kartu-stat" }, h("span", { class: "stat-nilai" }, nilai), h("span", { class: "stat-label" }, label));

  // Status pembayaran
  const seg = segmen({ label: "Status pembayaran", pilihan: STATUS_BAYAR.map((x) => [x, x]), nilai: s.payment_status, saatUbah: ubahBayar });
  async function ubahBayar(baru) {
    if (baru === s.payment_status) return;
    const isi = baru === "Lunas"
      ? `Ubah status ${s.child_name} menjadi Lunas? Siswa langsung bisa membuka Materi, Latihan Soal, Try Out, dan Nilai.`
      : `Ubah status ${s.child_name} menjadi ${baru}? Materi, Latihan Soal, Try Out, dan Nilai akan terkunci. Absensi dan Parent Guide tetap terbuka.`;
    if (!(await konfirmasi({ judul: "Ubah status pembayaran", isi, ya: "Ya, ubah" }))) return;
    try {
      const r = await ambil(supabase.from("students").update({ payment_status: baru }).eq("id", s.id).select("id"));
      if (!r.length) throw new Error("kosong");
      s.payment_status = baru; seg.set(baru); aksi.perbarui();
      toast(`Status ${s.child_name} diubah menjadi ${baru}`);
    } catch { seg.set(s.payment_status); toast("Gagal mengubah status, coba lagi.", "galat"); }
  }

  // Akun aktif / nonaktif
  const sw = saklar({ label: "Akun aktif", aktif: s.is_active, saatKlik: ubahAktif });
  async function ubahAktif() {
    const baru = !s.is_active;
    const ya = await konfirmasi({
      judul: baru ? "Aktifkan akun?" : "Nonaktifkan akun?",
      isi: baru ? `Aktifkan kembali akun ${s.child_name}? Siswa bisa masuk lagi.` : `Nonaktifkan akun ${s.child_name}? Akun nonaktif tidak bisa masuk. Data tetap tersimpan.`,
      ya: baru ? "Ya, aktifkan" : "Ya, nonaktifkan", bahaya: !baru,
    });
    if (!ya) return;
    try {
      await panggilFungsi("admin-set-active", { student_id: s.id, is_active: baru });
      s.is_active = baru; sw.set(baru); aksi.perbarui();
      toast(baru ? `Akun ${s.child_name} diaktifkan` : `Akun ${s.child_name} dinonaktifkan`);
    } catch (e) { sw.set(s.is_active); toast(pesanFungsi(e, { NOT_FOUND: "Siswa tidak ditemukan." }, "Gagal mengubah status akun, coba lagi."), "galat"); }
  }

  // Ubah data
  const k = {
    child_name: kolom({ label: "Nama anak", atribut: { maxlength: 60 }, nilai: s.child_name }),
    parent_name: kolom({ label: "Nama orang tua", atribut: { maxlength: 60 }, nilai: s.parent_name || "" }),
    whatsapp: kolom({ label: "WhatsApp orang tua", tipe: "tel", atribut: { inputmode: "tel", maxlength: 20 }, nilai: s.whatsapp || "" }),
    school_origin: kolom({ label: "Asal sekolah", atribut: { maxlength: 100 }, nilai: s.school_origin || "" }),
    grade: kolom({ label: "Kelas", pilihan: [1, 2, 3, 4, 5, 6].map((n) => [String(n), "Kelas " + n]), nilai: String(s.grade) }),
  };
  const kUser = kolom({ label: "Username", atribut: { readonly: true }, nilai: s.username, bantuan: "Username tidak bisa diubah karena dipakai untuk masuk dan tercatat di data lain." });
  const tombolSimpan = h("button", { type: "submit", class: "tombol tombol-utama", disabled: true }, "Simpan perubahan");
  const baca = () => ({ child_name: k.child_name.kontrol.value, parent_name: k.parent_name.kontrol.value, whatsapp: k.whatsapp.kontrol.value, school_origin: k.school_origin.kontrol.value, grade: k.grade.kontrol.value });
  let dasar = baca();
  const berubah = () => { const b = baca(); return Object.keys(b).some((n) => b[n].trim() !== dasar[n].trim()); };
  const segarkan = () => { const x = berubah(); tombolSimpan.disabled = !x; setKotor(x); };
  const form = h("form", { novalidate: true, autocomplete: "off" },
    h("div", { class: "grid-form dua" }, k.child_name.el, k.parent_name.el, k.whatsapp.el, k.school_origin.el, k.grade.el, kUser.el), tombolSimpan);
  form.addEventListener("input", segarkan);
  form.addEventListener("change", segarkan);
  let sibuk = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sibuk || !berubah()) return;
    const { galat, nilai } = validasiDataSiswa(baca());
    Object.entries(k).forEach(([n, x]) => x.setGalat(galat[n]));
    const pertama = Object.keys(k).find((n) => galat[n]);
    if (pertama) { k[pertama].kontrol.focus(); return; }
    sibuk = true; tombolSimpan.disabled = true;
    try {
      const r = await ambil(supabase.from("students").update(nilai).eq("id", s.id).select("id"));
      if (!r.length) throw new Error("kosong");
      Object.assign(s, nilai);
      k.whatsapp.kontrol.value = nilai.whatsapp;
      dasar = baca(); aksi.perbarui(); setKotor(false);
      toast("Data siswa disimpan");
    } catch { toast("Gagal menyimpan, coba lagi.", "galat"); segarkan(); }
    finally { sibuk = false; tombolSimpan.disabled = !berubah(); }
  });

  // Hapus siswa (dua langkah: tombol, lalu ketik username)
  function dialogHapus() {
    const kk = kolom({ label: `Ketik username “${s.username}” untuk melanjutkan`, atribut: { autocomplete: "off", autocapitalize: "none", spellcheck: "false" } });
    const bHapus = h("button", { type: "button", class: "tombol tombol-bahaya", disabled: true }, "Hapus permanen");
    const cocok = () => kk.kontrol.value.trim() === s.username;
    kk.kontrol.addEventListener("input", () => { bHapus.disabled = !cocok(); });
    const d = dialog({
      judul: "Hapus siswa",
      isi: [h("p", {}, `Menghapus ${s.child_name} akan menghapus akunnya beserta seluruh absensi, parent guide, dan nilai secara permanen. Tindakan ini tidak bisa dibatalkan.`),
        kk.el, h("div", { class: "dlg-aksi" }, h("button", { type: "button", class: "tombol tombol-garis", onclick: () => d.tutup() }, "Batal"), bHapus)],
    });
    bHapus.addEventListener("click", async () => {
      bHapus.disabled = true;
      try {
        await panggilFungsi("admin-delete-student", { student_id: s.id });
        setKotor(false); d.tutup();
        toast(`Siswa ${s.child_name} dihapus`);
        ctx.pindah("#/siswa");
      } catch (e) {
        toast(pesanFungsi(e, { NOT_FOUND: "Siswa tidak ditemukan." }, "Gagal menghapus siswa, coba lagi."), "galat");
        bHapus.disabled = !cocok();
      }
    });
  }

  ganti(w, h("div", { class: "halaman" },
    h("div", { class: "stat-grid" },
      stat("Terdaftar sejak", tanggalDariTs(s.created_at)),
      stat("Total sesi", angka(s.attendance_total)),
      stat("Kehadiran", s.attendance_total ? angka(s.attendance_pct) + "%" : "—"),
      stat("Sesi terakhir", s.last_attendance_date ? tanggalPendek(s.last_attendance_date) : "—")),
    h("section", { class: "kartu", "aria-labelledby": "jdl-bayar" },
      h("h2", { id: "jdl-bayar" }, "Status pembayaran"),
      h("p", { class: "lembut" }, "Hanya status Lunas yang membuka Materi, Latihan Soal, Try Out, dan Nilai."), seg.el),
    h("section", { class: "kartu", "aria-labelledby": "jdl-data2" }, h("h2", { id: "jdl-data2" }, "Ubah data"), form),
    h("section", { class: "kartu", "aria-labelledby": "jdl-aktif" },
      h("div", { class: "baris-pengaturan" },
        h("div", {}, h("h2", { id: "jdl-aktif", class: "rapat" }, "Akun aktif"), h("p", { class: "lembut rapat" }, "Akun nonaktif tidak bisa masuk. Data tetap tersimpan.")), sw.el)),
    h("section", { class: "kartu zona-bahaya", "aria-labelledby": "jdl-bahaya" },
      h("h2", { id: "jdl-bahaya" }, "Zona bahaya"),
      h("p", {}, "Hapus siswa beserta seluruh absensi, parent guide, dan nilai secara permanen."),
      h("button", { type: "button", class: "tombol tombol-bahaya", onclick: dialogHapus }, ikon("sampah", 18), "Hapus siswa…"))));
}