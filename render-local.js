import { createWriteStream, createReadStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

// Development only: save a generated film into this project's ignored renders folder.
export function localRenderFiles() {
  return {
    name: "pixelrush-local-render-files",
    configureServer(server) {
      server.middlewares.use(
        "/__pixelrush/render",
        async (request, response) => {
          const url = new URL(request.url, "http://localhost");
          const name = url.searchParams.get("name");
          if (!/^pixelrush-(preview-)?(1080|2160)p60\.mp4$/.test(name || "")) {
            response.writeHead(400);
            response.end("Invalid render name");
            return;
          }
          const origin = request.headers.origin;
          if (
            request.headers["sec-fetch-site"] === "cross-site" ||
            (origin && origin !== `http://${request.headers.host}`)
          ) {
            response.writeHead(403);
            response.end("Local requests only");
            return;
          }
          const directory = resolve(server.config.root, "renders"),
            destination = resolve(directory, name);
          if (request.method === "POST") {
            const temporary = `${destination}.${randomUUID()}.partial`;
            try {
              await mkdir(directory, { recursive: true });
              let bytes = 0;
              const limit = new Transform({
                transform(chunk, _encoding, callback) {
                  bytes += chunk.length;
                  callback(
                    bytes > 2_000_000_000
                      ? new Error("Render is too large")
                      : null,
                    chunk,
                  );
                },
              });
              await pipeline(request, limit, createWriteStream(temporary));
              await rename(temporary, destination);
              response.writeHead(200, { "Content-Type": "application/json" });
              response.end(JSON.stringify({ path: destination, bytes }));
            } catch (error) {
              await rm(temporary, { force: true });
              if (!response.headersSent) response.writeHead(500);
              response.end("Could not save render");
            }
          } else if (request.method === "GET") {
            try {
              const file = await stat(destination);
              response.writeHead(200, {
                "Content-Type": "video/mp4",
                "Content-Length": file.size,
                "Content-Disposition": `attachment; filename="${name}"`,
              });
              createReadStream(destination).pipe(response);
            } catch {
              response.writeHead(404);
              response.end("Render not found");
            }
          } else {
            response.writeHead(405);
            response.end("Method not allowed");
          }
        },
      );
    },
  };
}
