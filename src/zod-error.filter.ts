import { type ArgumentsHost, Catch, type ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";

/** Services validate with Zod too (YAML specs, templates); surface those failures as 400 like the pipe does. */
@Catch(ZodError)
export class ZodErrorFilter implements ExceptionFilter {
  catch(error: ZodError, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().status(400).json({ statusCode: 400, message: "Validation failed", issues: error.issues });
  }
}
