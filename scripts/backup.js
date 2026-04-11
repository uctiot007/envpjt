import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const getRawLocalUri = () => (process.env.MONGO_URI || "mongodb://teamuser:teampassword123@172.25.4.110:27017/?authSource=admin").trim();
const getRawCloudUri = () => (process.env.ATLAS_MONGO_URI || "").trim();

const buildUriForDb = (uri, dbName) => {
    const queryIndex = uri.indexOf('?');
    const basePart = queryIndex === -1 ? uri : uri.substring(0, queryIndex);
    const queryPart = queryIndex === -1 ? '' : uri.substring(queryIndex);
    const protocolEnd = basePart.indexOf('://') + 3;
    const slashIndex = basePart.indexOf('/', protocolEnd);
    const baseWithNoPath = slashIndex === -1 ? basePart : basePart.substring(0, slashIndex);
    return `${baseWithNoPath}/${dbName}${queryPart}`;
};

async function getDatabases(connection) {
    const admin = connection.db.admin();
    const result = await admin.listDatabases();
    return result.databases
        .map(db => db.name)
        .filter(name => !['admin', 'config', 'local'].includes(name));
}

function getHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

export async function backupSource(sourceName, rawUri) {
    if (!rawUri) {
        console.warn(`⚠️ No URI provided for ${sourceName} backup. Skipping.`);
        return;
    }

    console.log(`\n🔍 Checking [${sourceName.toUpperCase()}] for changes...`);
    
    try {
        const tempConnection = await mongoose.createConnection(rawUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
        const targetDatabases = await getDatabases(tempConnection);
        await tempConnection.close();

        const fullBackupData = {};

        for (const dbName of targetDatabases) {
            const localUri = buildUriForDb(rawUri, dbName);
            const connection = await mongoose.createConnection(localUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
            
            const localDb = connection.db;
            const cols = await localDb.listCollections().toArray();
            
            fullBackupData[dbName] = {};

            for (const col of cols) {
                if (col.name.startsWith('system.')) continue;
                const docs = await localDb.collection(col.name).find({}).sort({ _id: 1 }).toArray(); // Sort for consistent hashing
                fullBackupData[dbName][col.name] = docs;
            }
            
            await connection.close();
        }

        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const fileName = `${sourceName.toLowerCase()}_backup.json`;
        const filePath = path.join(backupDir, fileName);
        const hashFilePath = path.join(backupDir, `.${fileName}.hash`);

        const newHash = getHash(fullBackupData);
        let oldHash = '';

        if (fs.existsSync(hashFilePath)) {
            oldHash = fs.readFileSync(hashFilePath, 'utf8').trim();
        }

        if (newHash === oldHash && fs.existsSync(filePath)) {
            console.log(`✅ [${sourceName.toUpperCase()}]: No changes detected. Backup skipped.`);
        } else {
            console.log(`💾 [${sourceName.toUpperCase()}]: Changes detected! Saving new backup...`);
            fs.writeFileSync(filePath, JSON.stringify(fullBackupData, null, 2));
            fs.writeFileSync(hashFilePath, newHash);
            console.log(`   └─ Saved to ${filePath}`);
        }

    } catch (err) {
        console.error(`❌ ${sourceName} Backup Error:`, err);
    }
}

export async function runDoubleBackup() {
    console.log("💾 Starting Consolidated Dual-Source Backup...");
    
    // Refresh env
    dotenv.config({ path: path.join(__dirname, '../.env') });
    
    const localUri = getRawLocalUri();
    const cloudUri = getRawCloudUri();

    await backupSource('compass', localUri);
    await backupSource('cloud', cloudUri);
    
    console.log("\n🎉 Backup cycle completed!");
}

let backupTimeout = null;

export const triggerBackup = (delayMs = 600000) => { // Default 10 minute debounce
    if (backupTimeout) {
        clearTimeout(backupTimeout);
    }
    
    console.log(`🕒 Backup queued... Will run in ${delayMs / 60000} minutes if no further changes occur.`);
    
    backupTimeout = setTimeout(() => {
        runDoubleBackup().catch(err => console.error("Debounced Backup Error:", err));
        backupTimeout = null;
    }, delayMs);
};

// Support CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    runDoubleBackup().catch(err => {
        console.error("❌ Backup CLI Error:", err);
        process.exit(1);
    });
}
