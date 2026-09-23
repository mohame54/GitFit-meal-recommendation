import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HttpCodes, HttpMessages } from "../types/https-codes.js";
import { NodeEnv } from "../types/enums.js";
import { parseEnv } from "../env-parser.js";
import type { AppEnv } from "../lib/create-router.js";

const onError: ErrorHandler<AppEnv> = (err, c) => {
  c.var.logger.error({ err }, "Unhandled request error");

  const currentStatus = "status" in err ? err.status : c.newResponse(null).status;
  const statusCode =
    currentStatus !== HttpCodes.OK
      ? (currentStatus as ContentfulStatusCode)
      : HttpCodes.INTERNAL_SERVER_ERROR;

  const { NODE_ENV } = parseEnv();
  return c.json(
    {
      message: `${HttpMessages.INTERNAL_SERVER_ERROR} - ${err.message}`,
      stack: NODE_ENV === NodeEnv.PRODUCTION ? undefined : err.stack,
    },
    statusCode,
  );
};

export default onError;
