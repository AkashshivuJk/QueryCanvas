import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      richColors
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "rounded-lg border border-border",
        },
      }}
    />
  );
}

export { toast } from "sonner";