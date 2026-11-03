// ANORA admin — zona-pdf.js (seret-dan-lepas atau pilih berkas PDF, dengan validasi)
import { h, ikon } from "../ui.js";
import { periksaPdf, ukuranTeks } from "../storage.js";

let nomor = 0;
export function zonaPdf({ adaFile = false, saatUbah = () => {} } = {}) {
  let file = null;
  const input = h("input", { type: "file", accept: "application/pdf,.pdf", id: "pdf" + ++nomor, class: "sr-only", tabindex: "-1", "aria-hidden": "true" });
  const galat = h("p", { class: "galat-kolom", role: "alert" });
  galat.hidden = true;
  const info = h("p", { class: "bantuan", role: "status" });
  const batal = h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => atur(null) }, "Batalkan pilihan");
  batal.hidden = true;
  const tombol = h("button", { type: "button", class: "tombol tombol-garis", onclick: () => input.click() }, ikon("unggah", 18), adaFile ? "Pilih PDF pengganti" : "Pilih berkas PDF");
  const el = h("div", { class: "zona-berkas" }, h("p", {}, "Seret berkas PDF ke sini, atau"), tombol, info, batal, galat, input);

  function atur(f) {
    file = f;
    info.textContent = f ? `Dipilih: ${f.name} (${ukuranTeks(f.size)})`
      : adaFile ? "PDF saat ini tetap dipakai jika Anda tidak memilih pengganti. Maksimal 25 MB." : "Format PDF, maksimal 25 MB. Boleh dikosongkan dulu dan diunggah nanti.";
    batal.hidden = !f;
    saatUbah(f);
  }
  async function terima(f) {
    if (!f) return;
    const err = await periksaPdf(f);
    if (err) { galat.textContent = err; galat.hidden = false; return; }
    galat.hidden = true;
    atur(f);
  }
  input.addEventListener("change", () => { terima(input.files[0]); input.value = ""; });
  el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("seret"); });
  el.addEventListener("dragleave", () => el.classList.remove("seret"));
  el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("seret"); terima(e.dataTransfer.files[0]); });
  atur(null);
  return { el, ambil: () => file };
}