// import multer from "multer";
// import { randomUUID } from "node:crypto";
// import { existsSync, mkdirSync } from "node:fs";
// import { resolve } from "node:path";
// import { fileFilter } from "./validation.multer.js";

// export const localFileUpload = ({
//   customPath = "general",
//   validation = [] as string[],
//   maxSize = 5,
// } = {}) => {
//   const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//       const fullPath = resolve(`../uploads/${customPath}`);
//       if (!existsSync(fullPath)) {
//         mkdirSync(fullPath, { recursive: true });
//       }
//       cb(null, fullPath);
//     },

//     filename: (req, file: any, cb) => {
//       const uniqueFileName = randomUUID() + "-" + file.originalname;
//       file.finalPath = `uploads/${customPath}/${uniqueFileName}`;
//       cb(null, uniqueFileName);
//     },
//   });
//   const upload = multer({
//     fileFilter: fileFilter(validation),
//     storage,
//     limits: { fileSize: maxSize * 1024 * 1024 },
//   });
//   return upload;
// };
