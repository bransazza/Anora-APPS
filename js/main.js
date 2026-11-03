// ANORA admin — main.js (sesi admin, routing, drawer menu, penjaga form belum tersimpan)
import { supabase, belumDiatur, galatSesi, pesanGalat } from "./supabase.js";
import { hidrasiIkon, h, ikon, ganti, elMemuat, elGalat, perangkapFokus } from "./ui.js";
import { konfirmasi, status, setKotor } from "./widget.js";
import { ambilAdmin, masuk, keluar, GalatMasuk } from "./auth.js";
import { MENU } from "./menu.js";
import { parseHash, cocokkan } from "./router.js";

const $ = (s) => document.querySelector(s);
const login = $("#login");
const app = $("#app");
const muatAwal = $("#muat-awal");
const konten = $("#konten");
const sidebar = $("#sidebar");
const scrimMenu = $("#scrim-menu");
const tombolMenu = $("#tombol-menu");
const KUNCI_KEMBALI = "anora-admin-kembali";

// Tahap berikutnya: tambah item di menu.js dan satu baris di sini (Materi, Try Out, Nilai).
const RUTE = [
  { pola: "/dashboard", judul: "Dashboard", menu: "/dashboard", muat: () => import("./pages/dashboard.js") },
  { pola: "/siswa", judul: "Siswa", menu: "/siswa", muat: () => import("./pages/siswa-daftar.js") },
  { pola: "/siswa/tambah", judul: "Tambah siswa", menu: "/siswa", muat: () => import("./pages/siswa-tambah.js") },
  { pola: "/siswa/:id", judul: "Detail siswa", menu: "/siswa", muat: () => import("./pages/siswa-detail.js") },
  { pola: "/absensi", judul: "Absensi", menu: "/absensi", muat: () => import("./pages/absensi.js") },
  { pola: "/parent-guide", judul: "Parent Guide", menu: "/parent-guide", muat: () => import("./pages/parent-guide.js") },
  { pola: "/materi", judul: "Materi", menu: "/materi", muat: () => import("./pages/materi.js") },
  { pola: "/materi/soal/:id", judul: "Kelola soal", menu: "/materi", muat: () => import("./pages/soal.js") },
  { pola: "/tryout", judul: "Try Out", menu: "/tryout", muat: () => import("./pages/tryout.js") },
  { pola: "/tryout/soal/:id", judul: "Kelola soal try out", menu: "/tryout", muat: () => import("./pages/soal.js") },
  { pola: "/tryout/hasil/:id", judul: "Hasil try out", menu: "/tryout", muat: () => import("./pages/tryout-hasil.js") },
  { pola: "/nilai", judul: "Nilai", menu: "/nilai", muat: () => import("./pages/nilai.js") },
  { pola: "/akun", judul: "Akun & Password", menu: "/akun", muat: () => import("./pages/akun.js") },
  { pola: "/pengaturan", judul: "Pengaturan", menu: "/pengaturan", muat: () => import("./pages/pengaturan.js") },
  
];

let modeApp = false, keluarSendiri = false, jalan = false, nomorTampil = 0, admin = null, hashTerakhir = "";

// ---------- Layar login / aplikasi ----------
function setPesan(pesan, jenis) {
  const b = $("#pesan-login");
  if (!pesan) { b.hidden = true; b.textContent = ""; return; }
  b.className = "banner banner-" + (jenis === "galat" ? "galat" : jenis === "ok" ? "ok" : "info");
  b.textContent = pesan; b.hidden = false;
}
function berhentiRouter() { if (jalan) { jalan = false; window.removeEventListener("hashchange", onHash); } }

function tampilLogin(pesan, jenis = "info") {
  modeApp = false; nomorTampil++; admin = null;
  berhentiRouter(); tutupDrawer(false); setKotor(false);
  app.hidden = true; muatAwal.hidden = true; login.hidden = false;
  history.replaceState(null, "", location.pathname + location.search);
  document.title = "Masuk — ANORA Admin";
  setPesan(pesan, jenis);
  window.scrollTo(0, 0);
}

function bangunMenu() {
  $("#daftar-menu").replaceChildren(...MENU.map((m) =>
    h("li", {}, h("a", { class: "menu-tautan", href: "#" + m.rute, "data-rute": m.rute }, ikon(m.ikon), m.label))));
}

