import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { btnPrimary, btnSecondary, card } from "../lib/ui";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    const { hasError, error } = this.state;
    if (hasError) {
      // Operator-facing copy — never surface raw framework stack messages
      const technical = error?.message || "";
      const isRouter =
        /useBlocker|data router|RouterProvider|createBrowserRouter/i.test(
          technical,
        );
      const errorMessage = isRouter
        ? "Navigasi halaman bermasalah. Muat ulang, atau hubungi admin jika berulang."
        : "Terjadi kesalahan saat menampilkan halaman. Data Anda aman — coba muat ulang.";

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div
            className={`${card} max-w-md w-full p-6 flex flex-col items-center text-center border-red-100`}
          >
            <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-2">
              Terjadi Kesalahan
            </h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              {errorMessage}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className={btnPrimary}
              >
                Coba Lagi
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={btnSecondary}
              >
                Muat Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
