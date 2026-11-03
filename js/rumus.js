// ANORA — rumus.js: teks dengan rumus $...$ yang dirender KaTeX.
// Berkas ini SAMA di siswa/js/rumus.js dan admin/js/rumus.js. Jika mengubah, ubah di keduanya.
// KEAMANAN: teks selalu masuk lewat createTextNode; hanya KaTeX (trust: false) yang menulis markup rumus.
const KATEX = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/";
let janji = null;

export function siapkanKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  if (!janji) {
    janji = new Promise((ok, gagal) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = KATEX + "katex.min.css";
      document.head.append(css);
      const s = document.createElement("script");
      s.src = KATEX + "katex.min.js";
      s.onload = () => (window.katex ? ok(window.katex) : gagal(new Error("katex")));
      s.onerror = () => { janji = null; gagal(new Error("katex")); };
      document.head.append(s);
    });
  }
  return janji;
}

// Pecah teks menjadi potongan {t:'teks'|'rumus'|'blok', v}. \$ = tanda dolar biasa. $$...$$ = rumus satu baris penuh.
export function pecahRumus(t) {
  const hasil = [];
  let buf = "";
  let i = 0;
  const dorong = (jenis, v) => { if (jenis !== "teks" || v) hasil.push({ t: jenis, v }); };
  while (i < t.length) {
    const c = t[i];
    if (c === "\\" && t[i + 1] === "$") { buf += "$"; i += 2; continue; }
    if (c === "$") {
      const blok = t[i + 1] === "$";
      const mulai = i + (blok ? 2 : 1);
      let j = mulai, tutup = -1;
      while (j < t.length) {
        if (t[j] === "\\") { j += 2; continue; }
        if (t[j] === "$" && (!blok || t[j + 1] === "$")) { tutup = j; break; }
        j++;
      }
      if (tutup > mulai) {
        dorong("teks", buf); buf = "";
        dorong(blok ? "blok" : "rumus", t.slice(mulai, tutup));
        i = tutup + (blok ? 2 : 1);
        continue;
      }
    }
    buf += c; i++;
  }
  dorong("teks", buf);
  return hasil;
}

// Mengembalikan DocumentFragment. Rumus tampil sebagai teks mentah dulu, lalu diganti hasil KaTeX setelah pustaka dimuat.
export function renderTeksRumus(teks) {
  const frag = document.createDocumentFragment();
  const antre = [];
  for (const p of pecahRumus(String(teks ?? ""))) {
    if (p.t === "teks") { frag.append(document.createTextNode(p.v)); continue; }
    const s = document.createElement("span");
    s.className = p.t === "blok" ? "rumus rumus-blok" : "rumus";
    s.textContent = p.t === "blok" ? "$$" + p.v + "$$" : "$" + p.v + "$";
    frag.append(s);
    antre.push([s, p]);
  }
  if (antre.length) {
    siapkanKatex().then((k) => {
      for (const [s, p] of antre) {
        try { k.render(p.v, s, { throwOnError: false, displayMode: p.t === "blok", trust: false, strict: "ignore", output: "htmlAndMathml" }); }
        catch { /* biarkan teks mentah */ }
      }
    }).catch(() => {});
  }
  return frag;
}