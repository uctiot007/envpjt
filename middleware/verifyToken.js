import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyToken = async (req, res, next) => {
    let token = req.cookies.token;
    
    // If no token in cookies, check Authorization header
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7); // Remove 'Bearer ' prefix
        }
    }
    
    try {
        if (!token) return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded) return res.status(401).json({ success: false, message: "Unauthorized: invalid token" });

        req.userId = decoded.userId;

        const user = await User.findById(decoded.userId).select("-password");

        req.user = user;
        next();

    } catch (error) {
        console.log(`Error in verifyToken middleware, ${error}`);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

