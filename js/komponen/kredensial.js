// ANORA admin — kredensial.js (jendela username + password yang tampil SEKALI)
import { h, ikon } from "../ui.js";
import { dialog, toast } from "../widget.js";
import { salin, linkWA } from "../util.js";

export function bukaKredensial({ judul, pengantar, username, password, labelSandi = "Password", nomorWA, pesanWA, aksi = [] }) {
  let sandi = password;
  const baris = (label, nilai) => h("div", { class: "kred-baris" },
    h("span", { class: "label-kecil" }, label),
    h("code", { class: "kred-nilai" }, nilai),
    h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: async () => {
      toast((await salin(nilai)) ? `${label} disalin` : "Gagal menyalin", (await salin(nilai)) ? "ok" : "galat");
    } }, ikon("salin", 16), "Salin"));

  const tombolAksi = aksi.map((a) => h("button", { type: "button", class: "tombol " + (a.gaya || "tombol-garis"), onclick: () => { d.tutup(); a.saatKlik(); } }, a.teks));
  const wa = nomorWA
    ? h("a", { class: "tombol tombol-emas", href: linkWA(nomorWA, pesanWA), target: "_blank", rel: "noopener noreferrer" }, ikon("wa", 18), "Kirim ke orang tua via WhatsApp")
    : null;

  const d = dialog({
    judul,
    isi: [
      pengantar ? h("p", {}, pengantar) : null,
      baris("Username", username),
      baris(labelSandi, sandi),
      h("p", { class: "kotak-peringatan" }, "Password tidak bisa dilihat lagi setelah jendela ini ditutup. Password tidak disimpan di sistem."),
      h("div", { class: "dlg-aksi" }, wa, ...tombolAksi, h("button", { type: "button", class: "tombol tombol-utama", onclick: () => d.tutup() }, "Selesai")),
    ],
    // Saat ditutup: kosongkan isi jendela agar password tidak tersisa di halaman
    saatTutup: () => { d.badan.replaceChildren(); sandi = null; },
  });
  return d;
}