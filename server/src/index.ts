import "dotenv/config";
import { createApp } from "./app";

const app = createApp();

const port = Number(process.env.PORT ?? "4000");
app.listen(port, () => {
  process.stdout.write(`server listening on http://localhost:${port}\n`);
});
