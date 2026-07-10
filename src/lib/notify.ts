import { toast } from "sonner";

/** Single feedback language for the app — prefer this over alert(). */
export const notify = {
  success(title: string, description?: string) {
    toast.success(title, description ? { description } : undefined);
  },
  error(title: string, description?: string) {
    toast.error(title, description ? { description } : undefined);
  },
  info(title: string, description?: string) {
    toast(title, description ? { description } : undefined);
  },
  warning(title: string, description?: string) {
    toast.warning(title, description ? { description } : undefined);
  },
};
