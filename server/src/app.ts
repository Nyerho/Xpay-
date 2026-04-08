import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { consumerRouter } from "./routes/consumer";
import { publicRouter } from "./routes/public";

export function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/public", publicRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/consumer", consumerRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    process.stderr.write((err instanceof Error ? err.stack ?? err.message : String(err)) + "\n");
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
