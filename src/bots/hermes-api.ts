import { HttpException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { type MackConfig, MACK_CONFIG } from "../config/config.js";
import { DsaService } from "../dsa/dsa.service.js";
import { FETCH, type Fetch } from "../matrix/fetch.js";

type HermesInit = Omit<RequestInit, "body"> & { json?: unknown };

/** Hermes reports errors as `{error: "..."}` or OpenAI-style `{error: {message}}`. */
function hermesError(body: unknown, fallback: string): string {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return fallback;
}

/** A profile's own API behind the Hermes host gateway (/p/<profile>/...), authenticated with its key. */
@Injectable()
export class HermesApi {
  constructor(
    private readonly dsas: DsaService,
    @Inject(MACK_CONFIG) private readonly config: MackConfig,
    @Inject(FETCH) private readonly fetch: Fetch,
  ) {}

  async request(profile: string, path: string, { json, headers, ...init }: HermesInit = {}): Promise<Response> {
    try {
      return await this.fetch(`${this.config.hermes.apiUrl}/p/${profile}${path}`, {
        ...init,
        ...(json !== undefined && { body: JSON.stringify(json) }),
        headers: {
          authorization: `Bearer ${this.dsas.apiKey(profile)}`,
          ...(json !== undefined && { "content-type": "application/json" }),
          ...headers,
        },
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new ServiceUnavailableException(`El gateway de Hermes no responde: ${(err as Error).message}`);
    }
  }

  async json<T>(profile: string, path: string, init?: HermesInit): Promise<T> {
    const res = await this.request(profile, path, init);
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) throw new HttpException(hermesError(body, `Hermes respondió ${res.status}`), res.status >= 500 ? 502 : res.status);
    return body as T;
  }
}
