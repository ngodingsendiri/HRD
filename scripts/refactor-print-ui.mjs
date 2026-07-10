import fs from "fs";

const path = "src/pages/Print.tsx";
let text = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

// --- imports ---
text = text.replace(
  `import { PageHeader } from "../components/PageHeader";
import { motion } from "motion/react";
import {
  btnPrimary,
  chip,
  pageContainerVariants,
  pageItemVariants,
  pageShellWide,
} from "../lib/ui";`,
  `import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { notify } from "../lib/notify";
import { useAuth } from "../lib/auth";
import { motion } from "motion/react";
import {
  btnPrimary,
  btnSecondary,
  card,
  cardHeader,
  input,
  pageContainerVariants,
  pageItemVariants,
  pageShellWide,
  select,
} from "../lib/ui";`,
);

// --- component start: auth + cuti confirm state ---
text = text.replace(
  `export default function Print() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);`,
  `export default function Print() {
  const { canWrite } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [cutiConfirmOpen, setCutiConfirmOpen] = useState(false);
  const [cutiBusy, setCutiBusy] = useState(false);`,
);

// --- fetch: paginated employees + lean settings ---
text = text.replace(
  `  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch settings + employees in parallel
        const [currentSettings, empRaw] = await Promise.all([
          api.getSettings(),
          api.getEmployees(),
        ]);
        setSettings(currentSettings);

        // Apply Kamus Jabatan overrides dynamically (computed client-side)
        const empData: Employee[] = empRaw.map((emp) => {
          if (emp.jabatan) {
            const { kelas, beban } = lookupKamus(emp.jabatan, currentSettings.jabatanKamusCsv);
            if (kelas || beban) {
              return { ...emp, kelasJabatan: kelas, bebanKerja: beban };
            }
          }
          return emp;
        });

        setEmployees(empData);
      } catch (err) {
        console.error("Error fetching data for print:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);`,
  `  useEffect(() => {
    async function fetchData() {
      try {
        const currentSettings = await api.getSettings(["core", "logo", "kamus"]);
        setSettings(currentSettings);

        const all: Employee[] = [];
        let offset = 0;
        const pageSize = 500;
        for (;;) {
          const res = await api.getEmployeesPage({
            limit: pageSize,
            offset,
            lean: true,
          });
          all.push(...res.data);
          offset += res.data.length;
          if (offset >= res.total || res.data.length === 0) break;
        }

        const kamus = currentSettings.jabatanKamusCsv;
        setEmployees(
          all.map((emp) => {
            if (!emp.jabatan || !kamus) return emp;
            const { kelas, beban } = lookupKamus(emp.jabatan, kamus);
            return kelas || beban
              ? { ...emp, kelasJabatan: kelas, bebanKerja: beban }
              : emp;
          }),
        );
      } catch (err) {
        console.error("Error fetching data for print:", err);
        notify.error("Gagal memuat data cetak");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Hydrate full employee for cuti (lean list lacks sisaCuti*)
  useEffect(() => {
    if (!cutiEmployeeId) return;
    let cancelled = false;
    (async () => {
      try {
        const full = await api.getEmployee(cutiEmployeeId);
        if (cancelled || !full) return;
        setCutiMasaKerja(full.masaKerja || "");
        setCutiHp(full.nomorHp || "");
        setEmployees((prev) => {
          const idx = prev.findIndex((e) => e.id === cutiEmployeeId);
          if (idx < 0) return [...prev, full];
          const next = [...prev];
          next[idx] = { ...next[idx], ...full };
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cutiEmployeeId]);`,
);

// --- replace handlePrintClick with safe version ---
const hpcStart = text.indexOf("  const handlePrintClick = async () => {");
const retStart = text.indexOf("\n  return (\n    <motion.div");
if (hpcStart < 0 || retStart < 0) {
  console.error("handlePrintClick/return not found", hpcStart, retStart);
  process.exit(1);
}

