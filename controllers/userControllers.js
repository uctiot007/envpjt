import User from '../models/User.js';

import bcrypt from 'bcryptjs';
import { generateTokenAndSetCookie } from '../utils/generateTokenAndSetCookie.js';
import { sendPasswordResetEmail, sendResetSuccessEmail, sendVerificationEmail } from '../mail-service/emails.js';
import cloudinary from '../configs/cloudinary.js';
import crypto from "crypto";
import { saveImageLocally, saveImageDual } from './imageController.js';
import { getReceiverSocketId, io } from "../lib/socket.js";

import fs from 'fs';
import path from 'path';

const saltRounds = 10;

export const getUserById = async (req, res) => {
    try {
        const searchedUser = await User.findById(req.params.id).select("-password");
        
        if (!searchedUser) return res.status(404).json({ message: "User not found" });

        const isFriend = req.user.friends.some(
            friendId => friendId.toString() === req.params.id.toString()
        );
        const isSelf = req.user._id.toString() === req.params.id.toString();

        if (!isSelf && !isFriend && searchedUser.isPrivate) {
            return res.status(403).json({ message: "This account is private", isPrivate: true });
        }
        if (isSelf || isFriend || !searchedUser.isPrivate) {
            res.status(200).json(searchedUser);

        } else {
            res.status(401).json({ message: "Unauthorized, requested account is private" });
        }
        
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function checkAuth(req, res){
    try{
        const user = await User.findById(req.userId);
        if(!user){
            return res.status(400).json({success: false, message: "User not found"});
        }

        res.status(200).json({success: true, user: {
            ...user._doc,
            password: undefined
        }});

    }catch(error){
        console.log("Error in checkAuth ", error);
        res.status(500).json({success: false, message: "Internal server error"})
    }
}

export async function signup(req, res){
    const{username, name, email, password}  = req.body;
    try{
        
        if(!email || !password || !name){
            return res.status(400).json({ message: "All fields are required"});
        }

        const emailAlreadyExists = await User.findOne({email});
        const userAlreadyExists = await User.findOne({username});

        if(userAlreadyExists ){
            return res.status(400).json({ success:false, message: "Username already exists"});
        }
        if(emailAlreadyExists){
            return res.status(400).json({ success:false, message:"Email already exists" })
        };

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const verificationToken = Math.floor (100000 + Math.random() * 900000).toString();

        const user = new User({
            username,
            name,
            email,
            password: hashedPassword,
            verificationToken,
            verificationTokenExpiresAt: Date.now() + 24*60*60*1000 //24 hours
        })

        const savedUser = await user.save();
        generateTokenAndSetCookie(res, user._id);

        await sendVerificationEmail(user.email, verificationToken);

        res.status(201).json({
            success: true,
            message: "User created successfully",
            user: {
                ...user._doc,
                password: undefined,
            }
        });
        console.log("User created");
    }catch(error){
        console.error(`Error creating user in createUser controller: ${error}`);
        res.status(504).json({ message: "Error in creating user"});
    }
}

export async function login(req, res){
    const { usernameOrEmail, password } = req.body;
    try{
        const user = await User.findOne({
            $or: [
                { email: usernameOrEmail },
                { username: usernameOrEmail}
            ]
        })
        if(!user){
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            })
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if(!isPasswordValid){
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            })
        }

        generateTokenAndSetCookie(res, user._id);
        user.lastLogin = new Date();
        await user.save();

        res.status(200).json({
            success: true,
            message: "Logged in successfully",
            user: {
                ...user._doc,
                password: undefined,
            }
        })
    }catch(error){
        console.error("Error in login controller");
        res.status(500).json({ message: "Internal server error"});
    }
}

export async function logout(req, res){
    try{
        res.clearCookie("token")
        res.status(200).json({ message: "Logged out successfully" })

    }catch(error){
        console.error("Error in logout controller");
        res.status(504).json({ message: "Internal server error" });
    }
}

export async function verifyEmail(req, res){
    const { code } = req.body;
    try{
        const user = await User.findOne({
            verificationToken: code,
            verificationTokenExpiresAt: { $gt: Date.now() }
        });

        if(!user){
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification code"
            })
        }

        user.isVerified = true;
        user.verificationTokenExpiresAt = undefined;
        await user.save();
        return res.status(200).json({
            user : {
                ...user._doc,
                password: undefined,
            }
        })
    }catch(error){
        return res.status(400).json({
            success: false,
            message: "Bad request"
        })
    }
}

