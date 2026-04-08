import "dotenv/config";
import { createApp } from "./app";

const app = createApp();

const port = Number(process.env.PORT ?? "4000");
app.listen(port, "0.0.0.0", () => {
  process.stdout.write(`server listening on 0.0.0.0:${port}\n`);
});
