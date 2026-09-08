import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { AuthService } from "../services/auth.service.ts";

const PinLoginSchema = z.object({
  userId: z.string(),
  pin: z.string().length(6),
  deviceId: z.string().optional(),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/login/pin",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parsedBody = PinLoginSchema.parse(request.body);
        const result = await AuthService.loginWithPin(
          parsedBody.userId,
          parsedBody.pin,
          parsedBody.deviceId,
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: "VALIDATION_ERROR",
            message: error.issues,
          });
        }
        return reply.code(401).send({
          success: false,
          error: "AUTH_FAILED",
          message: error.message,
        });
      }
    },
  );

  fastify.post(
    "/google-auth",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await AuthService.googleAuth(request.body);

        return reply.send({
          success: true,
          token: result.token,
          tenant: result.tenant,
          user: result.user,
        });
      } catch (error: any) {
        return reply.code(401).send({
          success: false,
          error: "AUTH_FAILED",
          message: error.message,
        });
      }
    },
  );
}
