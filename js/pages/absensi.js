// ANORA admin — absensi.js (menu Absensi: mode Input sesi dan Riwayat)
import { h, ganti } from "../ui.js";
import { tabs, konfirmasi, setKotor, status } from "../widget.js";
import { tampilInput } from "../komponen/absensi-input.js";
import { tampilRiwayat } from "../komponen/absensi-riwayat.js";

export async function tampil(wadah, ctx) {
  let mode = ctx.query.get("mode") === "riwayat" ? "riwayat" : "input";
  const panel = h("div", { role: "tabpanel" });
  const t = tabs({ label: "Mode absensi", daftar: [["input", "Input sesi"], ["riwayat", "Riwayat"]], awal: mode, saatPilih: pilih });
  ganti(wadah, h("div", { class: "halaman" }, t.el, panel));

  async function pilih(m) {
    if (m === mode) return;
    if (status.kotor && !(await konfirmasi({ judul: "Absensi belum disimpan", isi: "Isian absensi yang belum disimpan akan hilang jika Anda pindah ke Riwayat.", ya: "Pindah", bahaya: true }))) return;
    setKotor(false);
    mode = m; t.set(m);
    ctx.gantiHash("#/absensi?mode=" + m);
    await muat();
  }
  async function muat() {
    panel.setAttribute("aria-labelledby", "tab-" + mode);
    await (mode === "input" ? tampilInput : tampilRiwayat)(panel, ctx);
  }
  await muat();
}