const newHandlers = `
  const runCutiDeductionAndPrint = async () => {
    if (!canWrite) {
      notify.error("Mode baca saja", "Viewer tidak dapat mengurangi sisa cuti.");
      setCutiConfirmOpen(false);
      return;
    }
    if (!cutiEmployeeId) {
      notify.error("Pilih pegawai dulu");
      return;
    }
    if (!cutiLamaHari || cutiLamaHari <= 0) {
      notify.error("Lama cuti tidak valid");
      return;
    }
    setCutiBusy(true);
    try {
      const emp = await api.getEmployee(cutiEmployeeId);
      if (!emp) {
        notify.error("Pegawai tidak ditemukan");
        return;
      }
      const sisaN = parseInt(String(emp.sisaCutiN ?? "0"), 10) || 0;
      const sisaN1 = parseInt(String(emp.sisaCutiN1 ?? "0"), 10) || 0;
      const sisaN2 = parseInt(String(emp.sisaCutiN2 ?? "0"), 10) || 0;
      const total = sisaN + sisaN1 + sisaN2;
      if (total < cutiLamaHari) {
        notify.error(
          "Sisa cuti tidak cukup",
          \`Tersedia \${total} hari, diminta \${cutiLamaHari} hari.\`,
        );
        return;
      }
      let toDeduct = cutiLamaHari;
      let newN = sisaN;
      let newN1 = sisaN1;
      let newN2 = sisaN2;
      if (toDeduct <= newN2) {
        newN2 -= toDeduct;
      } else {
        toDeduct -= newN2;
        newN2 = 0;
        if (toDeduct <= newN1) {
          newN1 -= toDeduct;
        } else {
          toDeduct -= newN1;
          newN1 = 0;
          newN -= toDeduct;
        }
      }
      await api.updateEmployee(emp.id!, {
        sisaCutiN: String(newN),
        sisaCutiN1: String(newN1),
        sisaCutiN2: String(newN2),
      });
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === emp.id
            ? {
                ...e,
                sisaCutiN: String(newN),
                sisaCutiN1: String(newN1),
                sisaCutiN2: String(newN2),
              }
            : e,
        ),
      );
      setCutiConfirmOpen(false);
      notify.success("Sisa cuti diperbarui");
      setTimeout(() => window.print(), 300);
    } catch (err) {
      console.error(err);
      notify.error(
        "Gagal mengurangi sisa cuti",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setCutiBusy(false);
    }
  };

  const handlePrintClick = async () => {
    if (printType === "surat_cuti" && cutiJenis.startsWith("1")) {
      if (!canWrite) {
        try {
          window.print();
        } catch {
          notify.warning(
            "Cetak diblokir browser",
            "Gunakan Ctrl+P (Windows) atau Cmd+P (Mac).",
          );
        }
        return;
      }
      setCutiConfirmOpen(true);
      return;
    }
    try {
      window.print();
    } catch {
      notify.warning(
        "Cetak diblokir browser",
        "Gunakan Ctrl+P (Windows) atau Cmd+P (Mac).",
      );
    }
  };

`;

text = text.slice(0, hpcStart) + newHandlers + text.slice(retStart);

// --- replace control UI through preview paper open ---
const paperMarker = `        {/* Actual Print Paper Container */}
        <div
          ref={printRef}`;
// Older file might not have this exact comment
let paperIdx = text.indexOf(paperMarker);
if (paperIdx < 0) {
  paperIdx = text.indexOf('ref={printRef}');
  // back up to start of div
  paperIdx = text.lastIndexOf("<div", paperIdx);
}
const retIdx = text.indexOf("  return (\n    <motion.div");
if (retIdx < 0 || paperIdx < 0) {
  console.error("ret/paper", retIdx, paperIdx);
  process.exit(1);
}

// Find ConfirmDialog or style before end - inject ConfirmDialog if missing
const styleIdx = text.indexOf("      <style");
if (styleIdx < 0) {
  console.error("style not found");
  process.exit(1);
}

// Paper is from paperIdx to the closing before style - typically ends with </div></div> for paper and preview shell
// Find structure: print paper inside preview section
// Look for pattern before style - ConfirmDialog may not exist

