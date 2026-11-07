import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.ts";
import { applicantRouter } from "./routes/applicants.ts";
import { applicationRouter } from "./routes/applications.ts";
import { adminRouter } from "./routes/admin.ts";
import { attachWebApp, resolveWebDist } from "./serve-web.ts";
import "./db/index.ts";

const app = express();
const PORT = Number(process.env.PORT || 4000);

if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "PWD Care Register", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/applicants", applicantRouter);
app.use("/api/applications", applicationRouter);
app.use("/api", adminRouter);

const webDist = resolveWebDist();
if (webDist) {
  attachWebApp(app, webDist);
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const e = err as { status?: number; message?: string };
  res.status(e.status || 500).json({ error: e.message || "Unexpected server error" });
});

app.listen(PORT, () => {
  const web = webDist ? ` · web app on http://localhost:${PORT}/` : "";
  console.log(`PWD Care API listening on http://localhost:${PORT}/api/health${web}`);
});
