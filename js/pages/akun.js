// ANORA admin — akun.js (halaman Akun & Password)
import { h, ganti } from "../ui.js";
import { tampilReset } from "../komponen/akun-reset.js";

export async function tampil(wadah, ctx) {
  const isi = h("div");
  ganti(wadah, isi);
  await tampilReset(isi, { siswaAwalId: ctx.query.get("siswa"), aktif: ctx.aktif });
}