import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { type DispatchRequest, DispatchSchema, FanoutSchema } from "./matrix.schemas.js";
import { MatrixService } from "./matrix.service.js";

@Controller("api")
export class MatrixController {
  constructor(private readonly matrix: MatrixService) {}

  @Post("matrix/route")
  @HttpCode(200)
  route(@Body({ schema: DispatchSchema }) req: DispatchRequest) {
    return this.matrix.route(req.task);
  }

  @Post("matrix/dispatch")
  @HttpCode(200)
  dispatch(@Body({ schema: DispatchSchema }) req: DispatchRequest) {
    return this.matrix.dispatch(req);
  }

  @Post("matrix/fanout")
  @HttpCode(200)
  fanout(@Body({ schema: FanoutSchema }) requests: DispatchRequest[]) {
    return this.matrix.fanout(requests);
  }

  @Get("agents/health")
  health() {
    return this.matrix.health();
  }
}
