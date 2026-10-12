import closeWithGrace from "close-with-grace";
import { buildApp } from "./app.ts";

const app = await buildApp();

closeWithGrace({ delay: 10_000 }, async ({ err }) => {
  if (err) {
    app.log.error({ err }, "server closing with error");
  }

  await app.close();
});

try {
  await app.listen({ host: app.config.HOST, port: app.config.PORT });
} catch (error) {
  app.log.error({ err: error }, "failed to start server");
  await app.close();
  process.exit(1);
}