function masukAdmin(a) {
  admin = a; modeApp = true;
  setPesan(null);
  login.hidden = true; muatAwal.hidden = true; app.hidden = false;
  $("#email-admin").textContent = a.email;
  bangunMenu();
  let kembali = null;
  try { kembali = sessionStorage.getItem(KUNCI_KEMBALI); sessionStorage.removeItem(KUNCI_KEMBALI); } catch { /* abaikan */ }
  if (kembali && kembali.startsWith("#/")) history.replaceState(null, "", kembali);
  else if (!parseHash().path) history.replaceState(null, "", "#/dashboard");
  if (!jalan) { jalan = true; window.addEventListener("hashchange", onHash); }
  render();
}

// ---------- Sesi berakhir dan keluar ----------
function sesiBerakhir() {
  if (!modeApp) return;
  try { if (location.hash.startsWith("#/")) sessionStorage.setItem(KUNCI_KEMBALI, location.hash); } catch { /* abaikan */ }
  modeApp = false; keluarSendiri = true;
  keluar().finally(() => { keluarSendiri = false; });
  tampilLogin("Sesi berakhir, masuk lagi.", "galat");
}

async function keluarManual(global = false) {
  if (!modeApp) return;
  if (status.kotor && !(await konfirmasi({ judul: "Perubahan belum disimpan", isi: "Ada isian yang belum disimpan. Tetap keluar?", ya: "Ya, keluar", tidak: "Tetap di sini", bahaya: true }))) return;
  try { sessionStorage.removeItem(KUNCI_KEMBALI); } catch { /* abaikan */ }
  modeApp = false; keluarSendiri = true;
  await keluar(global);
  keluarSendiri = false;
  tampilLogin(global ? "Anda sudah keluar dari semua perangkat." : "Anda sudah keluar.", "ok");
  $("#in-email").focus();
}

// ---------- Routing ----------
function onHash() {
  if (status.kotor) {
    // Batalkan perpindahan, tanya dulu
    const tujuan = location.hash;
    history.replaceState(null, "", hashTerakhir);
    konfirmasi({ judul: "Perubahan belum disimpan", isi: "Ada isian yang belum disimpan. Tinggalkan halaman ini?", ya: "Tinggalkan halaman", tidak: "Tetap di sini", bahaya: true })
      .then((ya) => { if (ya) { setKotor(false); location.hash = tujuan; } });
    return;
  }
  render();
}

