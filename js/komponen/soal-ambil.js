// ANORA admin — soal-ambil.js (ambil soal dari beberapa bab latihan untuk dimasukkan ke try out)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { h, ganti } from "../ui.js";
import { kolom, dialog, toast } from "../widget.js";
import { potong } from "../util.js";
import { muatSoal, simpanSoal, pesanRpc } from "./soal-api.js";
import { keItemRpc } from "./soal-parse.js";

export async function bukaAmbil({ tryoutId, mapelId, saat }) {
  let mapel = [];
  try { mapel = await ambil(supabase.from("subjects").select("id,name").order("name")); }
  catch (e) { toast(pesanGalat(e), "galat"); return; }
  const kKelas = kolom({ label: "Kelas sumber", pilihan: [1, 2, 3, 4, 5, 6].map((n) => [String(n), "Kelas " + n]), nilai: "6" });
  const kMapel = kolom({ label: "Mata pelajaran", pilihan: mapel.map((m) => [m.id, m.name]), nilai: mapelId });
  const babWadah = h("div"), soalWadah = h("div");
  const tombol = h("button", { type: "button", class: "tombol tombol-utama", disabled: true }, "Ambil soal terpilih");
  let bab = [], babDipilih = new Set(), soalBab = new Map(), terpilih = new Set(), sibuk = false;

  const d = dialog({
    judul: "Ambil dari soal latihan", lebar: true,
    isi: [h("div", { class: "grid-form dua" }, kKelas.el, kMapel.el),
      h("h3", {}, "1. Pilih bab"), babWadah, h("h3", { style: "margin-top:1rem" }, "2. Centang soal"), soalWadah,
      h("div", { class: "dlg-aksi" }, h("button", { type: "button", class: "tombol tombol-garis", onclick: () => d.minta() }, "Batal"), tombol)],
    tanyaTutup: async () => !sibuk,
  });
  d.el.classList.add("sangat-lebar");

  function ringkasTombol() { tombol.disabled = !terpilih.size || sibuk; tombol.textContent = `Ambil ${terpilih.size} soal`; }

  async function muatBab() {
    ganti(babWadah, h("p", { class: "lembut", role: "status" }, "Memuat bab…"));
    babDipilih = new Set(); soalBab = new Map(); terpilih = new Set(); gambarSoal();
    try {
      bab = await ambil(supabase.from("admin_material_overview").select("id,title,question_count")
        .eq("grade", Number(kKelas.kontrol.value)).eq("subject_id", kMapel.kontrol.value).gt("question_count", 0).order("position"));
    } catch (e) { toast(pesanGalat(e), "galat"); bab = []; }
    gambarBab();
  }
  function gambarBab() {
    if (!bab.length) { ganti(babWadah, h("p", { class: "lembut" }, "Tidak ada bab yang punya soal latihan untuk pilihan ini.")); return; }
    ganti(babWadah, h("ul", { class: "daftar-polos" }, bab.map((b) => {
      const cb = h("input", { type: "checkbox", id: "ab-" + b.id });
      cb.checked = babDipilih.has(b.id);
      cb.addEventListener("change", async () => {
        if (cb.checked) babDipilih.add(b.id); else { babDipilih.delete(b.id); (soalBab.get(b.id) || []).forEach((s) => terpilih.delete(s.id)); }
        if (cb.checked && !soalBab.has(b.id)) {
          try { const s = await muatSoal(b.id); soalBab.set(b.id, s); s.forEach((x) => terpilih.add(x.id)); }
          catch (e) { toast(pesanGalat(e), "galat"); babDipilih.delete(b.id); cb.checked = false; }
        } else if (cb.checked) (soalBab.get(b.id) || []).forEach((s) => terpilih.add(s.id));
        gambarSoal();
      });
      return h("li", {}, cb, h("label", { for: cb.id, style: "margin:0" }, `${b.title} (${b.question_count} soal)`));
    })));
  }
  function gambarSoal() {
    ringkasTombol();
    const aktif = bab.filter((b) => babDipilih.has(b.id) && soalBab.has(b.id));
    if (!aktif.length) { ganti(soalWadah, h("p", { class: "lembut" }, "Centang bab di atas untuk melihat soalnya.")); return; }
    ganti(soalWadah, aktif.map((b) => h("section", { style: "margin-bottom:1rem" },
      h("h4", { style: "margin:.25rem 0" }, b.title),
      h("ul", { class: "daftar-polos" }, soalBab.get(b.id).map((s, i) => {
        const cb = h("input", { type: "checkbox", id: "as-" + s.id });
        cb.checked = terpilih.has(s.id);
        cb.addEventListener("change", () => { if (cb.checked) terpilih.add(s.id); else terpilih.delete(s.id); ringkasTombol(); });
        return h("li", {}, cb, h("label", { for: cb.id, style: "margin:0" }, h("strong", {}, `${i + 1}. `), potong(s.teks.replace(/\s+/g, " ") || "(soal bergambar)", 100), ` · Kunci ${s.kunci || "?"}`));
      })))));
  }

  kKelas.kontrol.addEventListener("change", muatBab);
  kMapel.kontrol.addEventListener("change", muatBab);
  tombol.addEventListener("click", async () => {
    const pilih = [];
    for (const b of bab) if (babDipilih.has(b.id)) for (const s of soalBab.get(b.id) || []) if (terpilih.has(s.id)) pilih.push(s);
    if (!pilih.length) return;
    sibuk = true; ringkasTombol();
    try {
      await simpanSoal({ id: tryoutId, jenis: "tryout" }, false, pilih.map((s) => keItemRpc({ ...s, id: undefined })));
      sibuk = false; d.tutup(); toast(`${pilih.length} soal diambil ke try out`); saat();
    } catch (e) { sibuk = false; ringkasTombol(); toast(pesanRpc(e), "galat"); }
  });
  await muatBab();
}