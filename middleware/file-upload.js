// const multer = require('multer');
// const { v4: uuidv4 } = require('uuid');

// const MIME_TYPE_MAP = {
//   'image/png': 'png',
//   'image/jpeg': 'jpeg',
//   'image/jpg': 'jpg'
// };

// const fileUpload = multer({
//   limits: 500000,
//   storage: multer.diskStorage({
//     destination: (req, file, cb) => {
//       cb(null, 'uploads/images');
//     },
//     filename: (req, file, cb) => {
//       const ext = MIME_TYPE_MAP[file.mimetype];
//       cb(null, uuidv4() + '.' + ext);
//     }
//   }),
//   fileFilter: (req, file, cb) => {
//     const isValid = !!MIME_TYPE_MAP[file.mimetype];
//     let error = isValid ? null : new Error('Invalid mime type!');
//     cb(error, isValid);
//   }
// });

// module.exports = fileUpload;

const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const MIME_TYPE_MAP = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
};

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Ensure local dir exists (dev only)
const ensureLocalDir = () => {
  const uploadDir = path.join(__dirname, '..', 'uploads', 'images');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
};

// Manual upload to Cloudinary (from buffer)
const uploadToCloudinary = (buffer, mimetype) => {
  return new Promise((resolve, reject) => {
    const ext = MIME_TYPE_MAP[mimetype];
    if (!ext) return reject(new Error('Invalid file type'));

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'chatapp/profiles',
        public_id: `profile_${uuidv4()}`,
        format: ext,
        transformation: [{ width: 500, height: 500, crop: 'limit' }], // Optional resize
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url); // Returns the URL
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// Multer setup: Memory for prod, disk for dev
let storage;
if (process.env.NODE_ENV === 'production') {
  // Prod: Memory (no disk for Render)
  storage = multer.memoryStorage();
} else {
  // Dev: Local disk
  ensureLocalDir();
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'images')),
    filename: (req, file, cb) => {
      const ext = MIME_TYPE_MAP[file.mimetype];
      if (!ext) return cb(new Error('Invalid mime type'));
      cb(null, `${uuidv4()}.${ext}`);
    },
  });
}

const fileUpload = multer({
  limits: { fileSize: 500000 }, // 500KB
  storage,
  fileFilter: (req, file, cb) => {
    const isValid = !!MIME_TYPE_MAP[file.mimetype];
    cb(isValid ? null : new Error('Invalid mime type!'), isValid);
  },
});

module.exports = { fileUpload, uploadToCloudinary };