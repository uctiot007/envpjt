/**
 * migrate-local-to-azure.js
 * 
 * Does THREE things in one pass:
 *   1. Uploads every file in public/ to Azure Blob Storage
 *      as  userId/context/filename  (matching the imageController format)
 *   2. Updates MongoDB User.profilePic  (+ profilePicAzure) for any record
 *      whose primary URL is a local path  (/userId/...)
 *   3. Updates MongoDB Message.image  (+ imageAzure) for any record
 *      whose primary URL is a local path
 *
 * After this, every image is served via your own backend:
 *   GET /api/storage/images/<userId>/<context>/<filename>
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const envPath    = path.join(__dirname, '../.env');

dotenv.config({ path: envPath, override: true });

import { uploadToAzure, containerClient } from '../configs/azureStorage.js';

// ─── MongoDB Models (inline to keep script self-contained) ───────────────────

const userSchema = new mongoose.Schema({
    profilePic:      String,
    profilePicLocal: String,
    profilePicCloud: String,
    profilePicAzure: String,
}, { strict: false });

const messageSchema = new mongoose.Schema({
    image:      String,
    imageLocal: String,
    imageCloud: String,
    imageAzure: String,
}, { strict: false });

const User    = mongoose.model('users',   userSchema);
const Message = mongoose.model('Message', messageSchema);

// ─── Helpers ────────────────────────────────────────────────────────────────

const publicDir = path.join(__dirname, '../public');

/** Recursively list all files under a directory */
function getAllFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) getAllFiles(full, out);
        else out.push(full);
    }
    return out;
}

/** True when a URL is a local-server path (not http/https) */
const isLocalPath = (url) => url && !url.startsWith('http') && !url.startsWith('/api/storage/images/');

/** Convert a local path to the canonical backend proxy URL */
const toProxyUrl = (localPath) => {
    // localPath is like  /userId/context/file.ext  or  /public/userId/context/file.ext
    const clean = localPath.replace(/^\/public\//, '/').replace(/^\//, '');
    return `/api/storage/images/${clean}`;
};

// ─── Step 1: Upload public/ files to Azure ──────────────────────────────────

async function uploadLocalFiles() {
    console.log('\n📁 STEP 1 — Uploading local public/ files to Azure...');

    if (!fs.existsSync(publicDir)) {
        console.warn('⚠️  public/ directory not found — skipping file upload.');
        return;
    }

    if (!containerClient) {
        console.error('❌ Azure not configured — aborting.');
        process.exit(1);
    }

    await containerClient.createIfNotExists();

    const files = getAllFiles(publicDir);
    console.log(`   Found ${files.length} file(s).`);

    let ok = 0, fail = 0;
    for (const filePath of files) {
        const relativePath = path.relative(publicDir, filePath).replace(/\\/g, '/');
        const ext          = path.extname(filePath).slice(1) || 'octet-stream';
        const contentType  = `image/${ext}`;

        try {
            const buffer = fs.readFileSync(filePath);
            const url    = await uploadToAzure(buffer, relativePath, contentType);
            console.log(`   ✅ ${relativePath}`);
            ok++;
        } catch (err) {
            console.error(`   ❌ ${relativePath}: ${err.message}`);
            fail++;
        }
    }

    console.log(`   Done — uploaded: ${ok}, failed: ${fail}`);
}

// ─── Step 2: Patch MongoDB Users ─────────────────────────────────────────────

async function patchUsers() {
    console.log('\n👤 STEP 2 — Patching User documents...');

    const users = await User.find({});
    let patched = 0, skipped = 0;

    for (const user of users) {
        const updates = {};

        if (isLocalPath(user.profilePic)) {
            const proxyUrl = toProxyUrl(user.profilePic);
            updates.profilePic      = proxyUrl;
            updates.profilePicAzure = proxyUrl;
            console.log(`   🔄 User ${user._id}: ${user.profilePic} → ${proxyUrl}`);
        }

        if (Object.keys(updates).length > 0) {
            await User.updateOne({ _id: user._id }, { $set: updates });
            patched++;
        } else {
            skipped++;
        }
    }

    console.log(`   Done — patched: ${patched}, already OK / skipped: ${skipped}`);
}

// ─── Step 3: Patch MongoDB Messages ──────────────────────────────────────────

async function patchMessages() {
    console.log('\n💬 STEP 3 — Patching Message documents...');

    const messages = await Message.find({ image: { $exists: true, $ne: null, $ne: '' } });
    let patched = 0, skipped = 0;

    for (const msg of messages) {
        const updates = {};

        if (isLocalPath(msg.image)) {
            const proxyUrl = toProxyUrl(msg.image);
            updates.image      = proxyUrl;
            updates.imageAzure = proxyUrl;
            console.log(`   🔄 Message ${msg._id}: ${msg.image} → ${proxyUrl}`);
        }

        if (Object.keys(updates).length > 0) {
            await Message.updateOne({ _id: msg._id }, { $set: updates });
            patched++;
        } else {
            skipped++;
        }
    }

    console.log(`   Done — patched: ${patched}, already OK / skipped: ${skipped}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
    console.log('🚀 Local → Azure Migration Starting\n');
    console.log(`   MongoDB : ${process.env.MONGO_URI?.replace(/\/\/.*@/, '//<credentials>@')}`);
    console.log(`   Azure   : container "${process.env.AZURE_CONTAINER_NAME}"`);

    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('✅ MongoDB connected');

    await uploadLocalFiles();
    await patchUsers();
    await patchMessages();

    console.log('\n🎉 Migration complete!');
    console.log('   All images are now served via: GET /api/storage/images/<userId>/<context>/<file>');

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
