import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster } from "@/components/ui/toast";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <ThemeProvider>
        <App />
        <Toaster />
      </ThemeProvider>
    </QueryProvider>
  </StrictMode>,
);