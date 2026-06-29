import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
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
      let errorMessage = "Terjadi kesalahan yang tidak terduga.";
      let isPermissionError = false;

      try {
        if (error?.message) {
          const parsedError = JSON.parse(error.message);
          if (
            parsedError.error &&
            parsedError.error.includes("permission-denied")
          ) {
            isPermissionError = true;
            errorMessage =
              "Anda tidak memiliki izin untuk mengakses data ini. Silakan periksa aturan (rules) Firestore di Firebase Console Anda.";
          } else if (parsedError.error) {
            errorMessage = parsedError.error;
          }
        }
      } catch (e) {
        // Not a JSON error string, use default message or error message
        errorMessage = error?.message || errorMessage;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6 flex flex-col items-center text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              Oops! Terjadi Kesalahan
            </h2>
            <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
            {isPermissionError && (
              <div className="text-xs text-red-500 bg-red-100 p-3 rounded-lg text-left w-full">
                <p className="font-semibold mb-1">Cara Mengatasi:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Buka Firebase Console</li>
                  <li>Pilih project Anda</li>
                  <li>Buka menu Firestore Database</li>
                  <li>Pilih tab "Rules"</li>
                  <li>
                    Sesuaikan aturan untuk mengizinkan akses ke koleksi yang
                    dituju.
                  </li>
                </ol>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
