// ANORA admin — absensi-input.js (mengabsen banyak siswa sekaligus)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { semuaSiswa } from "../api.js";
import { h, ganti, ikon, elMemuat, elGalat, elKosong, hariIniJakarta, tambahHari, namaHari, tanggalPendek, tanggalPanjang } from "../ui.js";
import { kolom, segmen, konfirmasi, toast, setKotor } from "../widget.js";
import { HARI, STATUS_ABSEN, validasiAbsensi } from "../util.js";

export async function tampilInput(wadah, ctx) {
  ganti(wadah, elMemuat());
  let siswa, saran = [];
  try { siswa = (await semuaSiswa()).filter((s) => s.is_active); }
  catch (e) { ganti(wadah, elGalat(pesanGalat(e), () => tampilInput(wadah, ctx))); return; }
  try {
    const t = await ambil(supabase.from("attendance").select("topic").order("date", { ascending: false }).limit(300));
    saran = [...new Set(t.map((x) => x.topic).filter(Boolean))].slice(0, 40);
  } catch { /* saran topik hanya tambahan */ }
  if (!ctx.aktif()) return;
  if (!siswa.length) {
    ganti(wadah, elKosong("Belum ada siswa aktif", "Tambahkan siswa dulu sebelum mengabsen.", "orang", h("a", { class: "tombol tombol-utama", href: "#/siswa/tambah" }, "Tambah siswa")));
    return;
  }

  const st = new Map(siswa.map((s) => [s.id, { pilih: false, status: null, catatan: "" }]));
  let sudah = new Map(); // student_id -> [status, ...] pada tanggal terpilih
  let modeDup = "lewati";
  let sibuk = false;

  // ---- bagian sesi ----
  const t = kolom({ label: "Tanggal", tipe: "date", nilai: hariIniJakarta() });
  const hr = kolom({ label: "Hari", pilihan: HARI.map((x) => [x, x]), nilai: namaHari(hariIniJakarta()) });
  const tp = kolom({ label: "Materi / topik sesi", atribut: { maxlength: 150, autocomplete: "off", list: "saran-topik" } });
  const dl = h("datalist", { id: "saran-topik" }, saran.map((x) => h("option", { value: x })));
  const cs = kolom({ label: "Catatan sesi (berlaku untuk semua)", jenis: "textarea", atribut: { rows: 2, maxlength: 500 }, bantuan: "Opsional, maksimal 500 karakter." });
  const peringatan = h("p", { class: "peringatan-kolom", role: "status" });
  peringatan.hidden = true;

  function cek() {
    const tg = t.kontrol.value, msg = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(tg)) {
      if (namaHari(tg) !== hr.kontrol.value) msg.push(`${tanggalPendek(tg)} jatuh pada hari ${namaHari(tg)}.`);
      if (tg > tambahHari(hariIniJakarta(), 1)) msg.push("Tanggal ini lebih dari 1 hari ke depan. Pastikan sudah benar.");
    }
    peringatan.textContent = msg.join(" "); peringatan.hidden = !msg.length;
  }
  t.kontrol.addEventListener("change", () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(t.kontrol.value)) hr.kontrol.value = namaHari(t.kontrol.value);
    cek(); muatSudah();
  });
  hr.kontrol.addEventListener("change", cek);
  [tp.kontrol, cs.kontrol].forEach((k) => k.addEventListener("input", ubah));

  // ---- daftar siswa ----
  const kCari = kolom({ label: "Cari siswa", tipe: "search", atribut: { autocomplete: "off" } });
  const kKelas = kolom({ label: "Kelas", pilihan: [["", "Semua kelas"], ...[1, 2, 3, 4, 5, 6].map((n) => [String(n), "Kelas " + n])] });
  const ul = h("ul", { class: "daftar-polos" });
  const ringkas = h("p", { role: "status" });
  const kotakDup = h("div", { hidden: true },
    h("p", { class: "kotak-peringatan" }, "Sebagian siswa sudah punya absensi pada tanggal ini. Pilih tindakan:"),
    (() => { const s = segmen({ label: "Siswa yang sudah diabsen", pilihan: [["lewati", "Lewati"], ["lagi", "Tambahkan lagi"]], nilai: "lewati", saatUbah: (v) => { modeDup = v; s.set(v); } }); return s.el; })());
  const tombolSimpan = h("button", { type: "button", class: "tombol tombol-utama", onclick: () => simpan() }, "Simpan absensi");

  const tampilkan = () => {
    const c = kCari.kontrol.value.trim().toLowerCase(), k = kKelas.kontrol.value;
    return siswa.filter((s) => (!k || String(s.grade) === k) && (!c || s.child_name.toLowerCase().includes(c) || s.username.includes(c) || (s.parent_name || "").toLowerCase().includes(c)));
  };

  function baris(s) {
    const d = st.get(s.id);
    const cb = h("input", { type: "checkbox", id: "cb-" + s.id });
    cb.checked = d.pilih;
    cb.addEventListener("change", () => { d.pilih = cb.checked; ubah(); });
    const sg = segmen({ label: "Status " + s.child_name, pilihan: STATUS_ABSEN.map((x) => [x, x]), nilai: d.status, saatUbah: (v) => {
      d.status = d.status === v ? null : v;
      if (d.status) { d.pilih = true; cb.checked = true; }
      sg.set(d.status); ubah();
    } });
    const cat = h("input", { type: "text", maxlength: 500, placeholder: "Catatan untuk " + s.child_name, "aria-label": "Catatan untuk " + s.child_name, value: d.catatan });
    cat.hidden = !d.catatan;
    cat.addEventListener("input", () => { d.catatan = cat.value; ubah(); });
    const tb = h("button", { type: "button", class: "ikon-tombol", "aria-label": "Catatan untuk " + s.child_name, onclick: () => { cat.hidden = !cat.hidden; if (!cat.hidden) cat.focus(); } }, ikon("edit"));
    const pernah = sudah.get(s.id);
    return h("li", { class: "baris-siswa" },
      h("div", { class: "bs-kiri" }, cb, h("label", { for: cb.id }, h("strong", {}, s.child_name), ` · Kelas ${s.grade}`),
        pernah ? h("span", { class: "badge b-kuning" }, "Sudah diabsen: " + pernah.join(", ")) : null),
      h("div", { class: "bs-aksi" }, sg.el, tb),
      h("div", { class: "bs-cat" }, cat));
  }
  function gambar() {
    const t2 = tampilkan();
    ul.replaceChildren(...(t2.length ? t2.map(baris) : [h("li", {}, "Tidak ada siswa yang cocok.")]));
    kotakDup.hidden = ![...sudah.keys()].length;
    ubah();
  }
  function ubah() {
    const n = [...st.values()].filter((d) => d.pilih && d.status).length;
    ringkas.textContent = `${n} siswa siap disimpan`;
    setKotor(n > 0);
  }
  async function muatSudah() {
    const tg = t.kontrol.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tg)) return;
    try {
      const r = await ambil(supabase.from("attendance").select("student_id,status").eq("date", tg).limit(1000));
      if (tg !== t.kontrol.value) return;
      sudah = new Map();
      r.forEach((x) => sudah.set(x.student_id, [...(sudah.get(x.student_id) || []), x.status]));
      gambar();
    } catch (e) { toast(pesanGalat(e), "galat"); }
  }

  const massal = h("div", { class: "aksi-baris", style: "margin:.75rem 0" },
    h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => { tampilkan().forEach((s) => { const d = st.get(s.id); d.status = "Hadir"; d.pilih = true; }); gambar(); } }, "Tandai semua Hadir"),
    h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => { tampilkan().forEach((s) => { st.get(s.id).pilih = true; }); gambar(); } }, "Pilih semua hasil filter"),
    h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => { st.forEach((d) => { d.pilih = false; d.status = null; d.catatan = ""; }); gambar(); } }, "Kosongkan"));
  [kCari.kontrol, kKelas.kontrol].forEach((k) => k.addEventListener("input", gambar));

  async function simpan() {
    if (sibuk) return;
    const { galat, nilai } = validasiAbsensi({ date: t.kontrol.value, day: hr.kontrol.value, status: "Hadir", topic: tp.kontrol.value, notes: cs.kontrol.value });
    t.setGalat(galat.date); hr.setGalat(galat.day); tp.setGalat(galat.topic); cs.setGalat(galat.notes);
    if (galat.date || galat.day || galat.topic || galat.notes) { (galat.date ? t : galat.day ? hr : galat.topic ? tp : cs).kontrol.focus(); return; }

    const dipilih = siswa.filter((s) => { const d = st.get(s.id); return d.pilih && d.status; });
    const target = dipilih.filter((s) => modeDup === "lagi" || !sudah.has(s.id));
    const dilewati = dipilih.length - target.length;
    if (!target.length) { toast("Belum ada siswa yang dicentang dan diberi status.", "info"); return; }
    const rows = [];
    for (const s of target) {
      const d = st.get(s.id);
      const cat = [nilai.notes, d.catatan.trim()].filter(Boolean).join(" | ");
      if (cat.length > 500) { toast(`Catatan untuk ${s.child_name} terlalu panjang (maksimal 500 karakter).`, "galat"); return; }
      rows.push({ student_id: s.id, date: nilai.date, day: nilai.day, status: d.status, topic: nilai.topic, notes: cat || null });
    }
    const hitung = STATUS_ABSEN.map((x) => [x, rows.filter((r) => r.status === x).length]).filter(([, n]) => n);
    const ya = await konfirmasi({
      judul: "Simpan absensi?",
      isi: [h("p", {}, `${rows.length} siswa: ${hitung.map(([x, n]) => `${n} ${x}`).join(", ")}`),
        h("p", { class: "lembut" }, `${nilai.day}, ${tanggalPanjang(nilai.date)} · ${nilai.topic}`),
        dilewati ? h("p", { class: "lembut" }, `${dilewati} siswa dilewati karena sudah diabsen.`) : null],
      ya: "Simpan",
    });
    if (!ya) return;
    sibuk = true; tombolSimpan.disabled = true;
    try {
      await ambil(supabase.from("attendance").insert(rows));
      toast(`${rows.length} absensi tersimpan`);
      st.forEach((d) => { d.pilih = false; d.status = null; d.catatan = ""; });
      setKotor(false);
      await muatSudah();
    } catch { toast("Gagal menyimpan absensi, coba lagi.", "galat"); }
    finally { sibuk = false; tombolSimpan.disabled = false; }
  }

  ganti(wadah, h("div", { class: "halaman" },
    h("section", { class: "kartu", "aria-labelledby": "jdl-sesi-abs" },
      h("h2", { id: "jdl-sesi-abs" }, "Data sesi"),
      h("div", { class: "grid-form dua" }, t.el, hr.el, h("div", { style: "grid-column:1/-1" }, peringatan), tp.el, cs.el), dl),
    h("section", { "aria-labelledby": "jdl-daftar-abs" },
      h("h2", { id: "jdl-daftar-abs" }, "Siswa"),
      h("div", { class: "filter" }, kCari.el, kKelas.el),
      kotakDup, massal, ul),
    h("div", { class: "sticky-simpan" }, ringkas, tombolSimpan)));
  cek(); gambar(); await muatSudah();
}