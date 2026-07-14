import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Loader2,
  Plus,
  Copy,
  Check,
  Trash2,
  BookOpen,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { api, type ApiKeyRecord } from "../lib/api";
import { notify } from "../lib/notify";
import { ConfirmDialog } from "./ConfirmDialog";
import { Modal } from "./Modal";
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  easeOut,
  input,
  listItemMotion,
} from "../lib/ui";
import { cn } from "../lib/utils";

const SCOPE_LABELS: Record<string, string> = {
  "employees:read": "Baca data pegawai",
  "stats:read": "Baca dashboard / statistik",
  "settings:read": "Baca pengaturan instansi (core/kop)",
};

function keyStatus(k: ApiKeyRecord): "active" | "revoked" | "expired" {
  if (k.revokedAt) return "revoked";
  if (k.expiresAt && new Date(k.expiresAt).getTime() < Date.now()) return "expired";
  return "active";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function ScopeBadge({ scope }: { scope: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-lg border bg-slate-50 text-slate-600 border-slate-200">
      {scope}
    </span>
  );
}

interface ApiKeysManagerProps {
  canWrite: boolean;
}

export function ApiKeysManager({ canWrite }: ApiKeysManagerProps) {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [scopes, setScopes] = useState<string[]>([
    "employees:read",
    "stats:read",
  ]);
  const [loading, setLoading] = useState(true);
  const [showRevoked, setShowRevoked] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "employees:read",
    "stats:read",
  ]);
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  /** One origin per line; empty = any origin (server-to-server) */
  const [allowedOriginsText, setAllowedOriginsText] = useState("");
  const [creating, setCreating] = useState(false);

  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRecord | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async (includeRevoked: boolean) => {
    if (!canWrite) {
      setLoading(false);
      setKeys([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.listApiKeys(includeRevoked);
      setKeys(res.keys);
      if (res.scopes?.length) setScopes(res.scopes);
    } catch (e) {
      notify.error(
        "Gagal memuat API keys",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [canWrite]);

  useEffect(() => {
    void load(showRevoked);
  }, [load, showRevoked]);

  const activeKeys = useMemo(
    () => keys.filter((k) => keyStatus(k) === "active"),
    [keys],
  );

  const openCreate = () => {
    setName("");
    setSelectedScopes(["employees:read", "stats:read"]);
    setExpiresInDays("");
    setAllowedOriginsText("");
    setCreateOpen(true);
  };

  const toggleScope = (s: string) => {
    setSelectedScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      notify.error("Nama key wajib diisi");
      return;
    }
    if (!selectedScopes.length) {
      notify.error("Pilih minimal satu scope");
      return;
    }
    setCreating(true);
    try {
      const days = expiresInDays.trim()
        ? parseInt(expiresInDays, 10)
        : undefined;
      const origins = allowedOriginsText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.createApiKey({
        name: name.trim(),
        scopes: selectedScopes,
        allowedOrigins: origins.length ? origins : undefined,
        expiresInDays:
          days != null && Number.isFinite(days) && days > 0 ? days : null,
      });
      setCreateOpen(false);
      setRevealedKey(res.key);
      setKeyVisible(true);
      setCopied(false);
      notify.success("API key dibuat");
      await load(showRevoked);
    } catch (e) {
      notify.error(
        "Gagal membuat key",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setCreating(false);
    }
  };

  const copyKey = async () => {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      notify.success("Disalin ke clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Gagal menyalin — salin manual");
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.revokeApiKey(revokeTarget.id);
      notify.success("API key dicabut");
      setRevokeTarget(null);
      await load(showRevoked);
    } catch (e) {
      notify.error(
        "Gagal mencabut key",
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setRevoking(false);
    }
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app";

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-slate-500" />
          API Eksternal
        </h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Generate API key agar aplikasi lain bisa membaca data HRD (pegawai &
          statistik) tanpa login session. Secret hanya ditampilkan sekali saat
          dibuat.
        </p>
      </div>

      {/* Quick start docs */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          <BookOpen className="w-3.5 h-3.5" />
          Cara pakai
        </div>
        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
          <li>Buat key di bawah (hanya admin).</li>
          <li>
            Kirim header{" "}
            <code className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-lg font-mono">
              Authorization: Bearer hrc_…
            </code>{" "}
            atau{" "}
            <code className="text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-lg font-mono">
              X-API-Key: hrc_…
            </code>
          </li>
          <li>
            Endpoint baca:{" "}
            <code className="text-xs font-mono text-slate-800">
              GET {origin}/api/v1/employees
            </code>
            ,{" "}
            <code className="text-xs font-mono text-slate-800">
              /api/v1/employees/:id
            </code>
            ,{" "}
            <code className="text-xs font-mono text-slate-800">
              /api/v1/stats
            </code>
            ,{" "}
            <code className="text-xs font-mono text-slate-800">
              /api/v1/settings
            </code>
          </li>
        </ol>
        <pre className="text-[11px] sm:text-xs font-mono bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto text-slate-700 leading-relaxed">
{`curl -H "Authorization: Bearer hrc_YOUR_KEY" \\
  "${origin}/api/v1/employees?limit=20&lean=1"`}
        </pre>
        <p className="text-xs text-slate-500">
          Spec OpenAPI:{" "}
          <a
            href="/api/v1/openapi"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-slate-800 underline underline-offset-2 hover:text-slate-600"
          >
            /api/v1/openapi
          </a>
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">
            Daftar key
            {!loading && (
              <span className="ml-2 text-xs font-medium text-slate-400">
                {activeKeys.length} aktif
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={() => void load(showRevoked)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 active:scale-95 transition-all"
            aria-label="Muat ulang"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showRevoked}
              onChange={(e) => setShowRevoked(e.target.checked)}
              className="rounded border-slate-300"
            />
            Tampilkan dicabut
          </label>
          {canWrite && (
            <button type="button" onClick={openCreate} className={btnPrimary}>
              <Plus className="w-4 h-4" />
              Buat API key
            </button>
          )}
        </div>
      </div>

      {!canWrite && (
        <div className="text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
          Mode baca saja — hanya admin yang bisa membuat atau mencabut API key.
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Memuat keys…
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
          <KeyRound className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Belum ada API key</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Buat key untuk menghubungkan aplikasi eksternal ke data pegawai HRD.
          </p>
          {canWrite && (
            <button
              type="button"
              onClick={openCreate}
              className={`${btnPrimary} mt-4`}
            >
              <Plus className="w-4 h-4" />
              Buat API key pertama
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {keys.map((k) => {
              const status = keyStatus(k);
              const inactive = status !== "active";
              return (
                <motion.li
                  key={k.id}
                  layout
                  {...listItemMotion}
                  className={cn(
                    "rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3",
                    inactive && "opacity-60",
                  )}
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {k.name}
                      </span>
                      {status === "revoked" ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-red-50 text-red-700 border-red-100">
                          Dicabut
                        </span>
                      ) : status === "expired" ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-amber-50 text-amber-700 border-amber-100">
                          Kadaluarsa
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-100">
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-500">
                      {k.keyPrefix}…
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {k.scopes.map((s) => (
                        <ScopeBadge key={s} scope={s} />
                      ))}
                      {(k.allowedOrigins?.length ?? 0) > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-lg border bg-sky-50 text-sky-700 border-sky-100">
                          {k.allowedOrigins.length} origin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-lg border bg-slate-50 text-slate-500 border-slate-200">
                          origin bebas
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1">
                      Dibuat {formatDate(k.createdAt)}
                      {k.createdBy ? ` · ${k.createdBy}` : ""}
                      {" · "}Terakhir dipakai {formatDate(k.lastUsedAt)}
                      {k.expiresAt ? ` · Kadaluarsa ${formatDate(k.expiresAt)}` : ""}
                    </p>
                  </div>
                  {canWrite && status !== "revoked" && (
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(k)}
                      className={`${btnDanger} shrink-0 w-full sm:w-auto`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Cabut
                    </button>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Create modal */}
      <Modal
        isOpen={createOpen}
        onClose={creating ? () => {} : () => setCreateOpen(false)}
        title="Buat API key"
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Nama
            </label>
            <input
              type="text"
              className={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Dashboard eksekutif"
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Scope
            </label>
            <div className="space-y-2">
              {scopes.map((s) => (
                <label
                  key={s}
                  className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-white transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(s)}
                    onChange={() => toggleScope(s)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 font-mono">
                      {s}
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {SCOPE_LABELS[s] || "Akses API"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Kadaluarsa (hari, opsional)
            </label>
            <input
              type="number"
              min={1}
              max={3650}
              className={input}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="Kosongkan = tidak kadaluarsa"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Origin browser diizinkan (opsional)
            </label>
            <textarea
              className={`${input} min-h-[72px] font-mono text-xs`}
              value={allowedOriginsText}
              onChange={(e) => setAllowedOriginsText(e.target.value)}
              placeholder={"Kosongkan = semua origin\nhttps://app.contoh.go.id"}
            />
            <p className="text-[11px] text-slate-500">
              Satu URL origin per baris. Server-to-server (tanpa header Origin)
              selalu diizinkan. Browser hanya dari origin yang terdaftar.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
              className={`${btnSecondary} w-full sm:w-auto`}
            >
              Batal
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className={`${btnPrimary} w-full sm:w-auto`}
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Generate
            </button>
          </div>
        </div>
      </Modal>

      {/* One-time secret reveal */}
      <Modal
        isOpen={!!revealedKey}
        onClose={() => setRevealedKey(null)}
        title="Simpan API key ini"
        size="md"
      >
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeOut}
            className="p-3 rounded-xl border border-amber-100 bg-amber-50 text-sm text-amber-800"
          >
            Secret hanya ditampilkan sekali. Salin sekarang — tidak bisa dilihat
            lagi setelah dialog ditutup.
          </motion.div>
          <div className="relative">
            <code
              className={cn(
                "block w-full p-3 pr-20 rounded-lg border border-slate-200 bg-slate-50 text-xs sm:text-sm font-mono break-all text-slate-800",
                !keyVisible && "select-none blur-sm",
              )}
            >
              {revealedKey}
            </code>
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                type="button"
                onClick={() => setKeyVisible((v) => !v)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                aria-label={keyVisible ? "Sembunyikan" : "Tampilkan"}
              >
                {keyVisible ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void copyKey()}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                aria-label="Salin"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRevealedKey(null)}
            className={`${btnPrimary} w-full`}
          >
            Saya sudah menyimpan key
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => !revoking && setRevokeTarget(null)}
        title="Cabut API key?"
        description={
          revokeTarget
            ? `Key “${revokeTarget.name}” (${revokeTarget.keyPrefix}…) tidak bisa dipakai lagi. Aplikasi yang menggunakannya akan mendapat 401.`
            : ""
        }
        confirmLabel="Cabut key"
        cancelLabel="Batal"
        variant="danger"
        loading={revoking}
        onConfirm={() => void handleRevoke()}
      />
    </div>
  );
}
