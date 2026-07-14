import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { EmployeeForm } from "../components/EmployeeForm";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { api } from "../lib/api";
import { notify } from "../lib/notify";
import { handleApiError, OperationType } from "../lib/error";
import type { AppSettings, Employee } from "../types";
import { btnSecondary, card, pageShell } from "../lib/ui";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { useAuth } from "../lib/auth";

/**
 * Full-page create / edit employee (better than dense modal for long ASN forms).
 * Routes: /employees/new · /employees/:id/edit
 */
export default function EmployeeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const isEdit = Boolean(id);
  useDocumentTitle(isEdit ? "Ubah pegawai" : "Tambah pegawai");

  // Always wait for settings (kamus) — even create — so jabatan autocomplete works
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [employee, setEmployee] = useState<Employee | undefined>();
  const dirtyRef = useRef(false);
  /** After successful save (or intentional leave), never re-block navigation. */
  const allowLeaveRef = useRef(false);
  const [, setDirtyTick] = useState(0);

  const setDirty = useCallback((v: boolean) => {
    // Ignore late dirty=true after we already decided to leave
    if (allowLeaveRef.current && v) return;
    dirtyRef.current = v;
    setDirtyTick((t) => t + 1);
  }, []);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !allowLeaveRef.current &&
      dirtyRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    dirtyRef.current = false;
    allowLeaveRef.current = false;
    setEmployee(undefined);
    (async () => {
      try {
        // Prefer warm cache so form opens without cold settings round-trip
        const warm =
          api.peekSettings(["kamus", "peta"]) ?? api.peekSettings("all");
        if (warm && !cancelled) {
          setSettings(warm);
        }
        const s = await api.getSettings(["kamus", "peta"]);
        if (cancelled) return;
        setSettings(s);
        if (id) {
          const full = await api.getEmployee(id);
          if (cancelled) return;
          if (!full) {
            notify.error("Pegawai tidak ditemukan");
            allowLeaveRef.current = true;
            dirtyRef.current = false;
            navigate("/employees", { replace: true });
            return;
          }
          setEmployee(full);
        }
      } catch (e) {
        if (cancelled) return;
        notify.error(
          "Gagal memuat formulir",
          handleApiError(e, OperationType.GET, "/api/employees").message,
        );
        allowLeaveRef.current = true;
        dirtyRef.current = false;
        navigate("/employees", { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  // Browser refresh / tab close while dirty
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowLeaveRef.current || !dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const leaveToList = useCallback(() => {
    allowLeaveRef.current = true;
    dirtyRef.current = false;
    navigate("/employees");
  }, [navigate]);

  if (!canWrite) {
    return (
      <div className={pageShell}>
        <div className={`${card} p-6 text-sm text-slate-600`}>
          Mode baca saja. Hubungi admin untuk mengubah data.
          <div className="mt-4">
            <Link to="/employees" className={btnSecondary}>
              Kembali ke daftar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${pageShell} flex items-center justify-center min-h-[40vh] gap-2 text-sm text-slate-500`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Memuat formulir…
      </div>
    );
  }

  return (
    <div className={pageShell}>
      <PageHeader
        title={isEdit ? "Ubah pegawai" : "Tambah pegawai"}
        description="Lengkapi data secara bertahap. Perubahan yang belum disimpan dilindungi saat meninggalkan halaman."
        actions={
          <button
            type="button"
            className={btnSecondary}
            disabled={saving}
            onClick={() => {
              if (dirtyRef.current && !allowLeaveRef.current) {
                // Let useBlocker show discard dialog
                navigate("/employees");
                return;
              }
              leaveToList();
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Daftar
          </button>
        }
      />
      <div className={`${card} p-4 sm:p-6`}>
        <EmployeeForm
          key={employee?.id || "new"}
          initialData={employee}
          settings={settings}
          submitting={saving}
          onDirtyChange={setDirty}
          onCancel={leaveToList}
          onSubmit={async (data) => {
            setSaving(true);
            try {
              // Clear dirty BEFORE network so navigation cannot re-block mid-save
              allowLeaveRef.current = true;
              dirtyRef.current = false;
              if (isEdit && id) {
                await api.updateEmployee(id, data);
                notify.success("Perubahan disimpan");
              } else {
                await api.createEmployee(data);
                notify.success("Pegawai ditambahkan");
              }
              navigate("/employees");
            } catch (e) {
              // Stay on form; re-enable dirty guard
              allowLeaveRef.current = false;
              dirtyRef.current = true;
              setDirtyTick((t) => t + 1);
              notify.error(
                "Gagal menyimpan",
                handleApiError(e, OperationType.WRITE, "/api/employees").message,
              );
            } finally {
              setSaving(false);
            }
          }}
        />
      </div>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        title="Buang perubahan?"
        description="Ada perubahan yang belum disimpan. Tinggalkan formulir ini?"
        confirmLabel="Buang & keluar"
        cancelLabel="Tetap mengisi"
        variant="danger"
        onConfirm={() => {
          allowLeaveRef.current = true;
          dirtyRef.current = false;
          blocker.proceed?.();
        }}
      />
    </div>
  );
}
