import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 1. Path Setup (ONLY ONCE)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = path.join(__dirname, '.env');

// 2. Environment Configuration (ONLY ONCE)
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    console.log("✅ .env file found at:", envPath);
} else {
    console.error("❌ .env file NOT found at:", envPath);
}

// 3. Library Imports
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// 4. Internal Imports
import { connectDB } from './configs/mongodb.js';
import { app, server } from "./lib/socket.js";
import { backupDbs } from './scripts/backup.js';
import authRouter from './routes/authApi.js';
import messageRouter from './routes/messageApi.js';
import libraryRouter from './routes/libraryApi.js';
import gamesRouter from './routes/gamesApi.js';
import searchRouter from './routes/searchAPI.js';
import storageRouter from './routes/storageApi.js';

// --- Root Route ---
app.get('/', (req, res) => {
    res.status(200).json({
        status: "Success",
        message: "Chat App API is online",
        database: "Connected",
        time: new Date().toLocaleString()
    });
});

// --- Health Check Route ---
app.get('/health', (req, res) => {
    res.status(200).json({
        status: "UP",
        message: "Server is running healthy ✅",
        uptime: `${Math.floor(process.uptime())}s`,
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString()
    });
});

// --- Middleware ---
app.use(cookieParser());
app.use(cors({
    origin: true,
    credentials: true
}));

// Use 50mb limit for image handling
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (for serving locally saved images)
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- API Routes ---
app.use('/api/auth', authRouter);
app.use('/api/messages', messageRouter);
app.use('/api/library', libraryRouter);
app.use('/api/games', gamesRouter);
app.use('/api/search', searchRouter);
app.use('/api/storage', storageRouter);

// --- Production Handling ---
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));
    app.get(/(.*)/, (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
    });
}

const PORT = process.env.PORT || 5001;

// --- Database & Server Startup ---
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        
        // Start Periodic Backups using interval from .env
        const backupIntervalHours = parseFloat(process.env.BACKUP_INTERVAL_HOURS) || 6;
        const backupIntervalMs = backupIntervalHours * 60 * 60 * 1000;
        
        console.log(`⏰ Scheduled periodic backups every ${backupIntervalHours} hours.`);
        setInterval(() => {
            console.log("⏰ Running scheduled periodic backup...");
            backupDbs().catch(err => console.error("Periodic Backup Error:", err));
        }, backupIntervalMs);
    });
}).catch(err => {
    console.error("❌ Critical Failure: Could not start server", err);
});