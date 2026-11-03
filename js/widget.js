// ANORA admin — widget.js (komponen bersama: toast, dialog, konfirmasi, kolom, segmen, dll.)
import { h, ikon } from "./ui.js";

// ---------- Status "form belum disimpan" ----------
export const status = { kotor: false };
export const setKotor = (v) => { status.kotor = !!v; };

// ---------- Toast ----------
export function toast(pesan, jenis = "ok") {
  const area = document.getElementById("toast-area");
  const t = h("div", { class: "toast toast-" + jenis },
    ikon(jenis === "galat" ? "peringatan" : jenis === "info" ? "info" : "centang", 20), h("span", {}, pesan));
  area.append(t);
  setTimeout(() => t.remove(), jenis === "galat" ? 7000 : 4500);
}

// ---------- Dialog aksesibel ----------
const tumpukan = [];
let nomorDlg = 0;
document.addEventListener("keydown", (e) => {
  const atas = tumpukan[tumpukan.length - 1];
  if (!atas) return;
  if (e.key === "Escape") { e.preventDefault(); atas.minta(); }
  else if (e.key === "Tab") atas.jebak(e);
});

export function dialog({ judul, isi, lebar = false, tanyaTutup = null, saatTutup = null }) {
  const pembuka = document.activeElement;
  const idj = "dj" + ++nomorDlg;
  const badan = h("div", { class: "dlg-badan" });
  badan.append(...[].concat(isi).flat().filter((x) => x !== null && x !== undefined && x !== false));
  const tombolX = h("button", { type: "button", class: "ikon-tombol", "aria-label": "Tutup", onclick: () => minta() }, ikon("silang"));
  const el = h("div", { class: "dlg" + (lebar ? " lebar" : ""), role: "dialog", "aria-modal": "true", "aria-labelledby": idj },
    h("div", { class: "dlg-kepala" }, h("h2", { id: idj }, judul), tombolX), badan);
  const latar = h("div", { class: "dlg-latar" }, el);
  latar.addEventListener("mousedown", (e) => { if (e.target === latar) minta(); });
  let tertutup = false;

  async function minta() {
    if (tertutup) return;
    if (tanyaTutup && !(await tanyaTutup())) return;
    tutup();
  }
  function tutup(hasil) {
    if (tertutup) return;
    tertutup = true;
    const i = tumpukan.indexOf(obj);
    if (i >= 0) tumpukan.splice(i, 1);
    latar.remove();
    if (!tumpukan.length) document.body.classList.remove("kunci-gulir");
    try { if (saatTutup) saatTutup(hasil); } catch { /* abaikan */ }
    if (pembuka && pembuka.focus && document.contains(pembuka)) pembuka.focus();
  }
  function jebak(e) {
    const f = [...el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea')]
      .filter((x) => x.getClientRects().length > 0);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
  const obj = { minta, jebak };
  tumpukan.push(obj);
  document.body.classList.add("kunci-gulir");
  document.body.append(latar);
  (el.querySelector("input,select,textarea") || el.querySelector(".dlg-aksi button") || tombolX).focus();
  return { el, badan, tutup, minta };
}

// Dialog konfirmasi. Mengembalikan Promise<boolean>. Tindakan berbahaya: tombol merah, fokus awal di "Batal".
export function konfirmasi({ judul, isi, ya = "Ya, lanjutkan", tidak = "Batal", bahaya = false }) {
  return new Promise((selesai) => {
    let hasil = false;
    const bYa = h("button", { type: "button", class: "tombol " + (bahaya ? "tombol-bahaya" : "tombol-utama"), onclick: () => { hasil = true; d.tutup(); } }, ya);
    const bTidak = h("button", { type: "button", class: "tombol tombol-garis", onclick: () => d.tutup() }, tidak);
    const d = dialog({
      judul,
      isi: [typeof isi === "string" ? h("p", {}, isi) : isi, h("div", { class: "dlg-aksi" }, bTidak, bYa)],
      saatTutup: () => selesai(hasil),
    });
    (bahaya ? bTidak : bYa).focus();
  });
}

// ---------- Kolom formulir ----------
let nomorKolom = 0;
export function kolom({ label, jenis = "input", tipe = "text", nilai = "", atribut = {}, bantuan = "", pilihan = null }) {
  const id = "k" + ++nomorKolom;
  let kontrol;
  if (pilihan) {
    kontrol = h("select", { id, ...atribut }, pilihan.map(([v, t]) => h("option", { value: v }, t)));
  } else if (jenis === "textarea") {
    kontrol = h("textarea", { id, ...atribut });
  } else {
    kontrol = h("input", { id, type: tipe, ...atribut });
  }
  kontrol.value = nilai;
  const info = h("p", { class: "bantuan", id: id + "-b" }, bantuan);
  info.hidden = !bantuan;
  const galat = h("p", { class: "galat-kolom", id: id + "-g", role: "alert" });
  galat.hidden = true;
  kontrol.setAttribute("aria-describedby", `${id}-b ${id}-g`);
  const el = h("div", { class: "kolom" }, h("label", { for: id }, label), kontrol, info, galat);
  return {
    el, kontrol, info,
    setGalat(t) { galat.textContent = t || ""; galat.hidden = !t; kontrol.setAttribute("aria-invalid", t ? "true" : "false"); },
    setBantuan(t, kelas = "") { info.textContent = t || ""; info.hidden = !t; info.className = "bantuan " + kelas; },
  };
}

export function kolomSandi(opsi) {
  const k = kolom({ ...opsi, tipe: "password" });
  const tb = h("button", { type: "button", class: "ikon-tombol tombol-mata", "aria-pressed": "false", "aria-label": "Tampilkan password" });
  const bungkus = h("div", { class: "kolom-sandi" });
  k.kontrol.replaceWith(bungkus);
  bungkus.append(k.kontrol, tb);
  function tampilkan(v) {
    k.kontrol.type = v ? "text" : "password";
    tb.setAttribute("aria-pressed", String(v));
    tb.setAttribute("aria-label", v ? "Sembunyikan password" : "Tampilkan password");
    tb.replaceChildren(ikon(v ? "mata-coret" : "mata"));
  }
  tb.addEventListener("click", () => tampilkan(k.kontrol.type === "password"));
  tampilkan(false);
  return { ...k, tampilkan };
}

// ---------- Kontrol segmen, saklar, tab, halaman, menu titik ----------
export function segmen({ label, pilihan, nilai = null, saatUbah }) {
  const el = h("div", { class: "segmen", role: "group", "aria-label": label });
  const tb = pilihan.map(([v, t]) => h("button", { type: "button", class: "seg", "data-nilai": v, "aria-pressed": "false", onclick: () => saatUbah(v) }, t));
  el.append(...tb);
  const set = (v) => tb.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.nilai === v)));
  set(nilai);
  return { el, set };
}

