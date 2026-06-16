import express from "express";
import type { Express, Request, Response, NextFunction } from "express"
import { authRouter } from "./modules";

const bootstrap = () => {
  const port = process.env.PORT || 3000;
  const app:Express = express();

  app.use(express.json())
  //application routing
  app.get("/", async (req:Request, res:Response , next:NextFunction):Promise<void> => {
    res.send("Hello World! Welcome to Fakebook");
  });
  app.use("/auth", authRouter);
  // app.use("/user", userRouter);
  // app.use("/message", messageRouter);

  //invalid routing
  app.use("{/*dummy}", (req:Request, res:Response, next:NextFunction) => {
  res.status(404).json({ message: "Invalid application routing" });
  });

  //success response
  // app.use(successResponse as any);

  //error-handling
  // app.use(globalErrorHandling as any);
  // app.use(ErrorException as any);
  // app.use(NotFoundException as any);
  // app.use(ConflictException as any);

  app.listen(port, () => console.log(`Fakebook app listening on port ${port}!`));

}

export default bootstrap;