import { Logger } from "tslog";

export function getLogger(name: string): Logger<unknown> {
  return new Logger({ name });
}
