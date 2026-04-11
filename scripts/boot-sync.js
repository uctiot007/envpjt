import os from 'os';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import our existing sync and backup logic
import { syncDbs } from './sync-db.js';
import { runDoubleBackup } from './backup.js';
import { syncAssets } from '../utils/asset-sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = path.join(__dirname, '../.env');

// 1. Function to get the current LAN IPv4
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1'; // Fallback
}

// Robust Function to construct URI for a specific database
const buildUriForDb = (uri, dbName) => {
    const queryIndex = uri.indexOf('?');
    const basePart = queryIndex === -1 ? uri : uri.substring(0, queryIndex);
    const queryPart = queryIndex === -1 ? '' : uri.substring(queryIndex);
    const protocolEnd = basePart.indexOf('://') + 3;
    const slashIndex = basePart.indexOf('/', protocolEnd);
    const baseWithNoPath = slashIndex === -1 ? basePart : basePart.substring(0, slashIndex);
    return `${baseWithNoPath}/${dbName}${queryPart}`;
};

// 2. Function to update .env file with new IP
function updateEnvFile(newIP) {
    if (!fs.existsSync(envPath)) return;
    
    let content = fs.readFileSync(envPath, 'utf8');
    
    // Pattern to find the IP address part (any numbers/dots between @ and :)
    const ipPattern = /(@)[\d\.]+(:\d+)/;
    const newUriLine = content.replace(ipPattern, `$1${newIP}$2`);
    
    if (content !== newUriLine) {
        fs.writeFileSync(envPath, newUriLine, 'utf8');
        console.log(`✅ .env updated with new IP: ${newIP}`);
    } else {
        console.log(`ℹ️ .env IP is already up to date: ${newIP}`);
    }
}

// 3. Main Boot Sequence
export async function runBootSequence() {
    console.log("\n🚀 Initializing Smart Boot Sequence...");
    
    const currentIP = getLocalIP();
    console.log(`📍 Detected LAN IP: ${currentIP}`);
    
    // Update the config file
    updateEnvFile(currentIP);
    
    // Reload env
    dotenv.config({ path: envPath, override: true });
    
    const localUri = process.env.MONGO_URI;
    
    // 4. Log "Wake Up" to Server.IPinfo
    if (localUri) {
        console.log("📝 Logging 'Laptop Wake Up' to Server.IPinfo...");
        try {
            const logUri = buildUriForDb(localUri, 'Server');
            const conn = await mongoose.createConnection(logUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
            await conn.db.collection('IPinfo').updateOne(
                { machine: os.hostname() },
                { 
                    $set: {
                        event: "Latest Boot Status",
                        ipv4: currentIP,
                        timestamp: new Date(),
                        machine: os.hostname()
                    }
                },
                { upsert: true }
            );
            console.log("✅ Latest IP status updated in database.");
            await conn.close();
        } catch (err) {
            console.error("⚠️ Failed to log IP to database (Offline?):", err.message);
        }
    }

    // 5. Trigger Sync and Backup
    await syncDbs();
    await runDoubleBackup();
    
    // 6. Trigger Cloud Asset Sync
    await syncAssets();
    
    console.log("\n✨ Smart Boot Sequence Completed!\n");
}

// Only run automatically if this file is called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runBootSequence().catch(err => {
        console.error("❌ Boot Error:", err);
        process.exit(1);
    });
}
