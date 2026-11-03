// ANORA admin — pengaturan.js (ganti password admin, keamanan akun)
import { supabase } from "../supabase.js";
import { h, ganti, ikon } from "../ui.js";
import { kolomSandi, konfirmasi, toast } from "../widget.js";

export async function tampil(wadah, ctx) {
  const sekarang = kolomSandi({ label: "Password saat ini", atribut: { maxlength: 72, autocomplete: "current-password" } });
  const baru = kolomSandi({ label: "Password baru", atribut: { maxlength: 72, autocomplete: "new-password" }, bantuan: "Minimal 8 karakter." });
  const ulang = kolomSandi({ label: "Ulangi password baru", atribut: { maxlength: 72, autocomplete: "new-password" } });
  const tombol = h("button", { type: "submit", class: "tombol tombol-utama" }, "Ganti password admin");
  let sibuk = false;

  const form = h("form", { novalidate: true }, sekarang.el, baru.el, ulang.el, tombol);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sibuk) return;
    [sekarang, baru, ulang].forEach((k) => k.setGalat(""));
    const a = sekarang.kontrol.value, b = baru.kontrol.value, c = ulang.kontrol.value;
    if (!a) { sekarang.setGalat("Isi password saat ini."); sekarang.kontrol.focus(); return; }
    if (b.length < 8 || b.length > 72) { baru.setGalat("Password baru 8–72 karakter."); baru.kontrol.focus(); return; }
    if (b === a) { baru.setGalat("Password baru harus berbeda dari yang lama."); baru.kontrol.focus(); return; }
    if (c !== b) { ulang.setGalat("Konfirmasi tidak sama dengan password baru."); ulang.kontrol.focus(); return; }
    sibuk = true; tombol.disabled = true; tombol.textContent = "Memproses…";
    try {
      // Verifikasi password saat ini lebih dulu
      const { error: eCek } = await supabase.auth.signInWithPassword({ email: ctx.admin.email, password: a });
      if (eCek) { sekarang.setGalat("Password saat ini salah."); sekarang.kontrol.focus(); return; }
      const { error } = await supabase.auth.updateUser({ password: b });
      if (error) {
        const kode = error.code || "";
        baru.setGalat(kode === "same_password" ? "Password baru harus berbeda dari yang lama."
          : kode === "weak_password" ? "Password terlalu lemah. Gunakan campuran huruf dan angka." : "Gagal mengganti password, coba lagi.");
        return;
      }
      form.reset(); [sekarang, baru, ulang].forEach((k) => k.tampilkan(false));
      toast("Password admin berhasil diganti");
    } catch { toast("Gagal mengganti password. Periksa koneksi lalu coba lagi.", "galat"); }
    finally { sibuk = false; tombol.disabled = false; tombol.textContent = "Ganti password admin"; }
  });

  ganti(wadah, h("div", { class: "halaman" },
    h("section", { class: "kartu", "aria-labelledby": "jdl-sandi-admin" },
      h("h2", { id: "jdl-sandi-admin" }, "Ganti password admin"),
      h("p", { class: "lembut" }, `Akun: ${ctx.admin.email}`), form),
    h("section", { class: "kartu", "aria-labelledby": "jdl-mfa" },
      h("h2", { id: "jdl-mfa" }, "Autentikasi dua langkah (MFA)"),
      h("p", { class: "kotak-peringatan" }, "MFA belum tersedia di website admin ini. Jangan mendaftarkan MFA lewat cara lain: akun admin bisa terkunci dari data sampai layar kode MFA dibuat."),
      h("p", { class: "lembut" }, "Jika nanti Anda ingin mengaktifkannya, minta layar pendaftaran dan layar kode MFA ditambahkan lebih dulu.")),
    h("section", { class: "kartu", "aria-labelledby": "jdl-semua" },
      h("h2", { id: "jdl-semua" }, "Keluar dari semua perangkat"),
      h("p", { class: "lembut" }, "Gunakan ini jika Anda curiga ada orang lain yang memakai akun admin, atau lupa keluar di komputer bersama."),
      h("button", { type: "button", class: "tombol tombol-bahaya", onclick: async () => {
        const ya = await konfirmasi({ judul: "Keluar dari semua perangkat?", isi: "Semua sesi admin di semua perangkat akan diakhiri, termasuk yang ini. Anda perlu masuk lagi.", ya: "Ya, keluar semua", bahaya: true });
        if (ya) window.dispatchEvent(new CustomEvent("anora:keluar", { detail: { global: true } }));
      } }, ikon("keluar", 18), "Keluar dari semua perangkat"))));
}