export async function forgotPassword(req, res){
     const { usernameOrEmail } = req.body;
    try{
       const user = await User.findOne({ 
        $or: [
            { email: usernameOrEmail},
            { username: usernameOrEmail}
        ]
        });
       if(!user){
        return res.status(400).json({
            success: false,
            message: "Invalid credentials, email doesn't exist"
        })
       }
       
       const userEmail = user.email;

       const resetToken = crypto.randomBytes(20).toString("hex");
       const resetTokenExpiresAt = Date.now() + 60*60*1000;

       await sendPasswordResetEmail(userEmail, `${process.env.CLIENT_URL}/reset-password/${resetToken}`);

       user.resetPasswordToken = resetToken;
       user.resetPasswordExpiresAt = resetTokenExpiresAt;
       await user.save();

       res.status(200).json({
        success: true,
        message: "Password reset link sent to your email"
       });
    }catch(error){
        console.log("Error in forgotPassword controller");
        res.status(500).json({ success: false, message: error.message});
    }
}

export async function resetPassword(req, res){
        const {token} = req.params;
        const {password} = req.body;    
    try{
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpiresAt: { $gt: Date.now() },
        })
        if(!user){
            return res.status(400).json({
                success: false,
                message: "Invalid link, user not found or token expired"
            })
        }
        
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        user.password = hashedPassword;
        user.resetPasswordExpiresAt = undefined;
        user.resetPasswordToken = undefined;
        await user.save();

        await sendResetSuccessEmail(user.email);

        res.status(200).json({ success: true, message: "Password reset successfully!"});
            
    }catch(error){
        console.log(`Error in resetPassword controller, ${error}`);
        res.status(400).json({ success: false, message: "Failed to reset password"})
    }
}

