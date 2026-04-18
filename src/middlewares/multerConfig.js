// multerConfig.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const MAX_FILE_SIZE_MB = 15;
const WEBP_QUALITY = 82;
let sharpLoadPromise = null;
let sharpUnavailableLogged = false;

const resolveSharp = async () => {
  if (!sharpLoadPromise) {
    sharpLoadPromise = import('sharp')
      .then((module) => module.default ?? module)
      .catch(() => null);
  }

  return sharpLoadPromise;
};

const getExtensionFromFile = (file) => {
  const extFromName = path.extname(file?.originalname || '').toLowerCase();
  if (extFromName) return extFromName;

  const mimeToExt = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'image/svg+xml': '.svg',
  };

  return mimeToExt[file?.mimetype] || '.bin';
};

// Middleware factory que recibe una subcarpeta (por ejemplo: 'profiles', 'products', etc.)
const createUploader = (folderName = 'general') => {
  const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  };

  const multerInstance = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 1024 * 1024 * MAX_FILE_SIZE_MB },
  });

  const persistAsWebp = async (req, res, next) => {
    try {
      const filesToProcess = [];

      if (req.file) {
        filesToProcess.push(req.file);
      }

      if (Array.isArray(req.files)) {
        filesToProcess.push(...req.files);
      } else if (req.files && typeof req.files === 'object') {
        Object.values(req.files).forEach((entry) => {
          if (Array.isArray(entry)) {
            filesToProcess.push(...entry);
          }
        });
      }

      if (filesToProcess.length === 0) {
        return next();
      }

      const relativeUploadDir = ['uploads', folderName].join('/');
      const absoluteUploadDir = path.join(process.cwd(), relativeUploadDir);
      fs.mkdirSync(absoluteUploadDir, { recursive: true });
      const sharp = await resolveSharp();

      if (!sharp && !sharpUnavailableLogged) {
        sharpUnavailableLogged = true;
        console.warn(
          '[multerConfig] El paquete sharp no está disponible. Se guardarán imágenes sin convertir a WEBP hasta instalar sharp.'
        );
      }

      await Promise.all(
        filesToProcess.map(async (file) => {
          const extension = sharp ? '.webp' : getExtensionFromFile(file);
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
          const relativePath = `${relativeUploadDir}/${uniqueName}`;
          const absolutePath = path.join(process.cwd(), relativePath);

          if (sharp) {
            await sharp(file.buffer)
              .rotate()
              .webp({ quality: WEBP_QUALITY })
              .toFile(absolutePath);
          } else {
            fs.writeFileSync(absolutePath, file.buffer);
          }

          const outputStats = fs.statSync(absolutePath);

          file.filename = uniqueName;
          file.path = relativePath;
          if (sharp) {
            file.mimetype = 'image/webp';
          }
          file.size = outputStats.size;
          delete file.buffer;
        })
      );

      return next();
    } catch (error) {
      return next(error);
    }
  };

  const withWebp = (middleware) => {
    return (req, res, next) => {
      middleware(req, res, (error) => {
        if (error) {
          return next(error);
        }

        return persistAsWebp(req, res, next);
      });
    };
  };

  return {
    single: (fieldName) => withWebp(multerInstance.single(fieldName)),
    array: (fieldName, maxCount) => withWebp(multerInstance.array(fieldName, maxCount)),
    fields: (fields) => withWebp(multerInstance.fields(fields)),
    any: () => withWebp(multerInstance.any()),
    none: () => multerInstance.none(),
  };
};

export default createUploader;
