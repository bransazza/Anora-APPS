// ANORA admin — materi.js (kelola materi: berkas PDF ATAU tautan media pembelajaran)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { h, ikon, ganti, elMemuat, elGalat, elKosong } from "../ui.js";
import { kolom, dialog, konfirmasi, toast, sel, segmen } from "../widget.js";
import { unggahPdf, hapusBerkas, urlPratinjau } from "../storage.js";
import { bukaPembaca } from "../reader.js";
import { zonaPdf } from "../komponen/zona-pdf.js";
import { pathGambarBab } from "../komponen/soal-api.js";
import { bersihkanTakTerpakai, BUCKET_SOAL, BUCKET_BAHAS } from "../gambar.js";

const adaKonten = (m) => (m.kind === "link" ? !!m.external_url : !!m.pdf_path);
const aman = (u) => /^https?:\/\//i.test(String(u || ""));
const hostDari = (u) => { try { return new URL(u).hostname; } catch { return ""; } };

// Hanya tautan http/https yang diterima (menolak javascript:, ftp:, dan sebagainya)
function periksaUrl(mentah) {
  const t = String(mentah || "").trim();
  if (!t) return { galat: "Tautan wajib diisi." };
  if (t.length > 500) return { galat: "Tautan maksimal 500 karakter." };
  if (/\s/.test(t)) return { galat: "Tautan tidak boleh mengandung spasi." };
  let u;
  try { u = new URL(t); } catch { return { galat: "Tautan tidak valid. Tulis lengkap, diawali https://" }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { galat: "Tautan harus diawali https:// atau http://" };
  return { url: t };
}

export async function tampil(wadah, ctx) {
  ganti(wadah, elMemuat());
  let mapel;
  try { mapel = await ambil(supabase.from("subjects").select("id,name").order("name")); }
  catch (e) { ganti(wadah, elGalat(pesanGalat(e), () => tampil(wadah, ctx))); return; }
  if (!ctx.aktif()) return;
  if (!mapel.length) { ganti(wadah, elKosong("Belum ada mata pelajaran", "Jalankan 05_seed.sql terlebih dulu.", "buku")); return; }

  let kelas = Number(ctx.query.get("kelas"));
  if (!(kelas >= 1 && kelas <= 6)) kelas = 1;
  let mapelId = mapel.some((m) => m.id === ctx.query.get("mapel")) ? ctx.query.get("mapel") : mapel[0].id;
  let daftar = [], token = 0, fokusId = null, dari = null;

  const kKelas = kolom({ label: "Kelas", pilihan: [1, 2, 3, 4, 5, 6].map((n) => [String(n), "Kelas " + n]), nilai: String(kelas) });
  const kMapel = kolom({ label: "Mata pelajaran", pilihan: mapel.map((m) => [m.id, m.name]), nilai: mapelId });
  const hasil = h("div");
  const tombolTambah = h("button", { type: "button", class: "tombol tombol-utama", onclick: () => dialogBab(null) }, ikon("tambah", 18), "Tambah materi");
  const simpanUrl = () => ctx.gantiHash(`#/materi?kelas=${kelas}&mapel=${mapelId}`);

  async function muat() {
    const n = ++token;
    ganti(hasil, elMemuat());
    try {
      const d = await ambil(supabase.from("admin_material_overview").select("*")
        .eq("grade", kelas).eq("subject_id", mapelId).order("position").order("created_at"));
      if (n !== token) return;
      daftar = d;
      gambar();
    } catch (e) { if (n === token) ganti(hasil, elGalat(pesanGalat(e), muat)); }
  }

  function gambar() {
    if (!daftar.length) {
      ganti(hasil, elKosong("Belum ada materi untuk pilihan ini.", "Tambahkan materi pertama: berkas PDF atau tautan media pembelajaran.", "buku",
        h("button", { type: "button", class: "tombol tombol-utama", onclick: () => dialogBab(null) }, "Tambah materi")));
      return;
    }
    const baris = daftar.map((m, i) => {
      const tr = h("tr", { draggable: "true" },
        sel("Urutan", h("div", { class: "urutan" },
          h("span", { class: "pegangan", "aria-hidden": "true" }, ikon("seret", 18)),
          h("span", { class: "no-urut" }, i + 1),
          h("button", { type: "button", class: "ikon-tombol", id: "naik-" + m.id, "aria-label": "Naikkan " + m.title, disabled: i === 0, onclick: () => geser(i, -1, "naik-" + m.id) }, ikon("naik", 18)),
          h("button", { type: "button", class: "ikon-tombol", id: "turun-" + m.id, "aria-label": "Turunkan " + m.title, disabled: i === daftar.length - 1, onclick: () => geser(i, 1, "turun-" + m.id) }, ikon("turun", 18)))),
        sel("Judul", h("strong", {}, m.title)),
        sel("Jenis & konten", m.kind === "link"
          ? [h("span", { class: "badge b-biru" }, "Tautan media"), h("span", { class: "sel-kecil" }, hostDari(m.external_url) || "tautan belum ada")]
          : h("span", { class: "badge " + (m.pdf_path ? "b-biru" : "b-merah") }, ikon("berkas", 16), m.pdf_path ? "PDF ada" : "PDF belum ada")),
        sel("Status", h("span", { class: "badge " + (m.is_published ? "b-hijau" : "b-kuning") }, m.is_published ? "Terbit" : "Draft")),
        sel("Soal latihan", m.question_count),
        h("td", { "data-label": "" }, h("div", { class: "isi-sel aksi-baris" },
          h("a", { class: "tombol tombol-utama kecil", href: "#/materi/soal/" + m.id }, `Soal (${m.question_count})`),
          m.kind === "link"
            ? h("a", { class: "tombol tombol-garis kecil", href: aman(m.external_url) ? m.external_url : null, target: "_blank", rel: "noopener noreferrer", "aria-disabled": aman(m.external_url) ? null : "true" }, "Buka tautan")
            : h("button", { type: "button", class: "tombol tombol-garis kecil", disabled: !m.pdf_path, onclick: () => pratinjau(m) }, "Pratinjau"),
          h("button", { type: "button", class: "tombol " + (m.is_published ? "tombol-garis" : "tombol-emas") + " kecil", onclick: () => ubahTerbit(m) }, m.is_published ? "Sembunyikan" : "Terbitkan"),
          h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => dialogBab(m) }, ikon("edit", 16), "Ubah"),
          h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => hapus(m) }, ikon("sampah", 16), "Hapus"))));
      tr.addEventListener("dragstart", (e) => { dari = i; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", m.id); tr.classList.add("menyeret"); });
      tr.addEventListener("dragend", () => { tr.classList.remove("menyeret"); hasil.querySelectorAll("tr.tujuan").forEach((x) => x.classList.remove("tujuan")); dari = null; });
      tr.addEventListener("dragover", (e) => { if (dari === null) return; e.preventDefault(); tr.classList.add("tujuan"); });
      tr.addEventListener("dragleave", () => tr.classList.remove("tujuan"));
      tr.addEventListener("drop", (e) => {
        e.preventDefault();
        if (dari === null || dari === i) { dari = null; return; }
        const baru = [...daftar];
        const [x] = baru.splice(dari, 1);
        baru.splice(i, 0, x);
        dari = null;
        simpanUrutan(baru);
      });
      return tr;
    });
    ganti(hasil,
      h("p", { class: "bantuan" }, "Ubah urutan dengan tombol panah, atau seret barisnya (di komputer)."),
      h("div", { class: "tabel-bungkus" }, h("table", { class: "tabel" },
        h("thead", {}, h("tr", {}, ["Urutan", "Judul", "Jenis & konten", "Status", "Soal latihan", "Aksi"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", {}, baris))));
    if (fokusId) {
      const a = document.getElementById(fokusId);
      if (a && !a.disabled) a.focus();
      else { const b = document.getElementById(fokusId.replace(/^(naik|turun)/, (x) => (x === "naik" ? "turun" : "naik"))); if (b && !b.disabled) b.focus(); }
      fokusId = null;
    }
  }

  function geser(i, arah, idFokus) {
    const j = i + arah;
    if (j < 0 || j >= daftar.length) return;
    const baru = [...daftar];
    [baru[i], baru[j]] = [baru[j], baru[i]];
    fokusId = idFokus;
    simpanUrutan(baru);
  }
  async function simpanUrutan(baru) {
    const lama = daftar;
    daftar = baru.map((x, i) => ({ ...x, position: i + 1 }));
    gambar();
    try {
      await ambil(supabase.rpc("admin_set_material_order", { p_grade: kelas, p_subject_id: mapelId, p_ids: daftar.map((x) => x.id) }));
      toast("Urutan materi disimpan");
    } catch { daftar = lama; gambar(); toast("Gagal menyimpan urutan, coba lagi.", "galat"); }
  }

  async function ubahTerbit(m) {
    if (!m.is_published && !adaKonten(m)) {
      toast(m.kind === "link" ? "Isi tautan dulu sebelum menerbitkan." : "Unggah PDF dulu sebelum menerbitkan.", "galat");
      return;
    }
    try {
      const r = await ambil(supabase.from("materials").update({ is_published: !m.is_published }).eq("id", m.id).select("id"));
      if (!r.length) throw new Error("kosong");
      m.is_published = !m.is_published;
      gambar();
      toast(m.is_published ? `“${m.title}” diterbitkan` : `“${m.title}” disembunyikan dari siswa`);
    } catch { toast("Gagal mengubah status terbit, coba lagi.", "galat"); }
  }

  function pratinjau(m) {
    const pb = bukaPembaca({
      judul: m.title + " (pratinjau)", labelKembali: "Tutup pratinjau",
      ambilUrl: () => urlPratinjau(m.pdf_path),
      kunciIngatan: null, adaLatihan: false,
      latar: document.getElementById("app"),
      saatKembali: () => pb.tutup(),
    });
    window.addEventListener("hashchange", () => pb.tutup(), { once: true });
  }

  async function hapus(m) {
    const ya = await konfirmasi({
      judul: "Hapus materi?",
      isi: [h("p", {}, `Hapus materi “${m.title}”?`),
        h("p", {}, `${m.question_count} soal latihan dan seluruh riwayat nilai siswa untuk bab ini ikut terhapus${m.pdf_path ? ", begitu juga berkas PDF-nya" : ""}. Tindakan ini tidak bisa dibatalkan.`)],
      ya: "Ya, hapus materi", bahaya: true,
    });
    if (!ya) return;
    let gambarLama = null;
    try { gambarLama = await pathGambarBab(m.id); } catch { /* pembersihan gambar hanya tambahan */ }
    try {
      const r = await ambil(supabase.from("materials").delete().eq("id", m.id).select("id"));
      if (!r.length) throw new Error("kosong");
    } catch { toast("Gagal menghapus materi, coba lagi.", "galat"); return; }
    if (gambarLama) {
      bersihkanTakTerpakai(BUCKET_SOAL, gambarLama.soal).catch(() => {});
      bersihkanTakTerpakai(BUCKET_BAHAS, gambarLama.bahas).catch(() => {});
    }
    if (m.pdf_path) {
      try { await hapusBerkas(m.pdf_path); }
      catch { toast("Materi dihapus, tetapi berkas PDF-nya gagal dihapus dari penyimpanan.", "info"); }
    }
    toast(`Materi “${m.title}” dihapus`);
    await muat();
  }

  // Tambah (m = null) atau ubah materi
  function dialogBab(m) {
    let jenis = m ? m.kind : "pdf", kotor = false, sibuk = false;
    const judul = kolom({ label: "Judul materi", atribut: { maxlength: 120, autocomplete: "off" }, nilai: m ? m.title : "" });
    judul.kontrol.addEventListener("input", () => { kotor = true; });
    const seg = segmen({
      label: "Jenis materi", nilai: jenis,
      pilihan: [["pdf", "Berkas PDF"], ["link", "Media pembelajaran (tautan)"]],
      saatUbah: (v) => { jenis = v; seg.set(v); kotor = true; atur(); },
    });
    const zona = zonaPdf({ adaFile: !!(m && m.kind === "pdf" && m.pdf_path), saatUbah: () => { kotor = true; } });
    const kUrl = kolom({
      label: "Tautan media pembelajaran", tipe: "url",
      atribut: { maxlength: 500, inputmode: "url", autocomplete: "off", autocapitalize: "none", spellcheck: "false", placeholder: "https://..." },
      nilai: m && m.kind === "link" ? m.external_url || "" : "",
      bantuan: "Tempel alamat lengkap yang diawali https://. Contoh: video YouTube, Wordwall, Quizizz, Canva, atau Google Drive (pastikan tautannya bisa dibuka siapa saja yang memilikinya).",
    });
    kUrl.kontrol.addEventListener("input", () => { kotor = true; });
    const peringatanGanti = h("p", { class: "kotak-peringatan", role: "status" });
    const progres = h("progress", { max: 100, value: 0, "aria-label": "Kemajuan unggah" });
    progres.hidden = true;
    const info = h("p", { class: "bantuan", role: "status" });
    const simpan = h("button", { type: "button", class: "tombol tombol-utama" }, m ? "Simpan" : "Tambah materi");
    const batal = h("button", { type: "button", class: "tombol tombol-garis", onclick: () => d.minta() }, "Batal");

    function atur() {
      zona.el.hidden = jenis !== "pdf";
      kUrl.el.hidden = jenis !== "link";
      const pdfLama = !!(m && m.kind === "pdf" && m.pdf_path);
      const linkLama = !!(m && m.kind === "link");
      const tampilPeringatan = (jenis === "link" && pdfLama) || (jenis === "pdf" && linkLama);
      peringatanGanti.hidden = !tampilPeringatan;
      peringatanGanti.textContent = jenis === "link"
        ? "PDF yang sekarang terpasang akan dihapus saat disimpan."
        : "Tautan media yang sekarang akan dihapus. Unggah PDF baru agar materi tetap bisa diterbitkan.";
    }

    const d = dialog({
      judul: m ? "Ubah materi" : "Tambah materi", lebar: true,
      isi: [judul.el,
        h("div", { class: "kolom" }, h("p", { class: "label-kecil" }, "Jenis materi"), seg.el),
        zona.el, kUrl.el, peringatanGanti, progres, info,
        h("div", { class: "dlg-aksi" }, batal, simpan)],
      tanyaTutup: async () => {
        if (sibuk) return false;
        return !kotor || konfirmasi({ judul: "Tutup tanpa menyimpan?", isi: "Perubahan yang belum disimpan akan hilang.", ya: "Tutup", bahaya: true });
      },
    });
    atur();

    simpan.addEventListener("click", async () => {
      const t = judul.kontrol.value.trim().replace(/\s+/g, " ");
      if (t.length < 3 || t.length > 120) { judul.setGalat("Judul materi 3–120 karakter."); judul.kontrol.focus(); return; }
      judul.setGalat("");
      let url = null;
      if (jenis === "link") {
        const r = periksaUrl(kUrl.kontrol.value);
        if (r.galat) { kUrl.setGalat(r.galat); kUrl.kontrol.focus(); return; }
        kUrl.setGalat("");
        url = r.url;
      }
      const file = jenis === "pdf" ? zona.ambil() : null;
      const pdfLama = m && m.kind === "pdf" ? m.pdf_path : null;
      sibuk = true; simpan.disabled = true; batal.disabled = true;
      let pathBaru = null;
      try {
        if (file) {
          progres.hidden = false; progres.value = 0; info.textContent = "Mengunggah PDF…";
          pathBaru = await unggahPdf(file, (p) => { progres.value = Math.round(p * 100); info.textContent = `Mengunggah PDF… ${Math.round(p * 100)}%`; });
        }
        info.textContent = "Menyimpan…";
        let catatan = "";
        if (m) {
          const patch = { title: t, kind: jenis };
          if (jenis === "link") { patch.external_url = url; patch.pdf_path = null; }
          else { patch.external_url = null; if (pathBaru) patch.pdf_path = pathBaru; }
          const kontenAkhir = jenis === "link" ? true : !!(pathBaru || pdfLama);
          if (!kontenAkhir && m.is_published) { patch.is_published = false; catatan = " Materi disembunyikan karena belum punya PDF."; }
          const r = await ambil(supabase.from("materials").update(patch).eq("id", m.id).select("id"));
          if (!r.length) throw new Error("kosong");
          if (pdfLama && (pathBaru || jenis === "link")) hapusBerkas(pdfLama).catch(() => {}); // bersihkan berkas lama
        } else {
          const pos = daftar.reduce((a, x) => Math.max(a, x.position), 0) + 1;
          await ambil(supabase.from("materials").insert({
            grade: kelas, subject_id: mapelId, title: t, position: pos, kind: jenis,
            external_url: url, pdf_path: pathBaru, is_published: false,
          }));
        }
        kotor = false; sibuk = false;
        d.tutup();
        toast((m ? "Materi diperbarui." : "Materi ditambahkan (status Draft).") + catatan);
        await muat();
      } catch (e) {
        if (pathBaru) hapusBerkas(pathBaru).catch(() => {});
        sibuk = false; simpan.disabled = false; batal.disabled = false; progres.hidden = true; info.textContent = "";
        toast((e && e.pesan) || "Gagal menyimpan, coba lagi.", "galat");
      }
    });
  }

  kKelas.kontrol.addEventListener("change", () => { kelas = Number(kKelas.kontrol.value); simpanUrl(); muat(); });
  kMapel.kontrol.addEventListener("change", () => { mapelId = kMapel.kontrol.value; simpanUrl(); muat(); });
  ganti(wadah, h("div", { class: "halaman" },
    h("div", { class: "filter" }, kKelas.el, kMapel.el, h("div", { class: "kolom" }, tombolTambah)),
    hasil));
  await muat();
}