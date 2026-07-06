import { MessageSquare, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export default function Chat() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4"
    >
      <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6 border border-emerald-100">
        <MessageSquare className="w-10 h-10" strokeWidth={1.5} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
        Pusat Pesan (Segera Hadir)
      </h1>
      <p className="text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
        Fitur chat internal sedang dalam pengembangan. Nantinya, Anda dapat
        berkomunikasi dengan pegawai lain langsung dari aplikasi ini.
      </p>

      <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 px-6 py-4 rounded-xl text-slate-600 text-sm font-medium">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <span>Nantikan pembaruan kami selanjutnya!</span>
      </div>
    </motion.div>
  );
}
