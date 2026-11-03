// ANORA admin — router.js (hash: #/siswa/:id?tab=ringkasan)

export function parseHash() {
  const h = location.hash.replace(/^#/, "");
  const [p, q = ""] = h.split("?");
  return { path: p.startsWith("/") ? p : "", query: new URLSearchParams(q) };
}

// Cocokkan pola seperti "/siswa/:id" dengan path. Hasil: objek parameter atau null.
export function cocokkan(pola, path) {
  const a = pola.split("/").filter(Boolean);
  const b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const p = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] === ":") {
      try { p[a[i].slice(1)] = decodeURIComponent(b[i]); } catch { return null; }
    } else if (a[i] !== b[i]) return null;
  }
  return p;
}