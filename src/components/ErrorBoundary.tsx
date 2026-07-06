import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

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
      const errorMessage = error?.message || "Terjadi kesalahan yang tidak terduga.";

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col items-center text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              Oops! Terjadi Kesalahan
            </h2>
            <p className="text-sm text-red-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-[0.98] transition-all text-sm font-medium"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
