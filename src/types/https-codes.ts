export const HttpCodes = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const HttpMessages = {
  NOT_FOUND: "Not Found",
  UNAUTHORIZED: "Unauthorized",
  INTERNAL_SERVER_ERROR: "Internal Server Error",
} as const;
