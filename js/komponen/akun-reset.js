// ANORA admin — akun-reset.js (satu komponen untuk reset password: halaman Akun & Password dan tab detail siswa)
import { supabase, ambil, pesanGalat } from "../supabase.js";
import { panggilFungsi, pesanFungsi, UUID } from "../api.js";
import { h, ganti, ikon, elMemuat, elGalat, badgeAktif } from "../ui.js";
import { kolom, kolomSandi, konfirmasi, toast } from "../widget.js";
import { debounce, bersihkanCari, passwordAcak, kekuatan, salin, pesanReset } from "../util.js";
import { bukaKredensial } from "./kredensial.js";

const KOLOM = "id,username,child_name,parent_name,whatsapp,grade,is_active";

export async function tampilReset(wadah, { siswaTetap = null, siswaAwalId = null, aktif = () => true }) {
  const bagianCari = h("div");
  const panel = h("div", { "aria-live": "polite" });
  ganti(wadah, h("div", { class: "halaman" },
    h("p", { class: "lembut" }, "Password disimpan terenkripsi, jadi hanya bisa diganti, bukan dilihat."),
    siswaTetap ? null : bagianCari, panel));

  if (siswaTetap) { tampilPanel(siswaTetap); return; }

  // ----- pencarian siswa -----
  const kCari = kolom({ label: "Cari siswa (nama anak, orang tua, atau username)", tipe: "search", atribut: { autocomplete: "off" } });
  const hasil = h("ul", { class: "saran", hidden: true });
  bagianCari.append(kCari.el, hasil);
  let token = 0;
  const cari = debounce(async () => {
    const t = bersihkanCari(kCari.kontrol.value);
    if (t.length < 2) { hasil.hidden = true; return; }
    const n = ++token;
    try {
      const d = await ambil(supabase.from("students").select(KOLOM)
        .or(`child_name.ilike.%${t}%,parent_name.ilike.%${t}%,username.ilike.%${t}%`).order("child_name").limit(8));
      if (n !== token) return;
      hasil.replaceChildren(...(d.length
        ? d.map((s) => h("li", {}, h("button", { type: "button", onclick: () => { hasil.hidden = true; kCari.kontrol.value = ""; tampilPanel(s); } },
            `${s.child_name} · Kelas ${s.grade} · ${s.username}`)))
        : [h("li", {}, h("p", { class: "bantuan", style: "padding:.6rem .9rem;margin:0" }, "Tidak ada siswa yang cocok."))]));
      hasil.hidden = false;
    } catch (e) { if (n === token) toast(pesanGalat(e), "galat"); }
  }, 300);
  kCari.kontrol.addEventListener("input", cari);

  if (siswaAwalId && UUID.test(siswaAwalId)) {
    ganti(panel, elMemuat());
    try {
      const s = await ambil(supabase.from("students").select(KOLOM).eq("id", siswaAwalId).maybeSingle());
      if (!aktif()) return;
      if (s) tampilPanel(s); else ganti(panel);
    } catch (e) { ganti(panel, elGalat(pesanGalat(e))); }
  }

  // ----- panel reset untuk satu siswa -----
  function tampilPanel(s) {
    const sandi = kolomSandi({ label: "Password baru", atribut: { maxlength: 72, autocomplete: "new-password" }, bantuan: "6–72 karakter. Gunakan tombol “Buat acak” bila bingung." });
    const info = h("p", { class: "sandi-kuat", role: "status" });
    const tombolGanti = h("button", { type: "submit", class: "tombol tombol-utama" }, "Ganti password");
    let sibuk = false;

    const perbarui = () => { const k = kekuatan(sandi.kontrol.value); info.textContent = k.teks; info.className = "sandi-kuat kuat-" + k.tingkat; };
    sandi.kontrol.addEventListener("input", () => { sandi.setGalat(""); perbarui(); });

    const form = h("form", { novalidate: true, autocomplete: "off" },
      sandi.el, info,
      h("div", { class: "aksi-baris", style: "margin:.75rem 0" },
        h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: () => { sandi.kontrol.value = passwordAcak(8); sandi.tampilkan(true); sandi.setGalat(""); perbarui(); } }, ikon("acak", 16), "Buat acak"),
        h("button", { type: "button", class: "tombol tombol-garis kecil", onclick: async () => {
          if (!sandi.kontrol.value) { toast("Isi atau buat password dulu.", "info"); return; }
          toast((await salin(sandi.kontrol.value)) ? "Password disalin" : "Gagal menyalin", "ok");
        } }, ikon("salin", 16), "Salin")),
      tombolGanti);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (sibuk) return;
      const pw = sandi.kontrol.value;
      if (pw.length < 6 || pw.length > 72) { sandi.setGalat("Password baru 6–72 karakter."); sandi.kontrol.focus(); return; }
      const ya = await konfirmasi({
        judul: "Ganti password?",
        isi: `Ganti password ${s.child_name} (${s.username})? Password lama tidak akan berlaku lagi.`,
        ya: "Ya, ganti password", bahaya: true,
      });
      if (!ya) return;
      sibuk = true; tombolGanti.disabled = true; tombolGanti.textContent = "Memproses…";
      try {
        await panggilFungsi("admin-reset-password", { student_id: s.id, new_password: pw });
        const baru = pw;
        sandi.kontrol.value = ""; sandi.tampilkan(false); perbarui(); // kosongkan kolom
        bukaKredensial({
          judul: "Password sudah diganti",
          pengantar: `Berikan data ini kepada orang tua ${s.child_name}.`,
          username: s.username, password: baru, labelSandi: "Password baru",
          nomorWA: s.whatsapp,
          pesanWA: pesanReset({ parent: s.parent_name || "Bapak/Ibu", anak: s.child_name, username: s.username, password: baru }),
        });
      } catch (err) {
        toast(pesanFungsi(err, {
          NOT_FOUND: "Siswa tidak ditemukan.", VALIDATION: "Password minimal 6 karakter.",
        }, "Gagal mengganti password, coba lagi."), "galat");
      } finally { sibuk = false; tombolGanti.disabled = false; tombolGanti.textContent = "Ganti password"; }
    });

    ganti(panel, h("section", { class: "kartu", "aria-labelledby": "jdl-reset" },
      h("h2", { id: "jdl-reset" }, s.child_name),
      h("p", { class: "lembut" }, `Kelas ${s.grade} · Username: `, h("strong", {}, s.username), " · ", badgeAktif(s.is_active)),
      form));
    sandi.kontrol.focus();
  }
}