import multer from 'multer';
import { env } from '../../config/env.js';

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_BYTES,
    files: 1,
    fields: 10,
    fieldSize: 4096,
    parts: 15,
  },
}).single('file');
