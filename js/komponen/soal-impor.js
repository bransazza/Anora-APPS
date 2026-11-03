// ANORA admin — soal-impor.js (input cepat: tempel teks atau impor Excel/CSV, dengan pratinjau dan perbaikan di tempat)
import { h, ikon } from "../ui.js";
import { dialog, konfirmasi, toast, segmen } from "../widget.js";
import { renderTeksRumus } from "../rumus.js";
import { debounce } from "../util.js";
import { parseTeks, parseBarisSheet, validasiSoal, keItemRpc, HURUF } from "./soal-parse.js";
import { simpanSoal, pathGambarBab, pesanRpc } from "./soal-api.js";
import { kecilkanGambar, unggahGambar, hapusGambar, bersihkanTakTerpakai, periksaGambar, BUCKET_SOAL, BUCKET_BAHAS } from "../gambar.js";

const CONTOH = "Hasil dari 12 x 5 adalah ...\nA. 50\nB. 60\nC. 70\nD. 80\nJAWABAN: B\nPEMBAHASAN: 12 x 5 = 60.\nGAMBAR: soal5.png\n\nLuas persegi dengan sisi $4$ cm adalah ...\nA. 8 cm\nB. 12 cm\nC. 16 cm\nD. 20 cm\nJAWABAN: C\nPEMBAHASAN: Luas = $4 \\times 4 = 16$ cm persegi.";

let janjiX = null;
function muatSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!janjiX) {
    janjiX = new Promise((ok, gagal) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () => (window.XLSX ? ok(window.XLSX) : gagal(new Error("Pustaka Excel gagal dimuat.")));
      s.onerror = () => { janjiX = null; gagal(new Error("Pustaka Excel gagal dimuat. Periksa koneksi internet.")); };
      document.head.append(s);
    });
  }
  return janjiX;
}
async function unduhTemplat() {
  const X = await muatSheetJs();
  const aoa = [
    ["no", "soal", "A", "B", "C", "D", "E", "kunci", "pembahasan", "gambar_soal", "gambar_pembahasan"],
    [1, "Hasil dari 12 x 5 adalah ...", "50", "60", "70", "80", "", "B", "12 x 5 = 60.", "", ""],
    [2, "Luas persegi dengan sisi $4$ cm adalah ...", "8", "12", "16", "20", "", "C", "Luas = $4 \\times 4 = 16$.", "", ""],
  ];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), "Soal");
  X.writeFile(wb, "templat-soal-anora.xlsx");
}
async function bacaSheet(file) {
  if (!file) throw new Error("Pilih berkas Excel atau CSV dulu.");
  const X = await muatSheetJs();
  const wb = /\.csv$/i.test(file.name) ? X.read(await file.text(), { type: "string" }) : X.read(await file.arrayBuffer(), { type: "array" });
  return parseBarisSheet(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false }));
}

