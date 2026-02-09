#!/usr/bin/env node
import { formatUncaughtError } from "../core/infra/errors.ts";
import { getLogger } from "../core/logging/logger.ts";
import { createProgram } from "./program.ts";

const logger = getLogger("cli");

process.on("uncaughtException", (err) => {
  const message = formatUncaughtError(err);
  logger.fatal({ err: message }, "Uncaught exception in CLI");
  console.error(`\n错误: ${message}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const message = formatUncaughtError(reason);
  logger.error({ err: message }, "Unhandled rejection in CLI");
  console.error(`\n未处理的异步错误: ${message}`);
});

const program = createProgram();
await program.parseAsync(process.argv);
