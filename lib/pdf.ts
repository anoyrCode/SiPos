const BRAND = [0, 146, 183] as const;        // #0092B7
const POSITIVE = [22, 163, 74] as const;      // #16A34A
const NEGATIVE = [225, 29, 72] as const;      // #E11D48
const FG = [61, 74, 92] as const;             // #3D4A5C
const MUTED = [126, 140, 153] as const;
const ZEBRA = [246, 248, 252] as const;

let logoDataUrlPromise: Promise<string | null> | null = null;

function getLogoDataUrl(): Promise<string | null> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch("/logo.png")
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return `data:image/png;base64,${btoa(binary)}`;
      })
      .catch(() => null);
  }
  return logoDataUrlPromise;
}

async function drawHeader(doc: import("jspdf").jsPDF, title: string, meta: string[]) {
  const W = doc.internal.pageSize.width;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 22, "F");

  let textX = 14;
  const logo = await getLogoDataUrl();
  if (logo) {
    const logoH = 11;
    const logoW = logoH * (403 / 504);
    try {
      doc.addImage(logo, "PNG", 14, (22 - logoH) / 2, logoW, logoH);
      textX = 14 + logoW + 4;
    } catch {
      // Lanjut tanpa logo bila gagal dimuat/di-embed.
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("SIPOS Al-Kautsar", textX, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Sistem Informasi Poin Santri", textX, 16.5);

  doc.setTextColor(...FG);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 34);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  let y = 41;
  for (const line of meta) {
    doc.text(line, 14, y);
    y += 5.5;
  }

  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1, W - 14, y + 1);

  return y + 6;
}

function pageFooter(doc: import("jspdf").jsPDF, pageNum: number, total: number) {
  const H = doc.internal.pageSize.height;
  const W = doc.internal.pageSize.width;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(`Halaman ${pageNum} dari ${total}`, W / 2, H - 8, { align: "center" });
  doc.text("SIPOS Al-Kautsar — Sistem Informasi Poin Santri", 14, H - 8);
}

export type KelasRekapRow = {
  key: string;
  nama: string;
  count: number;
  pos: number;
  neg: number;
  net: number;
};

export type SantriRekapRow = {
  id: string;
  nama: string;
  kelas: string | null;
  pos: number;
  neg: number;
  net: number;
};

export async function downloadPdfRekapKelas(rows: KelasRekapRow[], taLabel: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const totalPos = rows.reduce((s, r) => s + r.pos, 0);
  const totalNeg = rows.reduce((s, r) => s + r.neg, 0);
  const totalNet = totalPos - totalNeg;

  const startY = await drawHeader(doc, "Rekap Poin Per Kelas", [
    `Tahun Ajaran: ${taLabel}`,
    `Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`,
  ]);

  autoTable(doc, {
    startY,
    head: [["No", "Kelas", "Jml Santri", "Poin Positif", "Poin Negatif", "Net Skor"]],
    body: rows.map((r, i) => [i + 1, r.nama, r.count, `+${r.pos}`, r.neg, r.net > 0 ? `+${r.net}` : String(r.net)]),
    foot: [["", "Total", rows.reduce((s, r) => s + r.count, 0), `+${totalPos}`, totalNeg, totalNet > 0 ? `+${totalNet}` : String(totalNet)]],
    headStyles: { fillColor: [...BRAND], textColor: 255, fontStyle: "bold", fontSize: 9 },
    footStyles: { fillColor: [235, 240, 248], textColor: [...FG], fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [...ZEBRA] },
    styles: { fontSize: 9, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 }, textColor: [...FG] },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      2: { halign: "center" },
      3: { halign: "right", textColor: [...POSITIVE] },
      4: { halign: "right", textColor: [...NEGATIVE] },
      5: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "foot" && data.column.index === 5) {
        data.cell.styles.textColor = totalNet >= 0 ? [...POSITIVE] : [...NEGATIVE];
      }
    },
    didDrawPage: (data) => {
      pageFooter(doc, data.pageNumber, (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1 || 1);
    },
  });

  doc.save(`rekap-kelas-${taLabel}.pdf`);
}

export type PelanggaranItem = {
  tanggal: string;
  namaPoin: string;
  kodePoin: string;
  nilai: number;
  catatan: string | null;
};

