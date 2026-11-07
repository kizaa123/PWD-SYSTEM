import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Express } from "express";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolved folder containing built index.html (Vite `frontend/dist` or packaged `web/`). */
export function resolveWebDist(): string | null {
  const fromEnv = process.env.PWD_WEB_DIST?.trim();
  if (fromEnv) {
    const resolved = path.resolve(fromEnv);
    if (fs.existsSync(path.join(resolved, "index.html"))) return resolved;
  }
  const candidates = [
    path.resolve(__dirname, "../../frontend/dist"),
    path.resolve(__dirname, "../web"),
    path.resolve(__dirname, "../../web"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

export function attachWebApp(app: Express, webDist: string) {
  app.use(express.static(webDist, { index: false, maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));

  app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.includes(".")) return next();
    res.sendFile(path.join(webDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}
