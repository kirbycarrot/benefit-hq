export async function readJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  const data = await readJsonResponse<{ error?: unknown }>(response);
  return typeof data?.error === "string" ? data.error : fallback;
}
