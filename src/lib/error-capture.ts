let lastError: any = null;

if (typeof process !== "undefined" && process.on) {
  process.on("uncaughtException", (err) => {
    lastError = err;
    console.error("CAPTURED UNCAUGHT EXCEPTION:", err);
  });
  process.on("unhandledRejection", (err) => {
    lastError = err;
    console.error("CAPTURED UNHANDLED REJECTION:", err);
  });
}

export function setCapturedError(err: any) {
  lastError = err;
}

export function consumeLastCapturedError() {
  return (globalThis as any).__LAST_SSR_ERROR__ || lastError;
}