export function saklar({ label, aktif, saatKlik }) {
  const b = h("button", { type: "button", class: "saklar", role: "switch", "aria-checked": String(!!aktif), "aria-label": label, onclick: () => saatKlik() }, h("span", { class: "saklar-titik" }));
  return { el: b, set: (v) => b.setAttribute("aria-checked", String(!!v)) };
}

export function tabs({ label, daftar, awal, saatPilih }) {
  const el = h("div", { class: "tab-daftar", role: "tablist", "aria-label": label });
  const tb = daftar.map(([id, teks]) => h("button", {
    type: "button", role: "tab", class: "tab", id: "tab-" + id, "data-id": id,
    "aria-selected": String(id === awal), tabindex: id === awal ? 0 : -1, onclick: () => saatPilih(id),
  }, teks));
  el.append(...tb);
  el.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = tb.indexOf(document.activeElement);
    if (i < 0) return;
    const j = (i + (e.key === "ArrowRight" ? 1 : -1) + tb.length) % tb.length;
    tb[j].focus();
    saatPilih(tb[j].dataset.id);
  });
  return { el, set(id) { tb.forEach((b) => { const on = b.dataset.id === id; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }); } };
}

export function navHalaman({ hal, total, per, saatPindah }) {
  const dari = total ? (hal - 1) * per + 1 : 0;
  const sampai = Math.min(hal * per, total);
  const maks = Math.max(1, Math.ceil(total / per));
  return h("nav", { class: "halaman-nav", "aria-label": "Halaman hasil" },
    h("p", { class: "lembut" }, `Menampilkan ${dari}–${sampai} dari ${total}`),
    h("div", { class: "aksi-baris" },
      h("button", { type: "button", class: "tombol tombol-garis kecil", disabled: hal <= 1, onclick: () => saatPindah(hal - 1) }, ikon("kiri", 16), "Sebelumnya"),
      h("span", { class: "lembut" }, `Hal. ${hal}/${maks}`),
      h("button", { type: "button", class: "tombol tombol-garis kecil", disabled: hal >= maks, onclick: () => saatPindah(hal + 1) }, "Berikutnya", ikon("kanan", 16))));
}

export function menuTitik(label, items) {
  return h("details", { class: "menu-titik" },
    h("summary", { "aria-label": label }, ikon("titik")),
    h("div", { class: "menu-titik-isi" }, items.map(([t, href]) => h("a", { href }, t))));
}
document.addEventListener("click", (e) => {
  document.querySelectorAll("details.menu-titik[open]").forEach((d) => { if (!d.contains(e.target)) d.removeAttribute("open"); });
});

// Sel tabel yang berubah menjadi kartu di HP
export const sel = (label, ...isi) => h("td", { "data-label": label }, h("div", { class: "isi-sel" }, ...isi));