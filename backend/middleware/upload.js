const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|webm/;
  const ext = file.originalname
    ? path.extname(file.originalname).toLowerCase()
    : '';
  // RN/mobile often omits originalname; rely on mimetype when extension is unknown
  const extOk = !ext || allowedTypes.test(ext);
  const mime = (file.mimetype || '').toLowerCase();
  const mimeOk = mime && allowedTypes.test(mime);
  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

module.exports = upload;
