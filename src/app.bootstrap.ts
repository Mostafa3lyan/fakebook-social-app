import connectDB from "./DB/connection.db";
import express from "express";
import type { Express, Request, Response, NextFunction } from "express"
import { authRouter } from "./modules";
import { globalErrorHandler } from "./middleware";
import { port } from "./config/config.service";
import { redisService } from "./common/services/redis.service";
import { userRouter } from "./modules/user";
import cors from "cors";
import { successResponse } from "./common/response";
import { s3Service } from "./common/services";
import { promisify } from "node:util";
import { pipeline } from "node:stream";
import { NotFoundException } from "./common/exceptions";

const s3WriteStream = promisify(pipeline);

const bootstrap = async () => {
  const app: Express = express();

  app.use(express.json(), cors());

  //application routing
  app.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    res.send("Hello World! Welcome to Fakebook");
  });

  app.get("/uploads/*path", async (req: Request, res: Response, next: NextFunction) => {
    const { download, fileName } = req.query;    
    const path = req.params.path as string[];
    const key = path.join("/");
    const { Body, ContentType } = await s3Service.getAsset({ key });

    if (!Body) {
      throw new NotFoundException("Asset not found");
    }

    res.setHeader(
      "Content-Type",
      ContentType || "application/octet-stream"
    );
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    if (download === "true") {
      res.setHeader("Content-Disposition", `attachment; filename="${fileName || key.split("/").pop()}"`);
    }

    return await s3WriteStream(Body as NodeJS.ReadableStream, res);
  })

  app.get("/pre-signed/*path", async (req: Request, res: Response, next: NextFunction) => {
    const { download, fileName } = req.query as { download: string, fileName: string };
    const path = req.params.path as string[];
    const key = path.join("/");
    const url = await s3Service.getPreSignedUrl({ key, download, fileName });

    return successResponse({ res, data: { url } });
  })

  app.use("/auth", authRouter);
  app.use("/user", userRouter);
  // app.use("/message", messageRouter);

  //invalid routing
  app.use("{/*dummy}", (req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({ message: "Invalid application routing" });
  });

  // error-handling
  app.use(globalErrorHandler);

  await connectDB();
  await redisService.connect();
  app.listen(port, () => console.log(`Fakebook app listening on port ${port}!`));

}

export default bootstrap;