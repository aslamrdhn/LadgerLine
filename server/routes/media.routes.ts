import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { sanitizeString } from "../utils/sanitizer.ts";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "menus");

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

const MIME_TO_EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};

export async function mediaRoutes(fastify: FastifyInstance) {
  await ensureUploadDir();

  /**
   * POST /api/media/upload
   * Accepts a base64 DataURL (preferably client-compressed WebP) and persists it
   * as a binary file on disk, returning a lightweight URL instead of storing Base64 in DB.
   */
  fastify.post(
    "/media/upload",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = (request.body as any) || {};
        const rawDataUrl = String(
          body.imageData ||
            body.dataUrl ||
            body.base64Data ||
            body.image ||
            body.file ||
            "",
        ).trim();

        if (!rawDataUrl.startsWith("data:image/")) {
          return reply.status(400).send({
            success: false,
            message: "Format gambar tidak valid (harus berupa DataURL image/*).",
          });
        }

        const matches = rawDataUrl.match(
          /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/,
        );
        if (!matches || matches.length !== 3) {
          return reply.status(400).send({
            success: false,
            message: "Payload base64 gambar rusak atau tidak lengkap.",
          });
        }

        const mimeType = matches[1].toLowerCase();
        const ext = MIME_TO_EXT[mimeType] || "webp";
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, "base64");

        // Enforce 2.5MB max binary size after compression
        if (buffer.byteLength > 2.5 * 1024 * 1024) {
          return reply.status(413).send({
            success: false,
            message: "Ukuran file gambar melebihi batas maksimum 2.5MB.",
          });
        }

        await ensureUploadDir();
        const prefix = sanitizeString(body.prefix || "menu", 24)
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "");
        const hash = crypto
          .createHash("sha1")
          .update(buffer)
          .digest("hex")
          .slice(0, 12);
        const fileName = `${prefix || "menu"}-${Date.now()}-${hash}.${ext}`;
        const filePath = path.join(UPLOAD_DIR, fileName);

        await fs.writeFile(filePath, buffer);

        const imageUrl = `/api/media/files/${fileName}`;
        return reply.send({
          success: true,
          fileName,
          mimeType,
          sizeBytes: buffer.byteLength,
          imageUrl,
          url: imageUrl,
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          message: "Gagal menyimpan file gambar: " + (err?.message || "Error"),
        });
      }
    },
  );

  /**
   * GET /api/media/files/:fileName
   * Streams uploaded menu images with immutable cache headers.
   */
  fastify.get(
    "/media/files/:fileName",
    async (
      request: FastifyRequest<{ Params: { fileName: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const rawName = path.basename(request.params.fileName || "");
        const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "");
        if (!safeName) {
          return reply.status(404).send({ error: "File not found" });
        }

        const fullPath = path.join(UPLOAD_DIR, safeName);
        const fileBuffer = await fs.readFile(fullPath);
        const ext = path.extname(safeName).toLowerCase();

        const contentType =
          ext === ".webp"
            ? "image/webp"
            : ext === ".png"
              ? "image/png"
              : "image/jpeg";

        reply.header("Content-Type", contentType);
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
        return reply.send(fileBuffer);
      } catch {
        return reply.status(404).send({ error: "Image not found" });
      }
    },
  );
}
