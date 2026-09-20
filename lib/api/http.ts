import { NextResponse } from "next/server";
import { toApiError } from "./errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    { ok: true, data },
    { status: init?.status ?? 200, headers: init?.headers }
  );
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function handleApiError(error: unknown) {
  const apiError = toApiError(error);
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.details === undefined ? {} : { details: apiError.details })
      }
    },
    { status: apiError.status }
  );
}
