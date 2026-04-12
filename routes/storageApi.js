import express from 'express';
import { handleExternalUpload, proxyCloudinaryImage, proxyAzureImage } from '../controllers/storageController.js';

const router = express.Router();

router.post('/upload', handleExternalUpload);
router.get('/view', proxyCloudinaryImage);           // legacy cloudinary proxy
router.get('/azure/view', proxyAzureImage);          // legacy query-param proxy (kept for compat)
router.get('/images/*blobPath', proxyAzureImage);    // new clean path: /api/storage/images/<userId>/<context>/<file>

export default router;