export const updateProfile = async (req, res) => {
    try {
        const { profilePic } = req.body;
        const userId = req.user._id;

        if (!profilePic) {
            return res.status(400).json({ message: "Profile picture is required" });
        }

        // Use Dual Storage
        const result = await saveImageDual(profilePic, userId.toString(), 'profile');
        
        // Save both URLs to the database
        const updatedUser = await User.findByIdAndUpdate(
            userId, 
            { 
                profilePic: result.cloudUrl || result.localUrl, // Fallback to local if cloud fails
                profilePicLocal: result.localUrl 
            }, 
            { new: true }
        ).select("-password");

        res.status(200).json({
            success: true,
            user: updatedUser,
            storage: {
                cloud: result.cloudUrl,
                local: result.localUrl,
                synced: result.success
            }
        });

    } catch (error) {
        console.log("Error in updateProfile controller: ", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const updateProfileLocalOld = async (req, res) => {
    try {
        const { profilePic } = req.body;
        const userId = req.user._id;

        if (!profilePic) {
            return res.status(400).json({ message: "Profile picture is required" });
        }

        // Create folder public/userId if it doesn't exist
        const userFolder = path.join('public', userId.toString());
        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true });
        }

        // Strip the base64 header (e.g. "data:image/png;base64,") and get extension
        const matches = profilePic.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ message: "Invalid image format" });
        }

        const ext = matches[1];        // e.g. "png", "jpg"
        const base64Data = matches[2]; // actual base64 string

        // Save file
        const filePath = path.join(userFolder, `profile.${ext}`);
        fs.writeFileSync(filePath, base64Data, 'base64');

        // Save the file path in DB
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { profilePic: `/${filePath}` },
            { new: true }
        );

        res.status(200).json(updatedUser);

    } catch (error) {
        console.log("Error in updateProfileLocal controller: ", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const updateProfileLocal = async (req, res) => {
    try {
        const { profilePic } = req.body;
        const userId = req.user._id;

        if (!profilePic) {
            return res.status(400).json({ message: "Profile picture is required" });
        }

        const filePath = saveImageLocally(profilePic, userId.toString(), 'profile');
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { profilePic: filePath },
            { new: true }
        );

        res.status(200).json(updatedUser);
    } catch (error) {
        console.log("Error in updateProfileLocal: ", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("friends", "-password");
        
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json(user.friends);

    } catch (error) {
        console.log("Error in getFriends controller: ", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const sendFriendRequest = async (req, res) => {
    try {
        const senderId = req.user._id;
        const receiverId = req.params.id;

        if (senderId.toString() === receiverId.toString()) {
            return res.status(400).json({ message: "You can't send a friend request to yourself" });
        }

        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);

        if (!receiver) return res.status(404).json({ message: "User not found" });

        // Check if already friends
        if (sender.friends.some(id => id.toString() === receiverId.toString())) {
            return res.status(400).json({ message: "Already friends" });
        }

        // Check if request already sent
        if (sender.friendRequestsSent.some(id => id.toString() === receiverId.toString())) {
            return res.status(400).json({ message: "Friend request already sent" });
        }

        // Check if receiver has ignored the sender
        if (receiver.friendRequestsIgnored.some(id => id.toString() === senderId.toString())) {
            return res.status(400).json({ message: "Unable to send friend request" });
        }

        // Check if receiver already sent a request to sender — auto-accept in that case
        if (sender.friendRequestsReceived.some(id => id.toString() === receiverId.toString())) {
            sender.friends.push(receiverId);
            receiver.friends.push(senderId);

            sender.friendRequestsReceived = sender.friendRequestsReceived.filter(id => id.toString() !== receiverId.toString());
            receiver.friendRequestsSent = receiver.friendRequestsSent.filter(id => id.toString() !== senderId.toString());

            await sender.save();
            await receiver.save();

            return res.status(200).json({ message: "You are now friends!" });
        }

        // Normal case — send the request
        sender.friendRequestsSent.push(receiverId);
        receiver.friendRequestsReceived.push(senderId);

        await sender.save();
        await receiver.save();
        // after await sender.save(); await receiver.save();
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("friendRequest", {
                ...sender.toObject(),
                password: undefined
            });
        }

        res.status(200).json({ message: "Friend request sent successfully" });

    } catch (error) {
        console.log("Error in sendFriendRequest controller: ", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const acceptFriendRequest = async (req, res) => {
    try {
        const accepterId = req.user._id;
        const senderId = req.params.id;

        const accepter = await User.findById(accepterId);
        const sender = await User.findById(senderId);

        if (!sender) return res.status(404).json({ message: "User not found" });

        // Check inbox OR ignored list
        const inInbox = accepter.friendRequestsReceived.some(id => id.toString() === senderId.toString());
        const inIgnored = accepter.friendRequestsIgnored.some(id => id.toString() === senderId.toString());

        if (!inInbox && !inIgnored) {
            return res.status(400).json({ message: "No friend request from this user" });
        }

        // Add each other as friends
        accepter.friends.push(senderId);
        sender.friends.push(accepterId);

        // Clean up all traces
        accepter.friendRequestsReceived = accepter.friendRequestsReceived.filter(
            id => id.toString() !== senderId.toString()
        );
        accepter.friendRequestsIgnored = accepter.friendRequestsIgnored.filter(
            id => id.toString() !== senderId.toString()
        );
        sender.friendRequestsSent = sender.friendRequestsSent.filter(
            id => id.toString() !== accepterId.toString()
        );

        await accepter.save();
        await sender.save();

        res.status(200).json({ message: "Friend request accepted" });

    } catch (error) {
        console.log("Error in acceptFriendRequest controller: ", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const ignoreFriendRequest = async (req, res) => {
    try {
        const ignorerId = req.user._id;
        const senderId = req.params.id;

        const ignorer = await User.findById(ignorerId);
        const sender = await User.findById(senderId);

        if (!sender) return res.status(404).json({ message: "User not found" });

        if (!ignorer.friendRequestsReceived.some(id => id.toString() === senderId.toString())) {
            return res.status(400).json({ message: "No friend request from this user" });
        }

        // Remove from receiver's inbox only — keep in sender's sent
        ignorer.friendRequestsReceived = ignorer.friendRequestsReceived.filter(
            id => id.toString() !== senderId.toString()
        );

        // Move to ignored list
        ignorer.friendRequestsIgnored.push(senderId);

        await ignorer.save();
        // ← don't touch sender at all

        res.status(200).json({ message: "Friend request ignored" });

    } catch (error) {
        console.log("Error in ignoreFriendRequest controller: ", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const removeFriend = async (req, res) => {
    try {
        const removerId = req.user._id;
        const friendId = req.params.id;

        const remover = await User.findById(removerId);
        const friend = await User.findById(friendId);

        if (!friend) return res.status(404).json({ message: "User not found" });

        // Check if actually friends
        if (!remover.friends.some(id => id.toString() === friendId.toString())) {
            return res.status(400).json({ message: "This user is not your friend" });
        }

        // Remove each other from friends arrays
        remover.friends = remover.friends.filter(
            id => id.toString() !== friendId.toString()
        );
        friend.friends = friend.friends.filter(
            id => id.toString() !== removerId.toString()
        );

        await remover.save();
        await friend.save();

        res.status(200).json({ message: "Friend removed successfully" });

    } catch (error) {
        console.log("Error in removeFriend controller: ", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const changeAccountPrivacy = async (req, res) => {
    try {
        const userId = req.user._id;
        const { isPrivate } = req.body;

        // Handle both boolean and string inputs
        const privacyValue = isPrivate === true || isPrivate === "true" || isPrivate === "True";

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { isPrivate: privacyValue },
            { new: true }
        ).select("-password");

        res.status(200).json({
            message: `Account is now ${privacyValue ? "private" : "public"}`,
            user: updatedUser
        });

    } catch (error) {
        console.log("Error in changeAccountPrivacy controller: ", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getRequestsInbox = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("friendRequestsReceived", "-password");
        res.status(200).json(user.friendRequestsReceived);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getRequestsSent = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("friendRequestsSent", "-password");
        res.status(200).json(user.friendRequestsSent);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getRequestsIgnored = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("friendRequestsIgnored", "-password");
        res.status(200).json(user.friendRequestsIgnored);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

export const getUserFriends = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate("friends", "-password");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.status(200).json(user.friends);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}