const newUi = `  const DOCUMENTS: {
    category: "laporan" | "layanan";
    type: PrintType;
    label: string;
    title: string;
    wip?: boolean;
  }[] = [
    { category: "laporan", type: "absen_global", label: "Absensi", title: "DAFTAR HADIR / ABSENSI PEGAWAI" },
    { category: "laporan", type: "tanda_terima", label: "Tanda terima", title: "DAFTAR TANDA TERIMA ......................" },
    { category: "laporan", type: "duk", label: "DUK", title: "DAFTAR URUT KEPANGKATAN (DUK)" },
    { category: "layanan", type: "surat_cuti", label: "Surat cuti", title: "SURAT IZIN CUTI PEGAWAI" },
    {
      category: "layanan",
      type: "model_dk",
      label: "Model DK",
      title: "SURAT KETERANGAN UNTUK MENDAPATKAN PEMBAYARAN TUNJANGAN KELUARGA",
    },
  ];

  const selectDocument = (doc: (typeof DOCUMENTS)[number]) => {
    setPrintCategory(doc.category);
    if (doc.type === "absen_global") {
      if (selectedBidang !== "Semua") {
        setPrintType("absen_bidang");
        setCustomTitle(\`DAFTAR HADIR UNIT KERJA \${selectedBidang.toUpperCase()}\`);
      } else {
        setPrintType("absen_global");
        setCustomTitle(doc.title);
      }
    } else {
      setPrintType(doc.type);
      setCustomTitle(doc.title);
      setSelectedBidang("Semua");
    }
  };

  const activeDocKey =
    printType === "absen_bidang" || printType === "absen_global"
      ? "absen_global"
      : printType;

  const fieldLabel =
    "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageContainerVariants}
      className={pageShellWide}
    >
      <div className="print-hidden mb-4 md:mb-5">
        <motion.div variants={pageItemVariants}>
          <PageHeader
            title="Cetak"
            description="Pilih dokumen, atur opsi, pratinjau langsung, lalu cetak."
            actions={
              <button
                type="button"
                onClick={handlePrintClick}
                className={\`\${btnPrimary} w-full sm:w-auto\`}
              >
                <Printer className="w-4 h-4" />
                Cetak
              </button>
            }
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
        <aside className={\`print-hidden \${card} lg:col-span-3 overflow-hidden\`}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold text-slate-800">Dokumen</h2>
          </div>
          <div className="p-2 space-y-3">
            {(
              [
                ["laporan", "Laporan"],
                ["layanan", "Layanan"],
              ] as const
            ).map(([cat, title]) => (
              <div key={cat}>
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {title}
                </p>
                <ul className="space-y-0.5">
                  {DOCUMENTS.filter((d) => d.category === cat).map((doc) => {
                    const active = activeDocKey === doc.type;
                    return (
                      <li key={doc.type}>
                        <button
                          type="button"
                          onClick={() => selectDocument(doc)}
                          className={\`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors active:scale-[0.98] \${
                            active
                              ? "bg-slate-900 text-white"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }\`}
                        >
                          {doc.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <section className={\`print-hidden \${card} lg:col-span-4 overflow-hidden\`}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold text-slate-800">Opsi</h2>
          </div>
          <div className="p-4 sm:p-5 space-y-4 max-h-[min(70vh,720px)] overflow-y-auto">
            {(printType === "absen_global" || printType === "absen_bidang") && (
              <div>
                <label className={fieldLabel}>Unit kerja</label>
                <select
                  className={select}
                  value={selectedBidang}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedBidang(val);
                    if (val === "Semua") {
                      setPrintType("absen_global");
                      setCustomTitle("DAFTAR HADIR / ABSENSI PEGAWAI");
                    } else {
                      setPrintType("absen_bidang");
                      setCustomTitle(
                        \`DAFTAR HADIR UNIT KERJA \${val.toUpperCase()}\`,
                      );
                    }
                  }}
                >
                  <option value="Semua">Semua unit</option>
                  {getUniqueBidang().map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {printCategory === "laporan" && (
              <>
                <div>
                  <label className={fieldLabel}>Urutan</label>
                  <select
                    className={select}
                    value={sortOption}
                    onChange={(e) =>
                      setSortOption(e.target.value as SortAction)
                    }
                  >
                    <option value="default_kelas">
                      Hierarki (kelas, status)
                    </option>
                    <option value="abjad">Alfabetis (A–Z)</option>
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>Judul</label>
                  <input
                    type="text"
                    className={\`\${input} font-semibold\`}
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className={fieldLabel}>Subjudul / keterangan</label>
                  <input
                    type="text"
                    className={input}
                    value={customSubtitle}
                    onChange={(e) => setCustomSubtitle(e.target.value)}
                  />
                </div>
              </>
            )}

            {printCategory === "layanan" && (
              <>
                <div>
                  <label className={fieldLabel}>Pegawai</label>
                  <select
                    className={select}
                    value={cutiEmployeeId}
                    onChange={(e) => setCutiEmployeeId(e.target.value)}
                  >
                    <option value="">— Pilih pegawai —</option>
                    {[...employees]
                      .sort((a, b) =>
                        (a.nama || "").localeCompare(b.nama || ""),
                      )
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nama} — {emp.nip}
                        </option>
                      ))}
                  </select>
                </div>
                {printType === "surat_cuti" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className={fieldLabel}>Jenis cuti</label>
                      <select
                        className={select}
                        value={cutiJenis}
                        onChange={(e) => setCutiJenis(e.target.value)}
                      >
                        <option value="1. Cuti Tahunan">Cuti tahunan</option>
                        <option value="2. Cuti Besar">Cuti besar</option>
                        <option value="3. Cuti Sakit">Cuti sakit</option>
                        <option value="4. Cuti Melahirkan">
                          Cuti melahirkan
                        </option>
                        <option value="5. Cuti Karena Alasan Penting">
                          Cuti alasan penting
                        </option>
                        <option value="6. Cuti di Luar Tanggungan Negara">
                          CLTN
                        </option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={fieldLabel}>Alasan</label>
                      <input
                        type="text"
                        className={input}
                        value={cutiAlasan}
                        onChange={(e) => setCutiAlasan(e.target.value)}
                        placeholder="Contoh: ibadah / keperluan keluarga"
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Mulai</label>
                      <input
                        type="date"
                        className={input}
                        value={cutiMulai}
                        onChange={(e) => setCutiMulai(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Selesai</label>
                      <input
                        type="date"
                        className={input}
                        value={cutiAkhir}
                        onChange={(e) => setCutiAkhir(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Lama (hari kerja)</label>
                      <input
                        type="number"
                        className={\`\${input} bg-slate-50 text-slate-600\`}
                        value={cutiLamaHari}
                        readOnly
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={fieldLabel}>Alamat selama cuti</label>
                      <input
                        type="text"
                        className={input}
                        value={cutiAlamat}
                        onChange={(e) => setCutiAlamat(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              {sortedEmployees.length} pegawai
              {printCategory === "laporan"
                ? \` · \${sortOption === "abjad" ? "A–Z" : "hierarki"}\`
                : ""}
            </p>
          </div>
        </section>

        <section className="lg:col-span-5 space-y-2 min-w-0">
          <div
            className={\`print-hidden \${card} px-4 py-3 flex items-center justify-between gap-2\`}
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Pratinjau
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">A4 · live</p>
            </div>
            <button
              type="button"
              onClick={handlePrintClick}
              className={btnSecondary}
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 sm:p-4 overflow-auto max-h-[min(75vh,900px)] print:p-0 print:border-none print:bg-transparent print:max-h-none print:overflow-visible print:rounded-none">
`;

