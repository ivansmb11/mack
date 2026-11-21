/** Minimal client for the control plane, shared by mackctl and the MCP bridge. */
export function apiClient(baseUrl = process.env.MACK_URL ?? "http://127.0.0.1:7777", token = process.env.MACK_TOKEN) {
  if (!token) throw new Error("MACK_TOKEN is required (it lives in ~/.mack/.env)");
  return async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(baseUrl + path, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
    return (text ? JSON.parse(text) : null) as T;
  };
}

export function loadMackEnv(): void {
  const envFile = `${process.env.HOME}/.mack/.env`;
  try {
    process.loadEnvFile(envFile);
  } catch {
    // No env file yet: MACK_TOKEN may come from the environment instead.
  }
}
