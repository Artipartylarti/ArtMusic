import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPlatform } from "./lib/platform";

// Resolve the OS before first render so TitleBar shows the correct layout
// without a visible flash. We render regardless (initPlatform has a sync
// fallback), so this is best-effort.
initPlatform().finally(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
