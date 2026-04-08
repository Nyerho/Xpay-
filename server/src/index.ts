import "dotenv/config";
import { createApp } from "./app";
import { bootstrap } from "./bootstrap";

const app = createApp();

const port = Number(process.env.PORT ?? "4000");
bootstrap()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      process.stdout.write(`server listening on 0.0.0.0:${port}\n`);
    });
  })
  .catch((err) => {
    process.stderr.write(String(err) + "\n");
    process.exit(1);
  });
