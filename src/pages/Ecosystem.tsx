import React from "react";
import { Database, LayoutTemplate, FolderOpen, Layers, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";

export default function Ecosystem() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 p-4 sm:p-0 sm:py-8 pb-12 antialiased">
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
        <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-6 md:p-8 flex flex-col items-center justify-center relative min-h-[400px]">
          {/* Central DB */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-24 h-24 bg-white rounded-xl border-2 border-slate-900 flex flex-col items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <Database className="w-8 h-8 text-slate-900 mb-1" />
            <span className="text-[10px] font-bold">PUSAT HR</span>
          </div>

          {/* Connection Lines (SVG) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {/* Master HR Line */}
            <path d="M 50%,20% Q 50%,50% 50%,50%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            {/* Cabang 1 Line */}
            <path d="M 20%,80% Q 50%,50% 50%,50%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" fill="none" />
            {/* Cabang 2 Line */}
            <path d="M 80%,80% Q 50%,50% 50%,50%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" fill="none" />
          </svg>

          {/* App Nodes */}
          {/* Top: HR Master */}
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-40 bg-white rounded-lg border border-slate-200 p-3 flex flex-col items-center z-10 shadow-sm">
             <LayoutTemplate className="w-5 h-5 text-indigo-600 mb-2" />
             <span className="text-xs font-bold text-slate-800 text-center">Pusat HR (Master)</span>
             <span className="text-[9px] text-slate-500 mt-1 px-2 py-0.5 bg-slate-100 rounded-full">/shared/data/employees</span>
          </div>

          {/* Bottom Left: Administrasi */}
          <div className="absolute bottom-[10%] left-[10%] w-40 bg-white rounded-lg border border-slate-200 p-3 flex flex-col items-center z-10 shadow-sm">
             <Layers className="w-5 h-5 text-emerald-600 mb-2" />
             <span className="text-xs font-bold text-slate-800 text-center">Administrasi</span>
             <span className="text-[9px] text-slate-500 mt-1 px-2 py-0.5 bg-slate-100 rounded-full">/shared/data/disposisi</span>
          </div>

          {/* Bottom Right: Dokumen UP */}
          <div className="absolute bottom-[10%] right-[10%] w-40 bg-white rounded-lg border border-slate-200 p-3 flex flex-col items-center z-10 shadow-sm">
             <FolderOpen className="w-5 h-5 text-amber-600 mb-2" />
             <span className="text-xs font-bold text-slate-800 text-center">Dokumen UP</span>
             <span className="text-[9px] text-slate-500 mt-1 px-2 py-0.5 bg-slate-100 rounded-full">/employee_documents</span>
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
                  <span className="text-slate-500 text-xs">Memiliki namespace khusus <code className="bg-slate-200 px-1 rounded text-[10px]">/shared/data/disposisi</code>. Terisolasi dari modifikasi data HR.</span>
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
    </div>
  );
}