function formatTanggalID(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export async function downloadSuratPanggilan(params: {
  santri: { nama: string; nis: string | null; kelas: string | null };
  wali: { nama: string | null; noTelp: string | null };
  pelanggaran: PelanggaranItem[];
  totalNegatif: number;
  ambangBatas: number;
  taLabel: string;
}) {
  const { santri, wali, pelanggaran, totalNegatif, ambangBatas, taLabel } = params;
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.width;

  const today = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let y = await drawHeader(doc, "Surat Pemanggilan Orang Tua / Wali Santri", [
    `Tanggal: ${today}`,
  ]);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...FG);
  doc.text("Kepada Yth.", 14, y);
  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.text(wali.nama || "Bapak/Ibu Wali Santri", 14, y);
  y += 5.5;
  doc.setFont("helvetica", "normal");
  if (wali.noTelp) {
    doc.text(`No. Telp/WA: ${wali.noTelp}`, 14, y);
    y += 5.5;
  }
  doc.text("di tempat", 14, y);
  y += 9;

  const bodyLines = doc.splitTextToSize(
    `Dengan hormat, berdasarkan pemantauan poin pembinaan santri, tercatat akumulasi poin negatif putra/putri Bapak/Ibu telah mencapai batas yang memerlukan perhatian bersama (ambang batas pembinaan: ${ambangBatas} poin). Sehubungan dengan hal tersebut, kami bermaksud mengundang Bapak/Ibu untuk hadir ke sekolah guna berdiskusi dan bersama-sama menentukan langkah pembinaan terbaik bagi perkembangan putra/putri Bapak/Ibu. Atas perhatian dan kerja sama Bapak/Ibu, kami sampaikan terima kasih.`,
    W - 28,
  );
  doc.text(bodyLines, 14, y);
  y += bodyLines.length * 5 + 6;

  doc.setFont("helvetica", "bold");
  doc.text("Data Santri", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const info: [string, string][] = [
    ["Nama", santri.nama],
    ["NIS", santri.nis ?? "—"],
    ["Kelas", santri.kelas ?? "—"],
    ["Tahun Ajaran", taLabel],
    ["Total Poin Negatif", `-${totalNegatif}`],
  ];
  for (const [k, v] of info) {
    doc.text(k, 14, y);
    doc.text(`: ${v}`, 46, y);
    y += 5.5;
  }
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [["Tanggal", "Pelanggaran", "Poin", "Catatan"]],
    body: pelanggaran.map((p) => [
      formatTanggalID(p.tanggal),
      `${p.namaPoin} (${p.kodePoin})`,
      p.nilai,
      p.catatan ?? "—",
    ]),
    headStyles: { fillColor: [...BRAND], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [...ZEBRA] },
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [...FG] },
    columnStyles: {
      2: { halign: "right", textColor: [...NEGATIVE], fontStyle: "bold" },
    },
    didDrawPage: (data) => {
      pageFooter(
        doc,
        data.pageNumber,
        (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1 || 1,
      );
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  const sigY = Math.min(finalY, doc.internal.pageSize.height - 38);

  doc.setFontSize(9.5);
  doc.setTextColor(...FG);
  doc.text("Kesantrian / Wali Kelas,", 14, sigY);
  doc.text("Orang Tua / Wali Santri,", W - 70, sigY);
  doc.text("(_______________________)", 14, sigY + 22);
  doc.text("(_______________________)", W - 70, sigY + 22);

  doc.save(`surat-panggilan-${santri.nama.trim().replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export async function downloadPdfRekapSantri(rows: SantriRekapRow[], taLabel: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const startY = await drawHeader(doc, "Rekap Poin Per Santri", [
    `Tahun Ajaran: ${taLabel}`,
    `Total Santri: ${rows.length} santri`,
    `Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`,
  ]);

  autoTable(doc, {
    startY,
    head: [["No", "Nama Santri", "Kelas", "Positif", "Negatif", "Net", "Status"]],
    body: rows.map((r, i) => [
      i + 1,
      r.nama,
      r.kelas ?? "—",
      `+${r.pos}`,
      r.neg,
      r.net > 0 ? `+${r.net}` : String(r.net),
      r.net >= 0 ? "Baik" : "Perlu Perhatian",
    ]),
    headStyles: { fillColor: [...BRAND], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [...ZEBRA] },
    styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 3.5, right: 3.5 }, textColor: [...FG] },
    columnStyles: {
      0: { halign: "center", cellWidth: 9 },
      1: { cellWidth: 52 },
      2: { cellWidth: 30 },
      3: { halign: "right", textColor: [...POSITIVE] },
      4: { halign: "right", textColor: [...NEGATIVE] },
      5: { halign: "right", fontStyle: "bold" },
      6: { halign: "center", cellWidth: 28 },
    },
    willDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const val = data.cell.raw as string;
        data.cell.styles.textColor = val === "Baik" ? [...POSITIVE] : [...NEGATIVE];
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 5) {
        const val = data.cell.raw as string;
        data.cell.styles.textColor = val.startsWith("+") || val === "0" ? [...POSITIVE] : [...NEGATIVE];
      }
    },
    didDrawPage: (data) => {
      pageFooter(doc, data.pageNumber, (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1 || 1);
    },
  });

  doc.save(`rekap-santri-${taLabel}.pdf`);
}
