import express from 'express';
import { handleExternalUpload, proxyCloudinaryImage, proxyAzureImage } from '../controllers/storageController.js';

const router = express.Router();

router.post('/upload', handleExternalUpload);
router.get('/view', proxyCloudinaryImage);
router.get('/azure/view', proxyAzureImage);

export default router;
