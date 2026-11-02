import { FastifyRequest, FastifyReply } from "fastify";
import { sanitizePayload } from "../utils/sanitizer.ts";

/**
 * Fastify preValidation hook that automatically sanitizes request.body,
 * request.query, and request.params before any route handler or validator runs.
 */
export async function sanitizeRequestHook(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  if (request.body && typeof request.body === "object") {
    request.body = sanitizePayload(request.body);
  }
  if (request.query && typeof request.query === "object") {
    request.query = sanitizePayload(request.query);
  }
  if (request.params && typeof request.params === "object") {
    request.params = sanitizePayload(request.params);
  }
}
