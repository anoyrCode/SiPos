# DESIGN.md — Design System SIPOS

Arah desain: **modern, tenang (calm), bersih, dan smooth.** Bukan korporat kaku, bukan ramai. Banyak ruang kosong, hierarki jelas, micro-interaction halus. Dashboard admin terasa profesional & fokus; portal wali terasa hangat & mudah (mobile-first).

> Catatan warna: brand utama **biru (sky)**, dipilih agar modern & tidak bentrok dengan makna semantik **hijau = poin positif** dan **merah = poin negatif**.

---

## 1. Design Tokens

### Warna — Light Mode
```css
--bg:            #F7F9F8;  /* background app */
--surface:       #FFFFFF;  /* kartu, panel */
--surface-2:     #F1F5F4;  /* panel sekunder, header tabel */
--border:        #E4E9E7;
--text:          #16201D;  /* judul/teks utama */
--text-muted:    #5C6B66;  /* teks sekunder */

--primary:       #0092B7;  /* brand (biru/cyan) */
--primary-hover: #0077A0;
--primary-soft:  #E0F4FA;  /* bg subtle, state aktif */

--positive:      #16A34A;  /* poin positif */
--positive-soft: #DCFCE7;
--negative:      #E11D48;  /* poin negatif */
--negative-soft: #FFE4E6;
--warning:       #D97706;
--warning-soft:  #FEF3C7;

/* Alt brand pesantren (opsional): --primary:#15795B; --primary-hover:#0F6149; --primary-soft:#E8F4EF; */
```

### Warna — Dark Mode
```css
--bg:            #0C1311;
--surface:       #141C19;
--surface-2:     #1A2420;
--border:        #25302C;
--text:          #E7EDEA;
--text-muted:    #93A39D;
--primary:       #34C3E3;  /* biru lebih terang utk dark */
--primary-hover: #7FE0F4;
--primary-soft:  #0B3A48;
/* positive/negative/warning: pakai shade lebih terang + soft gelap */
```

### Tipografi
- **Headings & Body/UI:** `Manrope` (modern, halus, rounded — satu keluarga untuk konsistensi).
- **Mono (angka teknis: NIS, NIP, kode poin, nilai):** `JetBrains Mono`.
- Skala: page title 28–32px / 700, section 20px / 600, card title 16px / 600, body 14px, caption 12px. Line-height lega (1.5 body).
- Angka besar di kartu statistik pakai `tabular-nums` + tracking sedikit rapat.

### Radius, Spacing, Shadow
```css
--radius-card: 16px;
--radius-input: 10px;
--radius-pill: 9999px;
/* spacing pakai skala 4px (4/8/12/16/24/32) */
--shadow-sm: 0 1px 2px rgba(16,24,21,.05);
--shadow-md: 0 8px 24px -10px rgba(16,24,21,.12);
--shadow-pop: 0 16px 40px -12px rgba(16,24,21,.18); /* dropdown, modal */
```

### Motion (kunci rasa "smooth")
- Durasi 150–250ms. Easing utama: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out halus, sedikit "springy").
- Enter konten: fade + translateY(8px), **staggered** untuk list/kartu.
- Hover kartu interaktif: `translateY(-2px)` + shadow naik.
- Kartu statistik dashboard: **count-up** angka saat load.
- Loading: **skeleton** (shimmer halus), bukan spinner di tengah layar.
- Drawer/sidebar/modal: slide + fade halus.
- Selalu hormati `prefers-reduced-motion: reduce` (matikan animasi).
- Library: Framer Motion (`motion/react`) untuk transisi kompleks; CSS transition untuk hover/focus.

### Ikon
- **Lucide** (`lucide-react`). Stroke 1.75, ukuran 18–20px di UI, 24px di nav.

---

## 2. Pola Komponen

- **App shell (admin):** sidebar kiri collapsible (ikon + label, item aktif = bg `--primary-soft` + teks/ikon `--primary` + accent kiri tipis). Topbar: search global, **switcher Tahun Ajaran**, notifikasi, avatar.
- **Stat card:** angka besar (`tabular-nums`) + label muted + indikator tren (▲/▼ kecil berwarna positive/negative). Border tipis + `--shadow-sm`, hover lift.
- **Tabel data:** kontainer rounded + border, header `--surface-2` sticky, baris tinggi lega (52–56px), hover row tint, **tanpa zebra**, footer pagination. State kosong & loading skeleton wajib.
- **Badge poin:** pill, `positive-soft`/`negative-soft` sebagai bg + teks berwarna senada. Level (RINGAN/SEDANG/BERAT, PERUNGGU/PERAK/EMAS) = badge outline halus.
- **Button:** primary solid (hover `--primary-hover`), secondary outline, ghost untuk aksi tersier. Semua punya `focus-visible` ring 2px `--primary` + offset. Radius `--radius-input`.
- **Form:** label di atas field, input border tipis → focus ring primary, helper/error text inline, validasi real-time (Zod). Tombol submit sticky di modal panjang.
- **Charts (Recharts):** minimalis — grid horizontal samar, sumbu muted, **garis `monotone` (melengkung halus)**, bar rounded-top, tooltip = kartu kecil mengikuti `--surface` + `--shadow-pop`. Warna: positif/negatif pakai token semantik.
- **Empty state:** ikon Lucide besar muted + 1 kalimat + tombol aksi.

### Portal Wali (beda nuansa)
- Lebih hangat & "consumer", **mobile-first**, kartu besar, touch target ≥44px.
- Tiap anak = kartu ringkas (nama, kelas, skor net dengan warna). Detail = timeline poin yang enak dibaca + mini-chart tren bulanan.

---

## 3. Prinsip
- Whitespace dulu, baru elemen. Jangan padat.
- Maksimal 1 warna brand + semantik; sisanya neutral.
- Konsisten radius & spacing (pakai skala 4px).
- Setiap state interaktif punya feedback (hover/active/focus/loading/empty/error).
- Aksesibilitas: kontras WCAG AA, HTML semantik, focus ring jelas.

---

## 4. Prompt Siap-Tempel untuk Claude Code

> Gunakan skill `frontend-design`. Ikuti `@DESIGN.md` sebagai sumber kebenaran design system: token warna, tipografi (Manrope / JetBrains Mono), radius, shadow, dan motion. Bangun semua token sebagai CSS variables + konfigurasi Tailwind, dukung light & dark mode. Targetkan tampilan **modern, calm, bersih, dan smooth**: whitespace lega, hierarki jelas, micro-interaction halus (fade+slide staggered saat enter, count-up di kartu statistik, hover lift, skeleton loading), easing `cubic-bezier(0.16,1,0.3,1)`, dan hormati `prefers-reduced-motion`. Pakai shadcn/ui + lucide-react. Hindari tampilan generik AI: jangan gradient norak, jangan shadow tebal, jangan warna jenuh berlebih. Brand = biru `#0092B7`; hijau = poin positif, merah = poin negatif (jangan dicampur). Sebelum menata, tampilkan dulu rencana komponen, lalu implementasikan.
