import { All, Controller, Inject, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { type MackConfig, MACK_CONFIG } from "../config/config.js";
import { DsaService } from "../dsa/dsa.service.js";
import type { Usage } from "../ledger/ledger.schemas.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { FETCH, type Fetch } from "../matrix/fetch.js";

/**
 * OpenAI-compatible front door to Mack so any chat client (Open WebUI, mobile apps) can talk to it
 * with MACK_TOKEN; the orchestrator's own API_SERVER_KEY never leaves the Mac mini.
 */
@Controller("v1")
export class OpenAiProxyController {
  constructor(
    private readonly dsas: DsaService,
    private readonly ledger: LedgerService,
    @Inject(FETCH) private readonly fetch: Fetch,
    @Inject(MACK_CONFIG) private readonly config: MackConfig,
  ) {}

  @All("{*path}")
  async proxy(@Req() req: Request, @Res() res: Response) {
    const orchestrator = this.config.hermes.orchestrator;
    await this.ledger.assertWithinBudget(orchestrator);
    const upstream = await this.fetch(`http://127.0.0.1:${this.config.hermes.orchestratorPort}${req.originalUrl}`, {
      method: req.method,
      headers: { "content-type": "application/json", authorization: `Bearer ${this.dsas.apiKey(orchestrator)}` },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    res.status(upstream.status);
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    res.setHeader("content-type", contentType);
    if (!contentType.includes("application/json")) {
      for await (const chunk of upstream.body ?? []) res.write(chunk);
      return res.end();
    }

    const body = (await upstream.json()) as { usage?: Usage; model?: string };
    if (body.usage) {
      const model = (await this.dsas.get(orchestrator))?.model ?? body.model ?? "unknown";
      await this.ledger.record(orchestrator, model, body.usage, "api");
    }
    return res.json(body);
  }
}
