const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /anthropic-[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/g,
  /token["'\s:=]+["']?[a-zA-Z0-9._-]{20,}/gi,
];

export function redactSensitive(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

export function redactObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    return redactSensitive(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, redactObject(v)]));
  }
  return obj;
}
