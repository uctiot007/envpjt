import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const getRawLocalUri = () => (process.env.MONGO_URI || "mongodb://teamuser:teampassword123@172.25.4.110:27017/?authSource=admin").trim();

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

export async function backupDbs() {
    console.log("💾 Starting Dynamic Point-in-Time Database Backup...");
    
    dotenv.config({ path: path.join(__dirname, '../.env') });
    const rawLocalUri = getRawLocalUri();

    try {
        const tempConnection = await mongoose.createConnection(rawLocalUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
        const targetDatabases = await getDatabases(tempConnection);
        await tempConnection.close();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupBaseDir = path.join(__dirname, '..', 'backups', timestamp);

        if (!fs.existsSync(backupBaseDir)) {
            fs.mkdirSync(backupBaseDir, { recursive: true });
        }

        console.log(`📂 Found ${targetDatabases.length} databases to back up: ${targetDatabases.join(', ')}`);

        for (const dbName of targetDatabases) {
            console.log(`\n==============================================`);
            console.log(`🌐 Backing up Database Namespace: [${dbName.toUpperCase()}]`);
            console.log(`==============================================`);

            const localUri = buildUriForDb(rawLocalUri, dbName);
            const connection = await mongoose.createConnection(localUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
            
            const localDb = connection.db;
            const cols = await localDb.listCollections().toArray();
            
            const dbBackupDir = path.join(backupBaseDir, dbName);
            if (!fs.existsSync(dbBackupDir)) {
                fs.mkdirSync(dbBackupDir, { recursive: true });
            }

            for (const col of cols) {
                if (col.name.startsWith('system.')) continue;
                
                console.log(`📦 Dumping collection: ${dbName}.${col.name}...`);
                const docs = await localDb.collection(col.name).find({}).toArray();
                
                const filePath = path.join(dbBackupDir, `${col.name}.json`);
                fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
                
                console.log(`   └─ Saved ${docs.length} documents to ${filePath}`);
            }
            
            await connection.close();
        }
        
        console.log("\n🎉 Backup completed successfully!");
        console.log(`📁 Files saved locally in: ${backupBaseDir}`);
    } catch (err) {
        console.error("❌ Backup Error:", err);
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    backupDbs().catch(err => {
        console.error("❌ Backup CLI Error:", err);
        process.exit(1);
    });
}
