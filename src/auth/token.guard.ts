import { timingSafeEqual } from "node:crypto";
import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

const IS_PUBLIC = "mack:isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const MACK_TOKEN = Symbol("MACK_TOKEN");

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Every route needs `Authorization: Bearer $MACK_TOKEN` unless marked @Public(). */
@Injectable()
export class TokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(MACK_TOKEN) private readonly token: string,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const provided = context.switchToHttp().getRequest<Request>().headers.authorization?.replace(/^Bearer /, "") ?? "";
    if (!safeEqual(provided, this.token)) throw new UnauthorizedException();
    return true;
  }
}
