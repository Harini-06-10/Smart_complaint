const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safe);
  },
});

// Accept only images and videos (photo / video evidence)
function fileFilter(req, file, cb) {
  if (/^(image|video)\//.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only image or video files are allowed'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024, files: 5 }, // 15 MB each, max 5 files
});

module.exports = upload;
