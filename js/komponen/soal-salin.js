// ANORA admin — soal-salin.js (salin soal dari bab lain)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { h, ikon, ganti } from "../ui.js";
import { kolom, dialog, toast } from "../widget.js";
import { potong } from "../util.js";
import { muatSoal, simpanSoal, pesanRpc } from "./soal-api.js";
import { keItemRpc } from "./soal-parse.js";

export async function bukaSalin({ materialId, kelas, mapelId, saat }) {
  let mapel = [];
  try { mapel = await ambil(supabase.from("subjects").select("id,name").order("name")); }
  catch (e) { toast(pesanGalat(e), "galat"); return; }
  const kKelas = kolom({ label: "Kelas", pilihan: [1, 2, 3, 4, 5, 6].map((n) => [String(n), "Kelas " + n]), nilai: String(kelas) });
  const kMapel = kolom({ label: "Mata pelajaran", pilihan: mapel.map((m) => [m.id, m.name]), nilai: mapelId });
  const kBab = kolom({ label: "Bab sumber", pilihan: [["", "Pilih bab…"]] });
  const daftar = h("div");
  const tombol = h("button", { type: "button", class: "tombol tombol-utama", disabled: true }, "Salin soal terpilih");
  let soal = [], terpilih = new Set(), sibuk = false;

  const d = dialog({
    judul: "Salin soal dari bab lain", lebar: true,
    isi: [h("div", { class: "grid-form dua" }, kKelas.el, kMapel.el), kBab.el, daftar,
      h("div", { class: "dlg-aksi" }, h("button", { type: "button", class: "tombol tombol-garis", onclick: () => d.minta() }, "Batal"), tombol)],
    tanyaTutup: async () => !sibuk,
  });

  async function muatBab() {
    kBab.kontrol.replaceChildren(h("option", { value: "" }, "Memuat…"));
    try {
      const r = await ambil(supabase.from("admin_material_overview").select("id,title,question_count")
        .eq("grade", Number(kKelas.kontrol.value)).eq("subject_id", kMapel.kontrol.value).neq("id", materialId).order("position"));
      kBab.kontrol.replaceChildren(h("option", { value: "" }, r.length ? "Pilih bab…" : "Tidak ada bab lain"),
        ...r.map((b) => h("option", { value: b.id }, `${b.title} (${b.question_count} soal)`)));
    } catch (e) { toast(pesanGalat(e), "galat"); }
    soal = []; terpilih = new Set(); gambar();
  }
  async function muatSoalBab() {
    const id = kBab.kontrol.value;
    soal = []; terpilih = new Set();
    if (!id) { gambar(); return; }
    ganti(daftar, h("p", { class: "lembut", role: "status" }, "Memuat soal…"));
    try { soal = await muatSoal(id); terpilih = new Set(soal.map((s) => s.id)); } catch (e) { toast(pesanGalat(e), "galat"); }
    gambar();
  }
  function gambar() {
    tombol.disabled = !terpilih.size || sibuk;
    tombol.textContent = `Salin ${terpilih.size} soal`;
    if (!soal.length) { ganti(daftar, h("p", { class: "lembut" }, kBab.kontrol.value ? "Bab ini belum punya soal." : "Pilih bab sumber untuk melihat soalnya.")); return; }
    const semua = h("input", { type: "checkbox", id: "salin-semua" });
    semua.checked = terpilih.size === soal.length;
    semua.addEventListener("change", () => { terpilih = semua.checked ? new Set(soal.map((s) => s.id)) : new Set(); gambar(); });
    ganti(daftar,
      h("label", { class: "radio-kunci", for: "salin-semua" }, semua, "Pilih semua"),
      h("ul", { class: "daftar-polos" }, soal.map((s, i) => {
        const cb = h("input", { type: "checkbox", id: "salin-" + s.id });
        cb.checked = terpilih.has(s.id);
        cb.addEventListener("change", () => { if (cb.checked) terpilih.add(s.id); else terpilih.delete(s.id); gambar(); });
        return h("li", {}, cb, h("label", { for: cb.id, style: "margin:0" }, h("strong", {}, `${i + 1}. `), potong(s.teks.replace(/\s+/g, " ") || "(soal bergambar)", 110), ` · Kunci ${s.kunci || "?"}`));
      })));
  }
  kKelas.kontrol.addEventListener("change", muatBab);
  kMapel.kontrol.addEventListener("change", muatBab);
  kBab.kontrol.addEventListener("change", muatSoalBab);
  tombol.addEventListener("click", async () => {
    const pilih = soal.filter((s) => terpilih.has(s.id));
    if (!pilih.length) return;
    sibuk = true; tombol.disabled = true;
    try {
      await simpanSoal(materialId, false, pilih.map((s) => keItemRpc({ ...s, id: undefined })));
      sibuk = false; d.tutup(); toast(`${pilih.length} soal disalin`); saat();
    } catch (e) { sibuk = false; gambar(); toast(pesanRpc(e), "galat"); }
  });
  await muatBab();
}