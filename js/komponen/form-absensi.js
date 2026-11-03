// ANORA admin — form-absensi.js (form satu sesi absensi + dialog ubah/hapus)
import { supabase, ambil } from "../supabase.js";
import { h, hariIniJakarta, tambahHari, namaHari, tanggalPendek, tanggalPanjang } from "../ui.js";
import { kolom, dialog, konfirmasi, toast } from "../widget.js";
import { HARI, STATUS_ABSEN, validasiAbsensi } from "../util.js";

export function formAbsensi(awal = {}) {
  const tglAwal = awal.date || hariIniJakarta();
  const t = kolom({ label: "Tanggal", tipe: "date", nilai: tglAwal });
  const hr = kolom({ label: "Hari", pilihan: HARI.map((x) => [x, x]), nilai: awal.day || namaHari(tglAwal) });
  const st = kolom({ label: "Status", pilihan: STATUS_ABSEN.map((x) => [x, x]), nilai: awal.status || "Hadir" });
  const tp = kolom({ label: "Materi / topik", atribut: { maxlength: 150, autocomplete: "off" }, nilai: awal.topic || "" });
  const ct = kolom({ label: "Catatan", jenis: "textarea", atribut: { rows: 3, maxlength: 500 }, nilai: awal.notes || "", bantuan: "Opsional, maksimal 500 karakter." });
  const peringatan = h("p", { class: "peringatan-kolom", role: "status" });
  peringatan.hidden = true;

  function cek() {
    const tg = t.kontrol.value, msg = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(tg)) {
      if (namaHari(tg) !== hr.kontrol.value) msg.push(`${tanggalPendek(tg)} jatuh pada hari ${namaHari(tg)}.`);
      if (tg > tambahHari(hariIniJakarta(), 1)) msg.push("Tanggal ini lebih dari 1 hari ke depan. Pastikan sudah benar.");
    }
    peringatan.textContent = msg.join(" ");
    peringatan.hidden = !msg.length;
  }
  t.kontrol.addEventListener("change", () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(t.kontrol.value)) hr.kontrol.value = namaHari(t.kontrol.value);
    cek();
  });
  hr.kontrol.addEventListener("change", cek);
  cek();

  const el = h("div", { class: "grid-form dua" }, t.el, hr.el, h("div", { style: "grid-column:1/-1" }, peringatan), st.el, tp.el, h("div", { style: "grid-column:1/-1" }, ct.el));
  return {
    el,
    ambil() {
      const { galat, nilai } = validasiAbsensi({ date: t.kontrol.value, day: hr.kontrol.value, status: st.kontrol.value, topic: tp.kontrol.value, notes: ct.kontrol.value });
      t.setGalat(galat.date); hr.setGalat(galat.day); st.setGalat(galat.status); tp.setGalat(galat.topic); ct.setGalat(galat.notes);
      const pertama = [[galat.date, t], [galat.day, hr], [galat.status, st], [galat.topic, tp], [galat.notes, ct]].find(([g]) => g);
      if (pertama) pertama[1].kontrol.focus();
      return { galat: !!pertama, nilai: { ...nilai, notes: nilai.notes || null } };
    },
    kosongkan() { tp.kontrol.value = ""; ct.kontrol.value = ""; st.kontrol.value = "Hadir"; },
    ubahDi(fn) { el.addEventListener("input", fn); el.addEventListener("change", fn); },
  };
}

export function ubahAbsensi(rec, saat) {
  const f = formAbsensi(rec);
  let kotor = false;
  f.ubahDi(() => { kotor = true; });
  const simpan = h("button", { type: "button", class: "tombol tombol-utama" }, "Simpan");
  const batal = h("button", { type: "button", class: "tombol tombol-garis", onclick: () => d.minta() }, "Batal");
  const d = dialog({
    judul: "Ubah absensi", lebar: true,
    isi: [f.el, h("div", { class: "dlg-aksi" }, batal, simpan)],
    tanyaTutup: async () => !kotor || konfirmasi({ judul: "Tutup tanpa menyimpan?", isi: "Perubahan yang belum disimpan akan hilang.", ya: "Tutup", bahaya: true }),
  });
  simpan.addEventListener("click", async () => {
    const { galat, nilai } = f.ambil();
    if (galat) return;
    simpan.disabled = true;
    try {
      const r = await ambil(supabase.from("attendance").update(nilai).eq("id", rec.id).select("id"));
      if (!r.length) throw new Error("kosong");
      kotor = false; d.tutup(); toast("Absensi diperbarui"); saat();
    } catch { simpan.disabled = false; toast("Gagal menyimpan, coba lagi.", "galat"); }
  });
}

export async function hapusAbsensi(rec, namaSiswa, saat) {
  const ya = await konfirmasi({
    judul: "Hapus absensi?",
    isi: `Hapus absensi ${namaSiswa} pada ${tanggalPanjang(rec.date)} (${rec.status})? Tindakan ini tidak bisa dibatalkan.`,
    ya: "Ya, hapus", bahaya: true,
  });
  if (!ya) return;
  try {
    const r = await ambil(supabase.from("attendance").delete().eq("id", rec.id).select("id"));
    if (!r.length) throw new Error("kosong");
    toast("Absensi dihapus"); saat();
  } catch { toast("Gagal menghapus, coba lagi.", "galat"); }
}