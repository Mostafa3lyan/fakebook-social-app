import connectDB from "./DB/connection.db";
import express from "express";
import type { Express, Request, Response, NextFunction } from "express"
import { authRouter } from "./modules";
import { globalErrorHandler } from "./middleware";
import { port } from "./config/config.service";
import { redisService } from "./common/services/redis.service";
import { userRouter } from "./modules/user";
import cors from "cors";

const bootstrap = async () => {
  const app: Express = express();

  app.use(express.json(), cors());

  //application routing
  app.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    res.send("Hello World! Welcome to Fakebook");
  });
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