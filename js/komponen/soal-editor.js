// ANORA admin — soal-editor.js (editor satu soal + pratinjau tampilan siswa)
import { h, ikon } from "../ui.js";
import { kolom, dialog, konfirmasi, toast } from "../widget.js";
import { renderTeksRumus } from "../rumus.js";
import { debounce } from "../util.js";
import { slotGambar } from "./slot-gambar.js";
import { BUCKET_SOAL, BUCKET_BAHAS, hapusGambar, bersihkanTakTerpakai } from "../gambar.js";
import { validasiSoal, keItemRpc, HURUF } from "./soal-parse.js";
import { simpanSoal, pesanRpc } from "./soal-api.js";

export function bukaEditor({ materialId, item, saat }) {
  const sesi = { baru: [] };
  const awal = item || { teks: "", gambarSoal: null, opsi: [{ id: "A", teks: "", gambar: null }, { id: "B", teks: "", gambar: null }], kunci: null, bahas: "", gambarBahas: null };
  let kotor = false, sibuk = false, tersimpan = false, slotAktif = null;
  const tandai = () => { kotor = true; gambarPv(); };
  const pv = debounce(() => gambarPvLangsung(), 150);
  const gambarPv = () => pv();

  // ----- soal -----
  const kTeks = kolom({ label: "Teks soal", jenis: "textarea", atribut: { rows: 4, maxlength: 2000 }, nilai: awal.teks,
    bantuan: "Rumus ditulis dengan $...$, contoh $\\frac{1}{2}$ atau $x^2$. Gunakan \\$ untuk tanda dolar biasa." });
  const slotSoal = slotGambar({ label: "Gambar soal", bucket: BUCKET_SOAL, pathAwal: awal.gambarSoal, sesi, saatUbah: tandai });
  const grupSoal = h("div", {}, kTeks.el, h("p", { class: "label-kecil" }, "Gambar soal (opsional)"), slotSoal.el);

  // ----- opsi -----
  const namaRadio = "kunci" + Date.now();
  const barisOpsi = [];
  const daftarOpsi = h("ul", { class: "daftar-polos" });
  const tombolTambah = h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => { tambahOpsi({ teks: "", gambar: null }); tandai(); } }, ikon("tambah", 16), "Tambah opsi");
  function nomori() {
    barisOpsi.forEach((b, i) => {
      b.huruf.textContent = HURUF[i];
      b.radio.setAttribute("aria-label", `Jadikan opsi ${HURUF[i]} sebagai kunci jawaban`);
      b.teks.setAttribute("aria-label", `Teks opsi ${HURUF[i]}`);
      b.hapus.hidden = barisOpsi.length <= 2;
      b.hapus.setAttribute("aria-label", `Hapus opsi ${HURUF[i]}`);
    });
    tombolTambah.hidden = barisOpsi.length >= 5;
  }
  function tambahOpsi(d) {
    const radio = h("input", { type: "radio", name: namaRadio });
    const teks = h("input", { type: "text", maxlength: 500, placeholder: "Teks opsi (boleh berisi rumus $...$)" });
    teks.value = d.teks || "";
    const slot = slotGambar({ label: "Gambar opsi", bucket: BUCKET_SOAL, pathAwal: d.gambar, sesi, saatUbah: tandai, kompak: true });
    const huruf = h("span", { class: "huruf-opsi" });
    const hapus = h("button", { type: "button", class: "ikon-tombol", onclick: () => {
      if (barisOpsi.length <= 2) return;
      slot.lepas();
      barisOpsi.splice(barisOpsi.indexOf(b), 1);
      li.remove(); nomori(); tandai();
    } }, ikon("sampah", 18));
    const li = h("li", { class: "opsi-editor" },
      h("div", { class: "opsi-atas" }, huruf, teks, h("label", { class: "radio-kunci" }, radio, "Kunci"), hapus), slot.el);
    li.addEventListener("focusin", () => { slotAktif = slot; });
    const b = { radio, teks, slot, huruf, hapus };
    barisOpsi.push(b);
    daftarOpsi.append(li);
    radio.addEventListener("change", tandai);
    teks.addEventListener("input", tandai);
    nomori();
    return b;
  }
  awal.opsi.forEach((o) => tambahOpsi(o));
  const idxKunci = awal.kunci ? HURUF.indexOf(awal.kunci) : -1;
  if (idxKunci >= 0 && barisOpsi[idxKunci]) barisOpsi[idxKunci].radio.checked = true;

  // ----- pembahasan -----
  const kBahas = kolom({ label: "Pembahasan (teks)", jenis: "textarea", atribut: { rows: 3, maxlength: 4000 }, nilai: awal.bahas });
  const slotBahas = slotGambar({ label: "Gambar pembahasan", bucket: BUCKET_BAHAS, pathAwal: awal.gambarBahas, sesi, saatUbah: tandai });
  const grupBahas = h("div", {}, kBahas.el, h("p", { class: "label-kecil" }, "Gambar pembahasan (opsional)"), slotBahas.el);
  grupSoal.addEventListener("focusin", () => { slotAktif = slotSoal; });
  grupBahas.addEventListener("focusin", () => { slotAktif = slotBahas; });
  [kTeks.kontrol, kBahas.kontrol].forEach((k) => k.addEventListener("input", tandai));

  function kumpul() {
    const idx = barisOpsi.findIndex((b) => b.radio.checked);
    return {
      id: item && item.id, teks: kTeks.kontrol.value.trim(), gambarSoal: slotSoal.ambilPath(),
      opsi: barisOpsi.map((b, i) => ({ id: HURUF[i], teks: b.teks.value.trim(), gambar: b.slot.ambilPath() })),
      kunci: idx >= 0 ? HURUF[idx] : null, _kunciMentah: "", bahas: kBahas.kontrol.value.trim(),
      gambarBahas: slotBahas.ambilPath(), refGambar: "", refBahas: "",
    };
  }

  // ----- pratinjau -----
  const pvKotak = h("div", { class: "pv" });
  function gambarPvLangsung() {
    const d = kumpul();
    const img = (u, alt) => (u ? h("img", { class: "pv-gambar", src: u, alt }) : null);
    ganti2(pvKotak,
      h("p", { class: "pv-label" }, "Pratinjau tampilan siswa"),
      h("div", { class: "teks-soal", style: "font-weight:700" }, renderTeksRumus(d.teks)),
      img(slotSoal.ambilUrl(), "Gambar soal"),
      d.opsi.map((o, i) => h("div", { class: "pv-kartu" + (d.kunci === o.id ? " pv-kunci" : "") },
        h("span", { class: "pv-huruf" }, o.id),
        h("span", { style: "flex:1;min-width:0" }, h("span", { class: "teks-soal" }, renderTeksRumus(o.teks)), img(barisOpsi[i].slot.ambilUrl(), "Gambar pilihan " + o.id)),
        d.kunci === o.id ? h("span", { class: "badge b-hijau" }, ikon("centang", 16), "Kunci") : null)),
      d.bahas || d.gambarBahas ? h("div", { class: "pv-bahas" }, h("strong", {}, "Pembahasan"), h("div", { class: "teks-soal" }, renderTeksRumus(d.bahas)), img(slotBahas.ambilUrl(), "Gambar pembahasan")) : null);
  }
  const ganti2 = (w, ...isi) => w.replaceChildren(...isi.flat().filter(Boolean));

  // ----- tempel gambar (Ctrl+V) -----
  function saatPaste(e) {
    const f = [...((e.clipboardData && e.clipboardData.files) || [])].find((x) => x.type.startsWith("image/"));
    if (!f) return;
    e.preventDefault();
    (slotAktif || slotSoal).terima(f);
  }
  document.addEventListener("paste", saatPaste);

  // ----- dialog -----
  const kotakGalat = h("ul", { class: "galat-daftar", role: "alert" });
  kotakGalat.hidden = true;
  const simpan = h("button", { type: "button", class: "tombol tombol-utama" }, "Simpan soal");
  const batal = h("button", { type: "button", class: "tombol tombol-garis", onclick: () => d.minta() }, "Batal");
  const kiri = h("div", {}, grupSoal,
    h("h3", { style: "margin-top:1rem" }, "Pilihan jawaban"),
    h("p", { class: "bantuan" }, "Minimal 2, maksimal 5. Pilih satu sebagai kunci. Opsi boleh berisi teks dan/atau gambar."),
    daftarOpsi, tombolTambah, h("h3", { style: "margin-top:1rem" }, "Pembahasan"), grupBahas);
  const d = dialog({
    judul: item ? "Ubah soal" : "Tambah soal", lebar: true,
    isi: [h("div", { class: "editor-grid" }, kiri, h("div", { class: "pv-sisi" }, pvKotak)), kotakGalat, h("div", { class: "dlg-aksi" }, batal, simpan)],
    tanyaTutup: async () => {
      if (sibuk) return false;
      return !kotor || konfirmasi({ judul: "Tutup tanpa menyimpan?", isi: "Perubahan pada soal ini akan hilang.", ya: "Tutup", bahaya: true });
    },
    saatTutup: () => {
      document.removeEventListener("paste", saatPaste);
      if (!tersimpan) {
        hapusGambar(BUCKET_SOAL, sesi.baru.filter((x) => x.bucket === BUCKET_SOAL).map((x) => x.path)).catch(() => {});
        hapusGambar(BUCKET_BAHAS, sesi.baru.filter((x) => x.bucket === BUCKET_BAHAS).map((x) => x.path)).catch(() => {});
      }
    },
  });
  d.el.classList.add("sangat-lebar");
  gambarPvLangsung();

  simpan.addEventListener("click", async () => {
    const it = kumpul();
    const masalah = validasiSoal(it);
    if (masalah.length) {
      kotakGalat.replaceChildren(...masalah.map((t) => h("li", {}, ikon("peringatan", 18), t)));
      kotakGalat.hidden = false;
      return;
    }
    kotakGalat.hidden = true;
    sibuk = true; simpan.disabled = true;
    try {
      await simpanSoal(materialId, false, [keItemRpc(it)]);
      tersimpan = true; kotor = false;
      const akhirSoal = new Set([it.gambarSoal, ...it.opsi.map((o) => o.gambar)].filter(Boolean));
      const akhirBahas = new Set([it.gambarBahas].filter(Boolean));
      const awalSoal = [awal.gambarSoal, ...awal.opsi.map((o) => o.gambar)].filter(Boolean);
      bersihkanTakTerpakai(BUCKET_SOAL, awalSoal.filter((p) => !akhirSoal.has(p))).catch(() => {});
      bersihkanTakTerpakai(BUCKET_BAHAS, [awal.gambarBahas].filter((p) => p && !akhirBahas.has(p))).catch(() => {});
      sibuk = false;
      d.tutup();
      toast(item ? "Soal diperbarui" : "Soal ditambahkan");
      saat();
    } catch (e) { sibuk = false; simpan.disabled = false; toast(pesanRpc(e), "galat"); }
  });
}