// ANORA — reader.js: pembaca PDF seperti ebook (PDF.js, satu halaman per layar)
// Berkas ini SAMA di siswa/js/reader.js dan admin/js/reader.js. Jika mengubah, ubah di keduanya.
const BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const IKON = {
  kiri: '<polyline points="15 18 9 12 15 6"/>',
  kanan: '<polyline points="9 18 15 12 9 6"/>',
  penuh: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  kecil: '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>',
};
const ikon = (n) => {
  const s = document.createElement("span");
  s.className = "ikon";
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${IKON[n]}</svg>`;
  return s;
};
const buat = (tag, attrs = {}, ...anak) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const a of anak.flat()) {
    if (a !== null && a !== undefined && a !== false) el.append(a instanceof Node ? a : document.createTextNode(String(a)));
  }
  return el;
};

class GalatUnduh extends Error {
  constructor(status) { super("unduh " + status); this.status = status; }
}

// PDF.js dimuat hanya saat pembaca dibuka (lazy load)
let janjiLib = null;
function muatPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!janjiLib) {
    janjiLib = new Promise((ok, gagal) => {
      const s = document.createElement("script");
      s.src = BASE + "pdf.min.js";
      s.onload = () => {
        if (!window.pdfjsLib) { janjiLib = null; const e = new Error("pdfjs"); e.pesan = "Pembaca PDF gagal dimuat. Periksa koneksi internet lalu coba lagi."; gagal(e); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + "pdf.worker.min.js";
        ok(window.pdfjsLib);
      };
      s.onerror = () => { janjiLib = null; const e = new Error("pdfjs"); e.pesan = "Pembaca PDF gagal dimuat. Periksa koneksi internet lalu coba lagi."; gagal(e); };
      document.head.append(s);
    });
  }
  return janjiLib;
}

// Unduh seluruh PDF dengan indikator kemajuan (setelah itu tidak butuh jaringan lagi, jadi tautan yang kedaluwarsa tidak mengganggu)
async function unduh(url, saatProgres) {
  const r = await fetch(url);
  if (!r.ok) throw new GalatUnduh(r.status);
  const total = Number(r.headers.get("content-length")) || 0;
  if (!r.body || !r.body.getReader) return new Uint8Array(await r.arrayBuffer());
  const baca = r.body.getReader();
  const bagian = [];
  let dapat = 0;
  for (;;) {
    const { done, value } = await baca.read();
    if (done) break;
    bagian.push(value);
    dapat += value.length;
    saatProgres(total ? dapat / total : null);
  }
  const hasil = new Uint8Array(dapat);
  let o = 0;
  for (const b of bagian) { hasil.set(b, o); o += b.length; }
  return hasil;
}

function pesanDari(e) {
  if (e && e.pesan) return e.pesan;
  if (e instanceof GalatUnduh) {
    if (e.status === 404) return "Berkas materi tidak ditemukan. Hubungi admin bimbel.";
    if ([400, 401, 403].includes(e.status)) return "Akses ke materi ditolak atau tautannya sudah kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    return `Materi gagal dimuat (kode ${e.status}).`;
  }
  const n = (e && e.name) || "";
  if (n === "PasswordException") return "PDF ini dilindungi password dan tidak bisa dibuka.";
  if (n === "InvalidPDFException" || n === "FormatError") return "Berkas PDF rusak atau tidak bisa dibuka.";
  if (n === "MissingPDFException") return "Berkas materi tidak ditemukan.";
  if (!navigator.onLine || e instanceof TypeError) return "Koneksi bermasalah. Periksa internet lalu coba lagi.";
  return "Materi gagal dimuat. Coba lagi.";
}

/*
  bukaPembaca({
    judul, ambilUrl: async () => "tautan bertanda tangan (signed URL)",
    kunciIngatan: "kunci localStorage" | null, adaLatihan: boolean, saatLatihan: () => {},
    saatKembali: () => {}, labelKembali: "teks tombol kembali", latar: elemen yang dikunci (inert) saat pembaca terbuka
  }) -> { tutup(), info(teks) }
*/
export function bukaPembaca(opsi) {
  const { judul, ambilUrl, kunciIngatan = null, adaLatihan = false, saatLatihan = () => {}, saatKembali = () => {}, labelKembali = "Kembali", latar = null } = opsi;
  let pdf = null, total = 0, sekarang = 0, kanvas = null, tugas = null, nomorGambar = 0, tertutup = false, tundaId = 0, infoId = 0;

  // ----- bagian tampilan -----
  const tombolKembali = buat("button", { type: "button", class: "tombol tombol-garis pb-kembali", onclick: () => saatKembali() }, ikon("kiri"), labelKembali);
  const tombolLayar = buat("button", { type: "button", class: "ikon-tombol pb-layar", "aria-label": "Layar penuh", onclick: () => alihLayar() }, ikon("penuh"));
  const atas = buat("header", { class: "pb-atas" }, tombolKembali, buat("h1", { class: "pb-judul" }, judul), tombolLayar);
  const status = buat("div", { class: "pb-status", role: "status" });
  const panggung = buat("div", { class: "pb-panggung", tabindex: "0", "aria-label": "Halaman materi" }, status);
  const isiKemajuan = buat("div", { class: "pb-isi" });
  const kemajuan = buat("div", { class: "pb-kemajuan", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0", "aria-label": "Kemajuan membaca" }, isiKemajuan);
  const btnSebelum = buat("button", { type: "button", class: "tombol tombol-garis", onclick: () => ke(sekarang - 1) }, ikon("kiri"), "Sebelumnya");
  const btnBerikut = buat("button", { type: "button", class: "tombol tombol-utama", onclick: () => ke(sekarang + 1) }, "Berikutnya", ikon("kanan"));
  const btnLatihan = buat("button", { type: "button", class: "tombol tombol-emas", hidden: true, onclick: () => saatLatihan() }, "Lanjut ke Latihan Soal");
  const teksHalaman = buat("span", { class: "pb-halaman", "aria-live": "polite" });
  const teksInfo = buat("p", { class: "pb-info", role: "status" });
  const bawah = buat("footer", { class: "pb-bawah" },
    buat("div", { class: "pb-kiri" }, btnSebelum),
    buat("div", { class: "pb-tengah" }, teksHalaman, teksInfo),
    buat("div", { class: "pb-kanan" }, btnBerikut, btnLatihan));
  const root = buat("div", { class: "pembaca", role: "region", "aria-label": "Pembaca materi" }, atas, panggung, kemajuan, bawah);
  document.body.append(root);
  document.body.classList.add("kunci-gulir");
  if (latar) latar.inert = true;

  // ----- status memuat / galat -----
  function tampilMemuat(teks, pecahan) {
    status.hidden = false; status.className = "pb-status"; status.setAttribute("role", "status");
    status.replaceChildren(buat("div", { class: "pb-putar", "aria-hidden": "true" }), buat("p", {}, teks),
      pecahan === null || pecahan === undefined ? null : buat("progress", { max: 100, value: Math.round(pecahan * 100), "aria-label": "Kemajuan unduhan" }));
  }
  function tampilGalat(pesan, ulang) {
    status.hidden = false; status.className = "pb-status pb-galat"; status.setAttribute("role", "alert");
    status.replaceChildren(buat("p", {}, pesan),
      buat("div", { class: "pb-aksi-galat" },
        buat("button", { type: "button", class: "tombol tombol-utama", onclick: ulang }, "Coba lagi"),
        buat("button", { type: "button", class: "tombol tombol-garis", onclick: () => saatKembali() }, labelKembali)));
  }
  const tutupStatus = () => { status.hidden = true; status.replaceChildren(); };

  // ----- ingatan halaman terakhir (per siswa per materi, di browser) -----
  function bacaIngatan() {
    if (!kunciIngatan) return 1;
    try { const n = parseInt(localStorage.getItem(kunciIngatan), 10); return Number.isInteger(n) && n >= 1 ? n : 1; } catch { return 1; }
  }
  function simpanIngatan(n) { if (kunciIngatan) { try { localStorage.setItem(kunciIngatan, String(n)); } catch { /* abaikan */ } } }

  // ----- tampilan halaman -----
  function perbarui() {
    teksHalaman.textContent = `Halaman ${sekarang} dari ${total}`;
    const persen = total ? Math.round((sekarang / total) * 100) : 0;
    isiKemajuan.style.width = persen + "%";
    kemajuan.setAttribute("aria-valuenow", String(persen));
    btnSebelum.disabled = sekarang <= 1;
    const akhir = sekarang >= total;
    btnBerikut.hidden = akhir && adaLatihan;
    btnBerikut.disabled = akhir;
    btnLatihan.hidden = !(akhir && adaLatihan);
    panggung.setAttribute("aria-label", `Halaman ${sekarang} dari ${total}`);
  }

  async function gambar(n) {
    const saya = ++nomorGambar;
    if (tugas) { try { tugas.cancel(); } catch { /* abaikan */ } tugas = null; }
    const hal = await pdf.getPage(n);
    if (saya !== nomorGambar || tertutup) return;
    const v1 = hal.getViewport({ scale: 1 });
    const kotak = panggung.getBoundingClientRect();
    const skala = Math.min(Math.max(100, kotak.width - 16) / v1.width, Math.max(100, kotak.height - 16) / v1.height);
    let dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let vp = hal.getViewport({ scale: skala * dpr });
    if (vp.width * vp.height > 16e6) { dpr *= Math.sqrt(16e6 / (vp.width * vp.height)); vp = hal.getViewport({ scale: skala * dpr }); }
    const baru = buat("canvas", { draggable: "false", role: "img", "aria-label": `Halaman ${n} dari ${total}` });
    baru.width = Math.floor(vp.width);
    baru.height = Math.floor(vp.height);
    baru.style.width = Math.floor(v1.width * skala) + "px";
    baru.style.height = Math.floor(v1.height * skala) + "px";
    const t = hal.render({ canvasContext: baru.getContext("2d", { alpha: false }), viewport: vp, background: "#ffffff" });
    tugas = t;
    try { await t.promise; } catch (e) { if (e && e.name === "RenderingCancelledException") return; throw e; }
    if (saya !== nomorGambar || tertutup) return;
    if (kanvas) kanvas.remove();
    kanvas = baru;
    panggung.append(baru);
    tutupStatus();
    hal.cleanup();
  }

  function ke(n) {
    if (!pdf || tertutup) return;
    n = Math.max(1, Math.min(total, n));
    if (n === sekarang && kanvas) return;
    sekarang = n;
    simpanIngatan(n);
    perbarui();
    gambar(n).catch(() => tampilGalat("Halaman ini gagal ditampilkan.", () => { tutupStatus(); gambar(sekarang).catch(() => {}); }));
    if (n < total) pdf.getPage(n + 1).catch(() => {}); // pemanasan halaman berikutnya
  }

  async function muat() {
    tampilMemuat("Menyiapkan pembaca…", null);
    try {
      const lib = await muatPdfJs();
      let url = await ambilUrl();
      let data;
      const progres = (p) => tampilMemuat("Mengunduh materi…", p);
      try { data = await unduh(url, progres); }
      catch (e) {
        // tautan kedaluwarsa / ditolak: buat tautan baru satu kali lalu coba lagi
        if (e instanceof GalatUnduh && [400, 401, 403].includes(e.status)) { url = await ambilUrl(); data = await unduh(url, progres); }
        else throw e;
      }
      if (tertutup) return;
      tampilMemuat("Membuka halaman…", null);
      if (pdf) { try { pdf.destroy(); } catch { /* abaikan */ } }
      pdf = await lib.getDocument({ data, isEvalSupported: false }).promise;
      if (tertutup) { pdf.destroy(); return; }
      total = pdf.numPages;
      const awal = Math.min(bacaIngatan(), total);
      sekarang = 0;
      ke(awal);
      if (awal > 1) info(`Melanjutkan dari halaman ${awal}`);
      panggung.focus({ preventScroll: true });
    } catch (e) {
      if (tertutup) return;
      tampilGalat(pesanDari(e), muat);
    }
  }

  function info(teks) {
    teksInfo.textContent = teks;
    clearTimeout(infoId);
    infoId = setTimeout(() => { teksInfo.textContent = ""; }, 5000);
  }

  // ----- layar penuh -----
  const adaFs = () => document.fullscreenElement || document.webkitFullscreenElement;
  if (!(root.requestFullscreen || root.webkitRequestFullscreen)) tombolLayar.hidden = true;
  async function alihLayar() {
    try {
      if (adaFs()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    } catch { /* abaikan */ }
  }
  function saatLayar() {
    const aktif = !!adaFs();
    tombolLayar.replaceChildren(ikon(aktif ? "kecil" : "penuh"));
    tombolLayar.setAttribute("aria-label", aktif ? "Keluar layar penuh" : "Layar penuh");
  }
  document.addEventListener("fullscreenchange", saatLayar);
  document.addEventListener("webkitfullscreenchange", saatLayar);

  // ----- keyboard, geser, ukuran, klik kanan -----
  function tekan(e) {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "PageDown") { e.preventDefault(); ke(sekarang + 1); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); ke(sekarang - 1); }
    else if (k === "Home") { e.preventDefault(); ke(1); }
    else if (k === "End") { e.preventDefault(); ke(total); }
  }
  document.addEventListener("keydown", tekan);

  let sx = 0, sy = 0, melacak = false;
  panggung.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { melacak = false; return; }
    melacak = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  panggung.addEventListener("touchend", (e) => {
    if (!melacak) return;
    melacak = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ke(sekarang + (dx < 0 ? 1 : -1));
  }, { passive: true });

  // Penghalang ringan: tidak ada menu klik kanan di area halaman (tidak mencegah tangkapan layar)
  panggung.addEventListener("contextmenu", (e) => e.preventDefault());
  panggung.addEventListener("dragstart", (e) => e.preventDefault());

  const pengamat = new ResizeObserver(() => {
    clearTimeout(tundaId);
    tundaId = setTimeout(() => { if (pdf && sekarang && !tertutup) gambar(sekarang).catch(() => {}); }, 150);
  });
  pengamat.observe(panggung);

  function tutup() {
    if (tertutup) return;
    tertutup = true;
    nomorGambar++;
    clearTimeout(tundaId); clearTimeout(infoId);
    if (tugas) { try { tugas.cancel(); } catch { /* abaikan */ } }
    if (pdf) { try { pdf.destroy(); } catch { /* abaikan */ } }
    document.removeEventListener("keydown", tekan);
    document.removeEventListener("fullscreenchange", saatLayar);
    document.removeEventListener("webkitfullscreenchange", saatLayar);
    pengamat.disconnect();
    if (adaFs()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { /* abaikan */ } }
    root.remove();
    document.body.classList.remove("kunci-gulir");
    if (latar) latar.inert = false;
  }

  muat();
  return { tutup, info };
}