// ANORA admin — siswa-tambah.js (form tambah siswa + dialog sukses)
import { supabase, ambil } from "../supabase.js";
import { panggilFungsi, pesanFungsi } from "../api.js";
import { h, ikon, ganti } from "../ui.js";
import { kolom, kolomSandi, toast, setKotor } from "../widget.js";
import { debounce, usernameValid, sarankanUsername, validasiDataSiswa, passwordAcak, salin, pesanAkunBaru, STATUS_BAYAR } from "../util.js";
import { bukaKredensial } from "../komponen/kredensial.js";

export async function tampil(wadah, ctx) {
  const k = {
    child_name: kolom({ label: "Nama anak", atribut: { maxlength: 60, autocomplete: "off" } }),
    parent_name: kolom({ label: "Nama orang tua", atribut: { maxlength: 60, autocomplete: "off" } }),
    whatsapp: kolom({ label: "WhatsApp orang tua", tipe: "tel", atribut: { inputmode: "tel", maxlength: 20, autocomplete: "off" }, bantuan: "Contoh: 0812-3456-7890. Otomatis diubah ke format 62…" }),
    school_origin: kolom({ label: "Asal sekolah", atribut: { maxlength: 100, autocomplete: "off" } }),
    grade: kolom({ label: "Kelas", pilihan: [["", "Pilih kelas"], ...[1, 2, 3, 4, 5, 6].map((n) => [String(n), "Kelas " + n])] }),
    username: kolom({ label: "Username", atribut: { maxlength: 30, autocomplete: "off", autocapitalize: "none", spellcheck: "false" }, bantuan: "Huruf kecil, angka, titik, garis bawah, minus. 3–30 karakter." }),
    payment_status: kolom({ label: "Status bayar awal", pilihan: STATUS_BAYAR.map((x) => [x, x]), nilai: "Pending" }),
  };
  const sandi = kolomSandi({ label: "Password", atribut: { maxlength: 72, autocomplete: "new-password" }, bantuan: "6–72 karakter." });
  const cekUser = h("p", { class: "bantuan", role: "status" });
  const tombol = h("button", { type: "submit", class: "tombol tombol-utama" }, "Buat akun siswa");
  let manual = false, sibuk = false, token = 0;

  const cek = debounce(async () => {
    const u = k.username.kontrol.value.trim().toLowerCase();
    if (!usernameValid(u)) { cekUser.textContent = ""; return; }
    const n = ++token;
    cekUser.textContent = "Memeriksa…"; cekUser.className = "bantuan";
    try {
      const d = await ambil(supabase.from("students").select("id").eq("username", u).maybeSingle());
      if (n !== token) return;
      cekUser.textContent = d ? "✗ Username sudah dipakai" : "✓ Username tersedia";
      cekUser.className = "bantuan " + (d ? "galat" : "ok");
    } catch { if (n === token) { cekUser.textContent = "Tidak bisa memeriksa saat ini. Server tetap akan memeriksa saat disimpan."; cekUser.className = "bantuan"; } }
  }, 400);

  k.child_name.kontrol.addEventListener("input", () => {
    if (!manual) { k.username.kontrol.value = sarankanUsername(k.child_name.kontrol.value); cek(); }
  });
  k.username.kontrol.addEventListener("input", () => {
    k.username.kontrol.value = k.username.kontrol.value.toLowerCase();
    manual = k.username.kontrol.value !== ""; cek();
  });
  wadah.addEventListener("input", () => setKotor(true), { once: true });

  const form = h("form", { novalidate: true, autocomplete: "off", class: "halaman" },
    h("section", { class: "kartu", "aria-labelledby": "jdl-data" },
      h("h2", { id: "jdl-data" }, "Data siswa"),
      h("div", { class: "grid-form dua" }, k.child_name.el, k.parent_name.el, k.whatsapp.el, k.school_origin.el, k.grade.el, k.payment_status.el)),
    h("section", { class: "kartu", "aria-labelledby": "jdl-akun" },
      h("h2", { id: "jdl-akun" }, "Akun masuk"),
      h("div", { class: "grid-form dua" }, h("div", {}, k.username.el, cekUser), h("div", {}, sandi.el,
        h("div", { class: "aksi-baris" },
          h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => { sandi.kontrol.value = passwordAcak(8); sandi.tampilkan(true); sandi.setGalat(""); } }, ikon("acak", 16), "Buat acak"),
          h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: async () => {
            if (!sandi.kontrol.value) { toast("Isi atau buat password dulu.", "info"); return; }
            toast((await salin(sandi.kontrol.value)) ? "Password disalin" : "Gagal menyalin");
          } }, ikon("salin", 16), "Salin"))))),
    h("div", {}, tombol));
  ganti(wadah, form);

  const peta = { child_name: k.child_name, parent_name: k.parent_name, whatsapp: k.whatsapp, school_origin: k.school_origin, grade: k.grade, username: k.username, password: sandi, payment_status: k.payment_status };
  const urutan = ["child_name", "parent_name", "whatsapp", "school_origin", "grade", "username", "password"];

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sibuk) return;
    Object.values(peta).forEach((x) => x.setGalat(""));
    const v = { child_name: k.child_name.kontrol.value, parent_name: k.parent_name.kontrol.value, whatsapp: k.whatsapp.kontrol.value, school_origin: k.school_origin.kontrol.value, grade: k.grade.kontrol.value };
    const { galat, nilai } = validasiDataSiswa(v);
    const username = k.username.kontrol.value.trim().toLowerCase();
    const pw = sandi.kontrol.value;
    if (!usernameValid(username)) galat.username = "Username 3–30 karakter: huruf kecil, angka, titik, garis bawah, minus.";
    if (pw.length < 6 || pw.length > 72) galat.password = "Password 6–72 karakter.";
    const pertama = urutan.find((n) => galat[n]);
    if (pertama) { Object.entries(galat).forEach(([n, t]) => peta[n]?.setGalat(t)); peta[pertama].kontrol.focus(); return; }

    sibuk = true; tombol.disabled = true; tombol.textContent = "Membuat akun…";
    try {
      const r = await panggilFungsi("admin-create-student", { ...nilai, username, password: pw, payment_status: k.payment_status.kontrol.value });
      const info = { id: r.student.id, username: r.student.username, anak: nilai.child_name, parent: nilai.parent_name, wa: nilai.whatsapp };
      setKotor(false);
      form.reset(); manual = false; cekUser.textContent = ""; sandi.tampilkan(false);
      bukaKredensial({
        judul: "Akun siswa berhasil dibuat",
        pengantar: `Akun untuk ${info.anak} sudah aktif. Berikan data ini kepada orang tua.`,
        username: info.username, password: pw, nomorWA: info.wa,
        pesanWA: pesanAkunBaru({ parent: info.parent, anak: info.anak, username: info.username, password: pw }),
        aksi: [
          { teks: "Tambah siswa lagi", saatKlik: () => k.child_name.kontrol.focus() },
          { teks: "Lihat detail siswa", gaya: "tombol-garis", saatKlik: () => ctx.pindah("#/siswa/" + info.id) },
        ],
      });
    } catch (err) {
      const kode = err && err.code;
      if (kode === "USERNAME_TAKEN") { k.username.setGalat("Username sudah dipakai, coba yang lain"); k.username.kontrol.focus(); }
      else if (kode === "VALIDATION") {
        let ada = false;
        Object.entries(err.fields || {}).forEach(([n, t]) => { if (peta[n]) { peta[n].setGalat(t); ada = true; } });
        toast(ada ? "Periksa kolom yang ditandai merah." : "Data belum valid.", "galat");
      } else toast(pesanFungsi(err, {}, "Gagal membuat akun, coba lagi."), "galat");
    } finally { sibuk = false; tombol.disabled = false; tombol.textContent = "Buat akun siswa"; }
  });
}