// Extract paper: from ref={printRef} div through its matching close before old preview ends
// Current structure after controls:
// <div preview shell>
//   <div print-hidden banner>
//   <div ref paper>
//   </div paper>
// </div preview>
// style

// Find paper start at ref={printRef}
const refIdx = text.indexOf("ref={printRef}");
const paperDivStart = text.lastIndexOf("<div", refIdx);
// Find end of paper: after all templates, before style - need the last </div></div> of preview

// From paperDivStart to styleIdx, strip leading preview chrome if any
let paperAndClosings = text.slice(paperDivStart, styleIdx);
// paperAndClosings may include only paper + closes, or preview chrome first

// If starts with printRef paper, good. If not, find print-container
if (!paperAndClosings.includes("print-container")) {
  console.error("print-container missing in slice");
  process.exit(1);
}

// Normalize: ensure we only keep from print-container div
const pc = paperAndClosings.indexOf("print-container");
const paperOnlyStart = paperAndClosings.lastIndexOf("<div", pc);
paperAndClosings = paperAndClosings.slice(paperOnlyStart);

// Remove trailing extra closings beyond paper (old preview wrapper)
// paper ends with one </div>, then maybe </div> for preview
// Count: keep content ending with single paper close
paperAndClosings = paperAndClosings.trimEnd();
// Remove one trailing </div> if two at end (preview wrapper)
if ((paperAndClosings.match(/<\/div>/g) || []).length > 0) {
  // We'll close scroll + section + grid ourselves; strip final orphan preview close
  // Heuristic: ends with </div>\n      </div>\n
  paperAndClosings = paperAndClosings.replace(
    /\n[ \t]*<\/div>\n[ \t]*<\/div>\n?$/,
    "\n            </div>\n",
  );
}

const confirmBlock = `
      <ConfirmDialog
        open={cutiConfirmOpen}
        onClose={() => !cutiBusy && setCutiConfirmOpen(false)}
        loading={cutiBusy}
        variant="danger"
        title="Potong sisa cuti & cetak?"
        description={\`Surat cuti tahunan akan memotong \${cutiLamaHari} hari kerja dari saldo cuti (N-2 → N-1 → N). Lanjutkan?\`}
        confirmLabel="Ya, potong & cetak"
        onConfirm={() => void runCutiDeductionAndPrint()}
      />

`;

const rebuilt =
  text.slice(0, retIdx) +
  newUi +
  paperAndClosings +
  `
          </div>
        </section>
      </div>

` +
  confirmBlock +
  text.slice(styleIdx);

fs.writeFileSync(path, rebuilt.replace(/\n/g, "\r\n"));
console.log("OK", rebuilt.length, "wizard?", rebuilt.includes("wizardStep"));
