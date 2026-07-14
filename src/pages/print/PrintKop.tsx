import type { AppSettings } from "../../types";

/** Shared letterhead for print documents. */
export function PrintKop({ settings }: { settings: AppSettings | null }) {
  return (
    <div
      className="flex items-center border-b-[3px] border-black pb-2 mb-1"
      style={{ lineHeight: "1.2" }}
    >
      <div className="flex-shrink-0 w-24 h-24 flex items-center justify-center">
        {settings?.logoBase64 ? (
          <img
            src={settings.logoBase64}
            alt="Logo"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-center text-gray-400 print-hidden">
            Logo
            <br />
            (Kosong)
          </div>
        )}
      </div>
      <div className="flex-1 text-center pr-24 flex flex-col justify-center">
        {settings?.kopLine1 && (
          <div className="text-[14pt] font-bold tracking-widest uppercase">
            {settings.kopLine1}
          </div>
        )}
        {settings?.kopLine2 && (
          <div className="text-[16pt] font-bold tracking-widest uppercase">
            {settings.kopLine2}
          </div>
        )}
        {settings?.kopLine3 && (
          <div className="text-[10pt] mt-0.5">{settings.kopLine3}</div>
        )}
        {settings?.kopLine4 && (
          <div className="text-[10pt]">{settings.kopLine4}</div>
        )}
      </div>
    </div>
  );
}
