import express from 'express';
import { handleExternalUpload, proxyCloudinaryImage } from '../controllers/storageController.js';

const router = express.Router();

router.post('/upload', handleExternalUpload);
router.get('/view', proxyCloudinaryImage);

export default router;
