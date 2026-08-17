import multer from "multer";


export const cloudFileUpload = () => {
  const storage = multer.memoryStorage();
  const upload = multer({ storage });
  return upload;
};