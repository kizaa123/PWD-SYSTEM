import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { LoadingProvider } from "./lib/loading";
import App from "./App";
import { RegistrationSyncBootstrap } from "./components/RegistrationSyncBootstrap";
import "./index.css";

document.documentElement.classList.remove("dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LoadingProvider>
      <BrowserRouter>
        <AuthProvider>
          <RegistrationSyncBootstrap />
          <App />
        </AuthProvider>
      </BrowserRouter>
    </LoadingProvider>
  </StrictMode>,
);
