import { Command } from "commander";

export function createProgram(): Command {
  const program = new Command();

  program.name("yiyi").description("YiYi - AI-powered real estate assistant").version("0.1.0");

  program
    .command("gateway")
    .description("Start the gateway server")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .option("-h, --host <host>", "Host to bind to", "localhost")
    .action(async (opts) => {
      const { startServer } = await import("../gateway/server.ts");
      await startServer({ port: Number(opts.port), host: opts.host });
    });

  return program;
}
