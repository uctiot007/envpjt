import mongoose from 'mongoose';

export const connectDB = async () => {
    // 1. Try to get from Env
    // 2. Hardcode the string ONLY if env fails (as a temporary DevOps bypass)
    const uri = process.env.MONGO_URI || "mongodb://teamuser:teampassword123@172.25.4.110:27017/"
    console.log('--- DB Debug ---');
    console.log('Using URI:', uri.includes('@') ? uri.split('@')[1] : uri);

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
        });
        console.log('✅ MongoDB Connected Successfully');
    }
    catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};