// ANORA admin — tryout.js (kelola try out kelas 6)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { h, ikon, ganti, elMemuat, elGalat, elKosong } from "../ui.js";
import { kolom, dialog, konfirmasi, toast, sel } from "../widget.js";
import { pathGambarBab } from "../komponen/soal-api.js";
import { bersihkanTakTerpakai, BUCKET_SOAL, BUCKET_BAHAS } from "../gambar.js";

export async function tampil(wadah, ctx) {
  ganti(wadah, elMemuat());
  let mapel;
  try { mapel = await ambil(supabase.from("subjects").select("id,name").order("name")); }
  catch (e) { ganti(wadah, elGalat(pesanGalat(e), () => tampil(wadah, ctx))); return; }
  if (!ctx.aktif()) return;
  const nama = new Map(mapel.map((m) => [m.id, m.name]));
  let daftar = [];
  const hasil = h("div");

  async function muat() {
    ganti(hasil, elMemuat());
    try { daftar = await ambil(supabase.from("admin_tryout_overview").select("*").order("created_at", { ascending: false })); gambar(); }
    catch (e) { ganti(hasil, elGalat(pesanGalat(e), muat)); }
  }
  function gambar() {
    if (!daftar.length) {
      ganti(hasil, elKosong("Belum ada try out.", "Buat try out pertama untuk kelas 6.", "jam",
        h("button", { type: "button", class: "tombol tombol-utama", onclick: () => dialogTryout(null) }, "Buat try out")));
      return;
    }
    ganti(hasil, h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
      h("thead", {}, h("tr", {}, ["Judul", "Mapel", "Durasi", "Acak soal", "Status", "Soal", "Percobaan", "Aksi"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, daftar.map((t) => h("tr", {},
        sel("Judul", h("strong", {}, t.title), h("span", { class: "sel-kecil" }, "Kelas 6")),
        sel("Mapel", nama.get(t.subject_id) || "—"),
        sel("Durasi", `${t.duration_minutes} menit`),
        sel("Acak soal", t.shuffle_questions ? "Ya" : "Tidak"),
        sel("Status", h("span", { class: "badge " + (t.is_published ? "b-hijau" : "b-kuning") }, t.is_published ? "Terbit" : "Draft")),
        sel("Soal", t.question_count),
        sel("Percobaan", `${t.attempt_count} selesai` + (t.running_count ? ` · ${t.running_count} berjalan` : "")),
        h("td", { "data-label": "" }, h("div", { class: "isi-sel aksi-baris" },
          h("a", { class: "tombol tombol-utama kecil", href: "#/tryout/soal/" + t.id }, `Soal (${t.question_count})`),
          h("a", { class: "tombol tombol-garis kecil", href: "#/tryout/hasil/" + t.id }, "Hasil"),
          h("button", { type: "button", class: "tombol " + (t.is_published ? "tombol-garis" : "tombol-emas") + " kecil", onclick: () => ubahTerbit(t) }, t.is_published ? "Sembunyikan" : "Terbitkan"),
          h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => dialogTryout(t) }, ikon("edit", 16), "Ubah"),
          h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => hapus(t) }, ikon("sampah", 16), "Hapus")))))))));
  }

  async function ubahTerbit(t) {
    if (!t.is_published && t.question_count < 1) { toast("Tambahkan soal dulu sebelum menerbitkan try out.", "galat"); return; }
    try {
      const r = await ambil(supabase.from("tryouts").update({ is_published: !t.is_published }).eq("id", t.id).select("id"));
      if (!r.length) throw new Error("kosong");
      t.is_published = !t.is_published; gambar();
      toast(t.is_published ? `“${t.title}” diterbitkan` : `“${t.title}” disembunyikan dari siswa`);
    } catch { toast("Gagal mengubah status, coba lagi.", "galat"); }
  }

  async function hapus(t) {
    const ya = await konfirmasi({
      judul: "Hapus try out?",
      isi: [h("p", {}, `Hapus try out “${t.title}”?`),
        h("p", {}, `${t.question_count} soal dan ${t.attempt_count + t.running_count} percobaan siswa (beserta nilainya) ikut terhapus. Tindakan ini tidak bisa dibatalkan.`)],
      ya: "Ya, hapus try out", bahaya: true });
    if (!ya) return;
    let gambarLama = null;
    try { gambarLama = await pathGambarBab({ id: t.id, jenis: "tryout" }); } catch { /* tambahan */ }
    try {
      const r = await ambil(supabase.from("tryouts").delete().eq("id", t.id).select("id"));
      if (!r.length) throw new Error("kosong");
    } catch { toast("Gagal menghapus try out, coba lagi.", "galat"); return; }
    if (gambarLama) {
      bersihkanTakTerpakai(BUCKET_SOAL, gambarLama.soal).catch(() => {});
      bersihkanTakTerpakai(BUCKET_BAHAS, gambarLama.bahas).catch(() => {});
    }
    toast("Try out dihapus");
    await muat();
  }

  function dialogTryout(t) {
    const judul = kolom({ label: "Judul try out", atribut: { maxlength: 120, autocomplete: "off" }, nilai: t ? t.title : "" });
    const mp = kolom({ label: "Mata pelajaran", pilihan: mapel.map((m) => [m.id, m.name]), nilai: t ? t.subject_id : mapel[0].id });
    const dur = kolom({ label: "Durasi (menit)", tipe: "number", atribut: { min: 1, max: 300, step: 1, inputmode: "numeric" }, nilai: t ? String(t.duration_minutes) : "60",
      bantuan: "1 sampai 300 menit. Perubahan durasi tidak memengaruhi percobaan yang sedang berjalan." });
    const acak = h("input", { type: "checkbox", id: "in-acak" });
    acak.checked = t ? t.shuffle_questions : false;
    const simpan = h("button", { type: "button", class: "tombol tombol-utama" }, t ? "Simpan" : "Buat try out");
    let kotor = false, sibuk = false;
    const d = dialog({
      judul: t ? "Ubah try out" : "Buat try out", lebar: true,
      isi: [h("p", { class: "lembut" }, "Try out khusus kelas 6. Try out baru berstatus Draft; terbitkan setelah soal ditambahkan."),
        judul.el, mp.el, dur.el,
        h("div", { class: "kolom" }, h("label", { class: "radio-kunci", for: "in-acak" }, acak, "Acak urutan soal untuk setiap percobaan")),
        h("div", { class: "dlg-aksi" }, h("button", { type: "button", class: "tombol tombol-garis", onclick: () => d.minta() }, "Batal"), simpan)],
      tanyaTutup: async () => { if (sibuk) return false; return !kotor || konfirmasi({ judul: "Tutup tanpa menyimpan?", isi: "Perubahan akan hilang.", ya: "Tutup", bahaya: true }); },
    });
    d.el.addEventListener("input", () => { kotor = true; });
    simpan.addEventListener("click", async () => {
      const ttl = judul.kontrol.value.trim().replace(/\s+/g, " ");
      const menit = Number(dur.kontrol.value);
      judul.setGalat(ttl.length < 3 || ttl.length > 120 ? "Judul 3–120 karakter." : "");
      dur.setGalat(!Number.isInteger(menit) || menit < 1 || menit > 300 ? "Durasi harus bilangan bulat 1–300 menit." : "");
      if (ttl.length < 3 || ttl.length > 120) { judul.kontrol.focus(); return; }
      if (!Number.isInteger(menit) || menit < 1 || menit > 300) { dur.kontrol.focus(); return; }
      sibuk = true; simpan.disabled = true;
      const nilai = { title: ttl, subject_id: mp.kontrol.value, duration_minutes: menit, shuffle_questions: acak.checked };
      try {
        if (t) {
          const r = await ambil(supabase.from("tryouts").update(nilai).eq("id", t.id).select("id"));
          if (!r.length) throw new Error("kosong");
        } else await ambil(supabase.from("tryouts").insert({ ...nilai, grade: 6, is_published: false }));
        kotor = false; sibuk = false; d.tutup();
        toast(t ? "Try out diperbarui" : "Try out dibuat (status Draft)");
        await muat();
      } catch { sibuk = false; simpan.disabled = false; toast("Gagal menyimpan, coba lagi.", "galat"); }
    });
  }

  ganti(wadah, h("div", { class: "halaman" },
    h("div", { class: "kepala-bagian" }, h("p", { class: "lembut rapat" }, "Try out TKA khusus kelas 6, boleh dikerjakan berulang."),
      h("button", { type: "button", class: "tombol tombol-utama", onclick: () => dialogTryout(null) }, ikon("tambah", 18), "Buat try out")),
    hasil));
  await muat();
}