export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "알 수 없는 오류가 발생했습니다.";
  }
}

export function isPermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("permission") || lower.includes("권한") || lower.includes("access is denied");
}
