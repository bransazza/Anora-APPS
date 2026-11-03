// ANORA admin — slot-gambar.js (satu kotak gambar: seret, pilih berkas, atau tempel Ctrl+V)
import { h, ikon } from "../ui.js";
import { periksaGambar, kecilkanGambar, unggahGambar, hapusGambar, urlGambar } from "../gambar.js";

// sesi = { baru: [{bucket, path}] } : gambar yang diunggah selama editor terbuka (dibersihkan bila dibatalkan)
export function slotGambar({ label, bucket, pathAwal = null, sesi, saatUbah = () => {}, kompak = false }) {
  let path = pathAwal, urlLokal = null, urlSimpan = null;
  const img = h("img", { class: "slot-img", alt: label });
  img.hidden = true;
  const info = h("p", { class: "bantuan", role: "status" });
  const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", class: "sr-only", tabindex: "-1", "aria-hidden": "true" });
  const tPilih = h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => input.click() }, ikon("unggah", 16), "Pilih gambar");
  const tHapus = h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => hapus() }, ikon("sampah", 16), "Hapus");
  const area = h("div", { class: "slot" + (kompak ? " kompak" : ""), tabindex: "0", role: "group",
    "aria-label": `${label}. Seret gambar ke sini, atau klik di sini lalu tekan Ctrl+V.` },
    img, info, h("div", { class: "aksi-baris" }, tPilih, tHapus), input);

  function tampil() {
    const u = urlLokal || urlSimpan;
    img.hidden = !u;
    if (u) img.src = u;
    tHapus.hidden = !path;
    if (!path) info.textContent = "Belum ada gambar. Seret ke sini atau tekan Ctrl+V.";
  }
  // gambar yang diunggah pada sesi ini dan diganti/dihapus langsung dibuang dari storage
  function lepasLama() {
    if (path && sesi.baru.some((b) => b.path === path)) {
      hapusGambar(bucket, [path]).catch(() => {});
      sesi.baru = sesi.baru.filter((b) => b.path !== path);
    }
  }
  async function terima(file) {
    const err = periksaGambar(file);
    if (err) { info.textContent = err; return; }
    info.textContent = "Mengecilkan dan mengunggah…";
    area.setAttribute("aria-busy", "true");
    try {
      const blob = await kecilkanGambar(file);
      const baru = await unggahGambar(bucket, blob);
      sesi.baru.push({ bucket, path: baru });
      lepasLama();
      path = baru;
      if (urlLokal) URL.revokeObjectURL(urlLokal);
      urlLokal = URL.createObjectURL(blob);
      urlSimpan = null;
      info.textContent = "Gambar siap.";
      tampil();
      saatUbah();
    } catch (e) { info.textContent = (e && e.message) || "Gagal mengunggah gambar."; }
    finally { area.removeAttribute("aria-busy"); }
  }
  function hapus() {
    lepasLama();
    path = null;
    if (urlLokal) { URL.revokeObjectURL(urlLokal); urlLokal = null; }
    urlSimpan = null;
    tampil();
    saatUbah();
  }
  input.addEventListener("change", () => { if (input.files[0]) terima(input.files[0]); input.value = ""; });
  area.addEventListener("dragover", (e) => { e.preventDefault(); area.classList.add("seret"); });
  area.addEventListener("dragleave", () => area.classList.remove("seret"));
  area.addEventListener("drop", (e) => { e.preventDefault(); area.classList.remove("seret"); if (e.dataTransfer.files[0]) terima(e.dataTransfer.files[0]); });
  if (pathAwal) urlGambar(bucket, pathAwal).then((u) => { urlSimpan = u; tampil(); }).catch(() => {});
  tampil();
  return { el: area, ambilPath: () => path, ambilUrl: () => urlLokal || urlSimpan, terima, lepas: lepasLama };
}