import { Global, Module } from "@nestjs/common";

/** Outbound HTTP to local Hermes API servers; overridden in tests. */
export const FETCH = Symbol("FETCH");
export type Fetch = typeof fetch;

@Global()
@Module({ providers: [{ provide: FETCH, useValue: (...args: Parameters<Fetch>) => fetch(...args) }], exports: [FETCH] })
export class FetchModule {}
