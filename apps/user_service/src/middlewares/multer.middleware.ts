import multer, { StorageEngine } from "multer";
import path from "path";
import { logger } from "@repo/common";

// Configure storage
const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../public/banners");
    
    // Ensure directory exists
    const fs = require("fs");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

// File filter - only allow images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"," image/svg"];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn(`Invalid file type: ${file.mimetype}`);
    cb(new Error("Only image files are allowed (JPEG, PNG, WebP, GIF)"));
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export default upload;
