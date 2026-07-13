/**
 * Prefetch lazy page chunks so navigation does not flash "Memuat halaman…".
 * Keep loaders here (not App.tsx) to avoid circular imports with Layout.
 */

const loadDashboard = () => import("../pages/Dashboard");
const loadEmployees = () => import("../pages/Employees");
const loadEmployeeForm = () => import("../pages/EmployeeFormPage");
const loadPrint = () => import("../pages/Print");
const loadSettings = () => import("../pages/Settings");

export const routeLoaders = {
  dashboard: loadDashboard,
  employees: loadEmployees,
  employeeForm: loadEmployeeForm,
  print: loadPrint,
  settings: loadSettings,
} as const;

/** Prefetch JS chunks so menu clicks feel instant (warm cache). */
export function prefetchRoute(path: string) {
  if (path === "/" || path === "") void loadDashboard();
  else if (path.startsWith("/employees")) {
    void loadEmployees();
    void loadEmployeeForm();
  } else if (path.startsWith("/print")) void loadPrint();
  else if (path.startsWith("/settings")) void loadSettings();
}

export function prefetchAllRoutes() {
  void loadDashboard();
  void loadEmployees();
  void loadEmployeeForm();
  void loadPrint();
  void loadSettings();
}