async function render() {
  const { path, query } = parseHash();
  let cocok = null;
  for (const r of RUTE) { const p = cocokkan(r.pola, path); if (p) { cocok = { r, params: p }; break; } }
  if (!cocok) { history.replaceState(null, "", "#/dashboard"); render(); return; }
  hashTerakhir = location.hash;
  const nomor = ++nomorTampil;
  const aktif = () => modeApp && nomor === nomorTampil;
  const ctx = {
    params: cocok.params, query, aktif, admin,
    setJudul: (t) => { if (aktif()) $("#judul-halaman").textContent = t; },
    gantiHash: (hh) => { history.replaceState(null, "", hh); hashTerakhir = hh; },
    pindah: (hh) => { location.hash = hh; },
  };
  $("#judul-halaman").textContent = cocok.r.judul;
  document.title = `${cocok.r.judul} — ANORA Admin`;
  document.querySelectorAll(".menu-tautan[data-rute]").forEach((a) => {
    if (a.dataset.rute === cocok.r.menu) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  tutupDrawer(false); setKotor(false);
  ganti(konten, elMemuat());
  konten.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  try {
    const modul = await cocok.r.muat();
    if (!aktif()) return;
    await modul.tampil(konten, ctx);
  } catch (e) {
    if (!aktif()) return;
    ganti(konten, elGalat(pesanGalat(e), () => render()));
  }
}

// ---------- Drawer menu (HP) ----------
let lepasFokusMenu = null;
function bukaDrawer() {
  sidebar.classList.add("terbuka"); scrimMenu.classList.add("tampil");
  tombolMenu.setAttribute("aria-expanded", "true"); tombolMenu.setAttribute("aria-label", "Tutup menu");
  document.body.classList.add("kunci-gulir");
  lepasFokusMenu = perangkapFokus(sidebar);
  const a = sidebar.querySelector("a"); if (a) a.focus();
}
function tutupDrawer(kembaliFokus) {
  if (!sidebar.classList.contains("terbuka")) return;
  sidebar.classList.remove("terbuka"); scrimMenu.classList.remove("tampil");
  tombolMenu.setAttribute("aria-expanded", "false"); tombolMenu.setAttribute("aria-label", "Buka menu");
  document.body.classList.remove("kunci-gulir");
  if (lepasFokusMenu) lepasFokusMenu();
  lepasFokusMenu = null;
  if (kembaliFokus) tombolMenu.focus();
}

// ---------- Formulir login ----------
function siapkanLogin() {
  const form = $("#form-login"), email = $("#in-email"), sandi = $("#in-sandi"), mata = $("#tombol-mata");
  const galat = $("#galat-login"), kirim = $("#kirim-login");
  let sibuk = false;
  function aturMata(tampil) {
    sandi.type = tampil ? "text" : "password";
    mata.setAttribute("aria-pressed", String(tampil));
    mata.setAttribute("aria-label", tampil ? "Sembunyikan password" : "Tampilkan password");
    mata.replaceChildren(ikon(tampil ? "mata-coret" : "mata"));
  }
  aturMata(false);
  mata.addEventListener("click", () => aturMata(sandi.type === "password"));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sibuk) return;
    sibuk = true; kirim.disabled = true; kirim.classList.add("sibuk"); kirim.textContent = "Memproses…"; galat.hidden = true;
    try {
      const a = await masuk(email.value, sandi.value);
      form.reset(); aturMata(false);
      masukAdmin(a);
    } catch (err) {
      galat.textContent = err instanceof GalatMasuk ? err.message : "Gagal masuk. Coba lagi.";
      galat.hidden = false; sandi.focus(); sandi.select();
    } finally { sibuk = false; kirim.disabled = false; kirim.classList.remove("sibuk"); kirim.textContent = "Masuk"; }
  });
}

function pasangEvent() {
  tombolMenu.addEventListener("click", () => (sidebar.classList.contains("terbuka") ? tutupDrawer(true) : bukaDrawer()));
  scrimMenu.addEventListener("click", () => tutupDrawer(true));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") tutupDrawer(true); });
  window.matchMedia("(min-width: 900px)").addEventListener("change", () => tutupDrawer(false));
  sidebar.addEventListener("click", (e) => { if (e.target.closest("a.menu-tautan")) tutupDrawer(false); });
  $("#keluar-atas").addEventListener("click", () => keluarManual());
  $("#keluar-menu").addEventListener("click", () => keluarManual());
  document.querySelector("[data-lewati]").addEventListener("click", (e) => {
    e.preventDefault();
    const utama = [...document.querySelectorAll("main")].find((m) => !m.closest("[hidden]"));
    if (utama) utama.focus();
  });
  window.addEventListener("anora:sesi-berakhir", sesiBerakhir);
  window.addEventListener("anora:keluar", (e) => keluarManual(!!(e.detail && e.detail.global)));
  window.addEventListener("beforeunload", (e) => { if (modeApp && status.kotor) { e.preventDefault(); e.returnValue = ""; } });
  // Jangan memanggil fungsi Supabase di dalam callback ini (bisa macet).
  supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT" && modeApp && !keluarSendiri) sesiBerakhir(); });
}

// ---------- Mulai ----------
async function mulai() {
  hidrasiIkon(document);
  pasangEvent();
  siapkanLogin();
  if (belumDiatur) {
    tampilLogin("Website belum disambungkan ke Supabase. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di berkas js/config.js, lalu unggah ulang.", "galat");
    return;
  }
  try {
    const r = await ambilAdmin();
    if (r.status === "admin") { masukAdmin(r.admin); return; }
    if (r.status === "bukan-admin") { await keluar(); tampilLogin("Akun ini bukan admin.", "galat"); return; }
  } catch (e) {
    if (galatSesi(e)) { await keluar(); tampilLogin("Sesi berakhir, masuk lagi.", "galat"); }
    else tampilLogin(pesanGalat(e), "galat");
    return;
  }
  tampilLogin();
}
mulai();