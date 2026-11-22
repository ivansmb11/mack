const TOKEN_KEY = "mack.token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const UNAUTHORIZED_EVENT = "mack:unauthorized";

export const onUnauthorized = (handler: () => void) => {
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
};

/** Nest errors carry `message` as a string or a list of validation messages. */
function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(". ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

export async function api<T>(path: string, init: RequestInit & { yaml?: string } = {}): Promise<T> {
  const { yaml, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    body: yaml ?? rest.body,
    headers: {
      authorization: `Bearer ${tokenStore.get() ?? ""}`,
      "content-type": yaml ? "application/yaml" : "application/json",
      ...rest.headers,
    },
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(401, "El token no es válido.");
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, errorMessage(body, `Error ${res.status}`));
  return body as T;
}

export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const del = (path: string) => api<null>(path, { method: "DELETE" });

export async function verifyToken(token: string): Promise<boolean> {
  const res = await fetch("/api/agents", { headers: { authorization: `Bearer ${token}` } });
  return res.ok;
}
