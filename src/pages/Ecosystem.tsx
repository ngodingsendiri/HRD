import React, { useState, useMemo } from "react";
import { Database, LayoutTemplate, FolderOpen, Layers, ShieldCheck, Code, Key, AlertTriangle, TerminalSquare, Copy, Check, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function Ecosystem() {
  const [copiedContext, setCopiedContext] = useState(false);
  const [copiedQuery, setCopiedQuery] = useState(false);

  // API Generator State
  const [queryType, setQueryType] = useState<'all' | 'nip' | 'bidang'>('nip');
  const [isRealtime, setIsRealtime] = useState(false);
  const [enableCache, setEnableCache] = useState(true);

  const copyToClipboard = (text: string, isContext: boolean) => {
    navigator.clipboard.writeText(text);
    if (isContext) {
      setCopiedContext(true);
      setTimeout(() => setCopiedContext(false), 2000);
    } else {
      setCopiedQuery(true);
      setTimeout(() => setCopiedQuery(false), 2000);
    }
  };

  const initCode = `// Firebase Initialization
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "project-a1172adf-2dae-4092-802",
  // Gunakan kredensial lengkap sesuai environment anda
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Database ai-studio-...`;

  const queryCode = useMemo(() => {
    let imports = ["collection"];
    if (isRealtime) {
      imports.push("onSnapshot");
    } else {
      imports.push("getDocs");
    }
    
    if (queryType !== 'all') {
      imports.push("query", "where");
    }

    let code = `// Query Data Pegawai (Generated)\n`;
    code += `import { ${imports.join(", ")} } from 'firebase/firestore';\n\n`;
    
    code += `const employeesRef = collection(db, 'shared/data/employees');\n`;
    
    let targetRef = "employeesRef";

    if (queryType === 'nip') {
      code += `const q = query(employeesRef, where("nip", "==", "199010..."));\n`;
      targetRef = "q";
    } else if (queryType === 'bidang') {
      code += `const q = query(employeesRef, where("bidang", "==", "Keuangan"));\n`;
      targetRef = "q";
    }

    if (!isRealtime) {
      if (enableCache) {
        code += `\n// TIPS: Lakukan caching pada level state (contoh: React Query)\n`;
        code += `// untuk menghindari pemuatan dokumen yang sama berulang kali.\n`;
      }
      code += `const snapshot = await getDocs(${targetRef});\n`;
      code += `snapshot.forEach((doc) => {\n  console.log(doc.id, " => ", doc.data());\n});`;
    } else {
      code += `\n// Realtime Listener aktif. Pastikan memanggil unsubscribe saat komponen unmount.\n`;
      code += `const unsubscribe = onSnapshot(${targetRef}, (snapshot) => {\n`;
      code += `  snapshot.docChanges().forEach((change) => {\n`;
      code += `    if (change.type === "added") {\n`;
      code += `       // Sinkronisasi data masuk ke state lokal\n`;
      code += `       console.log("New data: ", change.doc.data());\n`;
      code += `    }\n`;
      code += `  });\n`;
      code += `});`;
    }

    return code;
  }, [queryType, isRealtime, enableCache]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto space-y-8 p-4 sm:p-0 sm:py-8 pb-16 antialiased"
    >
      <div className="flex flex-col border-b border-slate-100 pb-4 md:pb-6 gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Ekosistem & Integrasi
        </h1>
        <p className="mt-1 text-sm text-slate-500 max-w-3xl">
          Panel administrasi dan arsitektur antar-aplikasi. Aplikasi dalam ekosistem ini 
          saling terhubung secara realtime ke satu database Firestore Pusat HR untuk menjamin
          integritas data pegawai secara global.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Architecture Visualization */}
        <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center relative min-h-[300px]">
          {/* HR Master */}
          <div className="z-10 w-36 sm:w-40 bg-white rounded-lg border border-slate-200 p-3 flex flex-col items-center">
             <LayoutTemplate className="w-5 h-5 text-slate-900 mb-1.5 sm:mb-2" />
             <span className="text-[10px] sm:text-xs font-bold text-slate-800 text-center">Pusat HR (Master)</span>
             <span className="text-[8px] sm:text-[9px] text-slate-500 mt-1 px-1.5 sm:px-2 py-0.5 bg-slate-100 rounded-lg">/shared/data/employees</span>
          </div>

          {/* Connection line down */}
          <div className="h-6 sm:h-8 w-px bg-slate-200 border-l-2 border-dashed border-slate-300"></div>

          {/* Central DB */}
          <div className="z-10 w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-xl border-2 border-slate-900 flex flex-col items-center justify-center scale-95 sm:scale-100">
            <Database className="w-6 h-6 sm:w-8 sm:h-8 text-slate-900 mb-1" />
            <span className="text-[9px] sm:text-[10px] font-bold">PUSAT HR</span>
          </div>

          {/* Connection line down, then split */}
          <div className="h-6 sm:h-8 w-px bg-slate-200 border-l-2 border-dashed border-slate-300"></div>
          <div className="w-[75%] sm:w-[50%] h-px bg-slate-200 border-t-2 border-dashed border-slate-300"></div>
          <div className="flex justify-between w-[75%] sm:w-[50%] -mt-[2px]">
            <div className="h-6 sm:h-8 w-px bg-slate-200 border-l-2 border-dashed border-slate-300"></div>
            <div className="h-6 sm:h-8 w-px bg-slate-200 border-l-2 border-dashed border-slate-300"></div>
          </div>

          {/* Bottom Nodes */}
          <div className="flex w-full sm:w-[80%] lg:w-[60%] justify-between gap-2 sm:gap-4 mt-0">
            <div className="z-10 flex-1 bg-white rounded-lg border border-slate-200 p-2 sm:p-3 flex flex-col items-center overflow-hidden">
               <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900 mb-1.5 sm:mb-2" />
               <span className="text-[10px] sm:text-xs font-bold text-slate-800 text-center truncate w-full">Administrasi</span>
               <span className="text-[8px] sm:text-[9px] text-slate-500 mt-1 px-1.5 py-0.5 bg-slate-100 rounded-lg truncate max-w-full text-center">/disposisi</span>
            </div>
            
            <div className="z-10 flex-1 bg-white rounded-lg border border-slate-200 p-2 sm:p-3 flex flex-col items-center overflow-hidden">
               <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900 mb-1.5 sm:mb-2" />
               <span className="text-[10px] sm:text-xs font-bold text-slate-800 text-center truncate w-full">Dokumen UP</span>
               <span className="text-[8px] sm:text-[9px] text-slate-500 mt-1 px-1.5 py-0.5 bg-slate-100 rounded-lg truncate max-w-full text-center">/employee_documents</span>
            </div>
          </div>
        </div>

        {/* Security Rules & Access Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Status Sinkronisasi Rules</h3>
                <p className="text-xs text-slate-500">Firestore Security Rules Gabungan Aktif</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Aplikasi ini bertindak sebagai basis database utama. Demi keamanan dan konektivitas,
              aturan akses antar aplikasi telah dirumuskan:
            </p>

            <ul className="space-y-3">
              <li className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <LayoutTemplate className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-slate-800 block">Pusat HR (Aplikasi Ini)</span>
                  <span className="text-slate-500 text-xs">Akses penuh read/write ke data pegawai. Menjadi master data source.</span>
                </div>
              </li>
              <li className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <Layers className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-slate-800 block">Cabang 1 (Administrasi)</span>
                  <span className="text-slate-500 text-xs">Memiliki namespace khusus <code className="bg-slate-200 px-1 rounded-lg text-[10px]">/shared/data/disposisi</code>. Terisolasi dari modifikasi data HR.</span>
                </div>
              </li>
              <li className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <FolderOpen className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-slate-800 block">Cabang 2 (Dokumen UP)</span>
                  <span className="text-slate-500 text-xs">Diberi akses baca global ke data HR untuk validasi profil pegawai sebelum upload berkas.</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Generation Panel */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <TerminalSquare className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Developer API: Akses Data</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Panduan integrasi jika Anda ingin membuat aplikasi cabang baru.</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
          {/* Limitations and Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2 sm:space-y-3">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                <Key className="w-4 h-4 text-slate-500 shrink-0" />
                Hak Akses (Permissions)
              </h3>
              <div className="bg-slate-50 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-slate-600 space-y-2 border border-slate-100 leading-relaxed">
                <p><strong>Akses Baca:</strong> Aplikasi third-party diberikan akses <code>allow read: if true;</code> pada path <code>/shared/data/employees</code>.</p>
                <p><strong>Akses Tulis:</strong> Sangat dilarang (Forbidden). Hanya Pusat HR yang memiliki otoritas untuk menambah/mengubah data. Gunakan namespace terpisah.</p>
              </div>
            </div>
            
            <div className="space-y-2 sm:space-y-3">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" />
                Batasan Ideal & Rate Limits
              </h3>
              <div className="bg-amber-50/50 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-amber-800 space-y-2 border border-amber-100 leading-relaxed">
                <p><strong>Limitasi Firestore:</strong> Gunakan indeks pencarian (NIP / NIK) untuk membatasi ukuran data. Jangan melakukan query luas tanpa memfilter (klausa where).</p>
                <p><strong>Caching:</strong> Lakukan cache data pegawai di aplikasi klien agar tidak melakukan fetch berulang pada data yang jarang berubah (nama, NIP).</p>
              </div>
            </div>
          </div>

          {/* Code Snippets & API Generator */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                <Settings2 className="w-4 h-4 text-slate-500" />
                Generator Query Pegawai
              </h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
              {/* Controls */}
              <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-5">
                {/* Query Type */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">Metode Pengambilan</label>
                  <select 
                    value={queryType}
                    onChange={(e) => setQueryType(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 cursor-pointer"
                  >
                    <option value="nip">Cari berdasarkan NIP (Direkomendasikan)</option>
                    <option value="bidang">Filter berdasarkan Bidang</option>
                    <option value="all">Satu Koleksi (Semua Data - Hati-hati)</option>
                  </select>
                </div>

                {/* Realtime Toggle */}
                <div className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold text-slate-700 block">Real-time Listener</label>
                    <p className="text-[10px] text-slate-500">Dengarkan perubahan live</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={isRealtime} onChange={(e) => setIsRealtime(e.target.checked)} />
                    <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-slate-900"></div>
                  </label>
                </div>

                {/* Cache Toggle */}
                <div className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold text-slate-700 block">Terapkan Cache lokal</label>
                    <p className="text-[10px] text-slate-500">Hemat kuota baca (Read once)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" disabled={isRealtime} checked={enableCache && !isRealtime} onChange={(e) => setEnableCache(e.target.checked)} />
                    <div className={`w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all ${isRealtime ? 'opacity-50 cursor-not-allowed' : 'peer-checked:bg-slate-900'}`}></div>
                  </label>
                </div>
              </div>

              {/* Code Views */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                {/* Snippet 1 */}
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900 flex flex-col">
                  <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-800 bg-slate-800/40">
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono tracking-wider">init.ts</span>
                    <button onClick={() => copyToClipboard(initCode, true)} className="p-1 sm:p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-white transition-all active:scale-95" aria-label="Copy code">
                      {copiedContext ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-3 sm:p-4 overflow-x-auto text-[10px] sm:text-xs text-slate-50 font-mono leading-relaxed max-h-32 scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600">
                    <code>{initCode}</code>
                  </pre>
                </div>

                {/* Snippet 2 */}
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900 flex flex-col">
                  <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-800 bg-slate-800/40">
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono tracking-wider">query.ts</span>
                    <button onClick={() => copyToClipboard(queryCode, false)} className="p-1 sm:p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-white transition-all active:scale-95" aria-label="Copy code">
                      {copiedQuery ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-3 sm:p-4 overflow-x-auto text-[10px] sm:text-xs text-slate-50 font-mono leading-relaxed scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600">
                    <motion.div
                      key={queryCode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <code>{queryCode}</code>
                    </motion.div>
                  </pre>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex items-start gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
               <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0"></div>
               <p className="text-[11px] sm:text-xs text-slate-600">Pastikan dependensi Firebase sudah di-install menggunakan <code className="bg-slate-200 px-1 py-0.5 rounded">npm install firebase</code>.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
