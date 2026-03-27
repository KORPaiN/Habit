import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logSecurityEvent } from "@/lib/security/events";

export class ApiError extends Error {
  status: number;
  headers?: HeadersInit;
  code?: string;

  constructor(status: number, message: string, options?: { headers?: HeadersInit; code?: string }) {
    super(message);
    this.status = status;
    this.headers = options?.headers;
    this.code = options?.code;
  }
}

type ResponseOptions = {
  requestId?: string;
  headers?: HeadersInit;
  path?: string;
};

type ReadJsonOptions = {
  maxBytes?: number;
};

const DEFAULT_MAX_JSON_BYTES = 16 * 1024;

function withResponseHeaders(requestId?: string, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);

  if (requestId) {
    responseHeaders.set("X-Request-Id", requestId);
  }

  return responseHeaders;
}

export async function readJson(request: Request, options?: ReadJsonOptions) {
  const contentType = request.headers.get("content-type");

  if (!contentType?.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "Expected an application/json request body.");
  }

  const rawText = await request.text();
  const byteLength = Buffer.byteLength(rawText, "utf8");
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_JSON_BYTES;

  if (byteLength === 0) {
    throw new ApiError(400, "Request body is required.");
  }

  if (byteLength > maxBytes) {
    throw new ApiError(413, "Request body is too large.");
  }

  try {
    return {
      data: JSON.parse(rawText) as unknown,
      rawText,
      byteLength,
    };
  } catch {
    throw new ApiError(400, "Invalid JSON body.");
  }
}

export function ok(data: unknown, status = 200, options?: ResponseOptions) {
  return NextResponse.json(
    {
      data,
      requestId: options?.requestId,
    },
    {
      status,
      headers: withResponseHeaders(options?.requestId, options?.headers),
    },
  );
}

export function fail(error: unknown, options?: ResponseOptions) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: error.flatten(),
        requestId: options?.requestId,
      },
      {
        status: 400,
        headers: withResponseHeaders(options?.requestId, options?.headers),
      },
    );
  }

  if (error instanceof ApiError) {
    const headers = new Headers(withResponseHeaders(options?.requestId, options?.headers));

    if (error.headers) {
      new Headers(error.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }

    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        requestId: options?.requestId,
      },
      { status: error.status, headers },
    );
  }

  logSecurityEvent({
    type: "api_error",
    level: "error",
    requestId: options?.requestId,
    route: options?.path,
    outcome: "error",
    statusCode: 500,
    detail: {
      name: error instanceof Error ? error.name : "UnknownError",
    },
  });

  return NextResponse.json(
    {
      error: "Request could not be completed.",
      requestId: options?.requestId,
    },
    {
      status: 500,
      headers: withResponseHeaders(options?.requestId, options?.headers),
    },
  );
}