export function bukaImpor({ jenis, materialId, jumlahAda, saat }) {
  const berkas = new Map(); // nama huruf kecil -> File
  let items = [], kartuAda = [], sibuk = false, kotor = false, teksSimpan = "", fileSheet = null, mode = "tambah";
  const isi = h("div");
  const d = dialog({
    judul: jenis === "teks" ? "Input cepat: tempel teks" : "Impor dari Excel / CSV", lebar: true, isi: [isi],
    tanyaTutup: async () => {
      if (sibuk) return false;
      return !kotor || konfirmasi({ judul: "Tutup tanpa menyimpan?", isi: "Soal yang belum disimpan akan hilang.", ya: "Tutup", bahaya: true });
    },
  });
  d.el.classList.add("sangat-lebar");

  function kontrolGambar(saatBerubah) {
    const info = h("p", { class: "bantuan", role: "status" });
    const input = h("input", { type: "file", accept: "image/*", multiple: true, class: "sr-only", tabindex: "-1", "aria-hidden": "true" });
    const ringkas = () => {
      info.textContent = berkas.size
        ? `${berkas.size} gambar dipilih: ${[...berkas.values()].map((f) => f.name).slice(0, 8).join(", ")}${berkas.size > 8 ? "…" : ""}`
        : "Belum ada gambar. Pilih hanya jika soal memakai GAMBAR / gambar_soal.";
    };
    input.addEventListener("change", () => {
      for (const f of input.files) {
        const err = periksaGambar(f);
        if (err) { toast(`${f.name}: ${err}`, "galat"); continue; }
        berkas.set(f.name.toLowerCase(), f);
      }
      input.value = ""; ringkas(); saatBerubah();
    });
    ringkas();
    return h("div", { style: "margin:.75rem 0" },
      h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => input.click() }, ikon("unggah", 16), "Pilih berkas gambar (boleh banyak sekaligus)"), info, input);
  }

  // ===== Langkah 1: masukan =====
  function langkahInput() {
    let ta = null;
    const tombolPeriksa = h("button", { type: "button", class: "tombol tombol-utama" }, "Periksa dan pratinjau");
    let bagianAtas;
    if (jenis === "teks") {
      ta = h("textarea", { class: "ta-besar", "aria-label": "Tempel soal di sini", placeholder: CONTOH });
      ta.value = teksSimpan;
      bagianAtas = [
        h("p", {}, "Tempel soal dari Word atau Google Docs. Pisahkan setiap soal dengan SATU BARIS KOSONG. Kata kunci: JAWABAN, PEMBAHASAN, GAMBAR, GAMBAR_PEMBAHASAN (huruf besar/kecil bebas)."),
        ta];
    } else {
      const input = h("input", { type: "file", accept: ".xlsx,.xls,.csv", "aria-label": "Berkas Excel atau CSV" });
      input.addEventListener("change", () => { fileSheet = input.files[0] || null; });
      bagianAtas = [
        h("p", {}, "Isi templat (kolom: no, soal, A, B, C, D, E, kunci, pembahasan, gambar_soal, gambar_pembahasan), simpan, lalu unggah di sini. CSV harus berkode UTF-8."),
        h("button", { type: "button", class: "tombol tombol-garis", onclick: () => unduhTemplat().catch((e) => toast(e.message, "galat")) }, ikon("unduh", 16), "Unduh templat Excel"),
        h("div", { class: "kolom", style: "margin-top:1rem" }, h("label", {}, "Berkas Excel / CSV"), input)];
    }
    tombolPeriksa.addEventListener("click", async () => {
      try {
        if (jenis === "teks") { teksSimpan = ta.value; items = parseTeks(teksSimpan); }
        else items = await bacaSheet(fileSheet);
        if (!items.length) { toast("Tidak ada soal yang terbaca.", "galat"); return; }
        if (items.length > 500) { toast("Maksimal 500 soal sekali simpan.", "galat"); return; }
        kotor = true;
        langkahPratinjau();
      } catch (e) { toast(e.message || "Berkas tidak bisa dibaca.", "galat"); }
    });
    isi.replaceChildren(...bagianAtas, kontrolGambar(() => {}), h("div", { class: "dlg-aksi" }, h("button", { type: "button", class: "tombol tombol-garis", onclick: () => d.minta() }, "Batal"), tombolPeriksa));
  }

  // ===== Kartu satu soal (bisa diperbaiki di tempat) =====
  function kartu(it, saatHapus, saatUbah) {
    const judul = h("h3", { class: "rapat" });
    const fSoal = h("textarea", { rows: 3, maxlength: 2000, "aria-label": "Teks soal" });
    fSoal.value = it.teks;
    const pv = h("div", { class: "teks-soal bantuan" });
    const fOpsi = HURUF.map((H) => {
      const i = h("input", { type: "text", maxlength: 500, "aria-label": "Opsi " + H, placeholder: "Opsi " + H });
      const o = it.opsi.find((x) => x.id === H);
      i.value = o ? o.teks : "";
      return i;
    });
    const sel = h("select", { "aria-label": "Kunci jawaban" }, h("option", { value: "" }, "Pilih kunci"), HURUF.map((H) => h("option", { value: H }, "Kunci: " + H)));
    sel.value = it.kunci || "";
    const fBahas = h("textarea", { rows: 2, maxlength: 4000, "aria-label": "Pembahasan" });
    fBahas.value = it.bahas;
    const fRefS = h("input", { type: "text", "aria-label": "Nama berkas gambar soal", placeholder: "gambar soal (nama berkas)" });
    fRefS.value = it.refGambar;
    const fRefB = h("input", { type: "text", "aria-label": "Nama berkas gambar pembahasan", placeholder: "gambar pembahasan (nama berkas)" });
    fRefB.value = it.refBahas;
    const daftarGalat = h("ul", { class: "galat-daftar", role: "status" });
    const hapus = h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => saatHapus(ctl) }, ikon("sampah", 16), "Buang soal ini");
    const el = h("article", { class: "kartu-impor" },
      h("div", { class: "kepala-bagian" }, judul, hapus),
      h("div", { class: "kolom" }, h("label", {}, "Soal"), fSoal, pv),
      h("div", { class: "grid-opsi" }, fOpsi, sel),
      h("div", { class: "kolom", style: "margin-top:.5rem" }, h("label", {}, "Pembahasan"), fBahas),
      h("div", { class: "grid-opsi" }, fRefS, fRefB), daftarGalat);

    function baca() {
      it.teks = fSoal.value.trim();
      let akhir = -1;
      fOpsi.forEach((x, i) => { if (x.value.trim()) akhir = i; });
      it.opsi = HURUF.slice(0, akhir + 1).map((H, i) => ({ id: H, teks: fOpsi[i].value.trim() }));
      it.kunci = sel.value || null;
      if (sel.value) it._kunciMentah = "";
      it.bahas = fBahas.value.trim();
      it.refGambar = fRefS.value.trim();
      it.refBahas = fRefB.value.trim();
    }
    function periksa() {
      baca();
      it.galat = validasiSoal(it, berkas);
      daftarGalat.replaceChildren(...it.galat.map((t) => h("li", {}, ikon("peringatan", 18), t)));
      el.classList.toggle("bermasalah", it.galat.length > 0);
      el.classList.toggle("siap", !it.galat.length);
      pv.replaceChildren(renderTeksRumus(it.teks));
    }
    const tunda = debounce(() => { periksa(); saatUbah(); }, 200);
    el.addEventListener("input", tunda);
    el.addEventListener("change", tunda);
    const ctl = { it, el, periksa, setNo: (n) => { judul.textContent = `Soal ${n}`; } };
    periksa();
    return ctl;
  }

  // ===== Langkah 2: pratinjau dan simpan =====
  function langkahPratinjau() {
    kartuAda = [];
    const info = h("p", { role: "status", class: "rapat", style: "font-weight:800" });
    const status = h("p", { role: "status", class: "bantuan rapat" });
    const bSimpan = h("button", { type: "button", class: "tombol tombol-utama", onclick: () => simpanSemua() });
    const daftar = h("div");
    function segarkan() {
      const total = items.length, salah = items.filter((i) => i.galat && i.galat.length).length;
      info.textContent = `${total} soal · ${total - salah} siap · ${salah} bermasalah`;
      bSimpan.disabled = sibuk || !total || salah > 0;
      bSimpan.textContent = `Simpan ${total} soal`;
    }
    function periksaSemua() { kartuAda.forEach((k) => k.periksa()); segarkan(); }
    function buang(k) {
      const i = kartuAda.indexOf(k);
      if (i < 0) return;
      kartuAda.splice(i, 1); items.splice(i, 1); k.el.remove();
      kartuAda.forEach((x, n) => x.setNo(n + 1));
      segarkan();
    }
    items.forEach((it, i) => { const k = kartu(it, buang, segarkan); k.setNo(i + 1); kartuAda.push(k); daftar.append(k.el); });
    const pilihMode = jumlahAda > 0 ? (() => {
      const s = segmen({ label: "Cara menyimpan", pilihan: [["tambah", "Tambahkan ke soal yang ada"], ["ganti", "Ganti semua soal bab ini"]], nilai: mode, saatUbah: (v) => { mode = v; s.set(v); } });
      return h("div", { style: "margin:.5rem 0" }, h("p", { class: "label-kecil" }, `Bab ini sudah punya ${jumlahAda} soal`), s.el);
    })() : null;

    async function simpanSemua() {
      const ganti = mode === "ganti" && jumlahAda > 0;
      if (ganti && !(await konfirmasi({
        judul: "Ganti semua soal bab ini?",
        isi: `${jumlahAda} soal yang ada akan dihapus beserta jawaban siswa pada soal-soal itu. Riwayat nilai lama tetap tersimpan, tetapi pembahasan soal lama tidak bisa dilihat lagi. Tindakan ini tidak bisa dibatalkan.`,
        ya: "Ya, ganti semua", bahaya: true }))) return;
      sibuk = true; segarkan();
      const baru = [], cache = new Map();
      const naik = async (nama, bucket) => {
        const k = bucket + "|" + nama.toLowerCase();
        if (cache.has(k)) return cache.get(k);
        const blob = await kecilkanGambar(berkas.get(nama.toLowerCase()));
        const p = await unggahGambar(bucket, blob);
        baru.push({ bucket, path: p });
        cache.set(k, p);
        return p;
      };
      let lama = null;
      try {
        if (ganti) { try { lama = await pathGambarBab(materialId); } catch { /* tambahan */ } }
        const payload = [];
        for (let n = 0; n < items.length; n++) {
          const it = items[n];
          status.textContent = `Memproses soal ${n + 1} dari ${items.length}…`;
          const gs = it.refGambar ? await naik(it.refGambar, BUCKET_SOAL) : null;
          const gb = it.refBahas ? await naik(it.refBahas, BUCKET_BAHAS) : null;
          payload.push(keItemRpc({ ...it, id: undefined, gambarSoal: gs, gambarBahas: gb }));
        }
        status.textContent = "Menyimpan semua soal…";
        await simpanSoal(materialId, ganti, payload);
        if (ganti && lama) {
          bersihkanTakTerpakai(BUCKET_SOAL, lama.soal).catch(() => {});
          bersihkanTakTerpakai(BUCKET_BAHAS, lama.bahas).catch(() => {});
        }
        kotor = false; sibuk = false;
        d.tutup();
        toast(`${items.length} soal disimpan`);
        saat();
      } catch (e) {
        for (const b of baru) hapusGambar(b.bucket, [b.path]).catch(() => {}); // batalkan gambar yang sempat terunggah
        sibuk = false; status.textContent = ""; segarkan();
        toast(pesanRpc(e), "galat");
      }
    }
    isi.replaceChildren(
      kontrolGambar(periksaSemua),
      h("div", { class: "ringkas-impor" }, info, h("div", { class: "aksi-baris" },
        h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => langkahInput() }, "← Kembali"), bSimpan)),
      pilihMode, status, daftar);
    segarkan();
  }

  langkahInput();
}