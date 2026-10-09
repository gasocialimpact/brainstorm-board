import "./assetPath";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@excalidraw/excalidraw/index.css";
import "./styles.css";

import { App } from "./App";
import { fontsReady, registerGsicFonts } from "./fonts";

registerGsicFonts();

void fontsReady().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
