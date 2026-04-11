import Message from '../models/message.model.js';
import User from '../models/User.js'
import cloudinary from '../configs/cloudinary.js'
import { getReceiverSocketId, io } from "../lib/socket.js";
import { saveImageLocally, saveImageDual } from './imageController.js';

export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;

        // 1. Fetch the users (adjust this if you have a specific 'friends' array logic)
        const loggedInUser = await User.findById(loggedInUserId);
        const users = await User.find({ 
            _id: { $in: loggedInUser.friends } 
        }).select("-password");

        // 2. Map through each user to find the latest message between you two
        const usersWithLastMessage = await Promise.all(users.map(async (user) => {
            const lastMessage = await Message.findOne({
                $or: [
                    { senderId: loggedInUserId, receiverId: user._id },
                    { senderId: user._id, receiverId: loggedInUserId }
                ]
            }).sort({ createdAt: -1 }); // Sort by newest first

            return {
                ...user.toObject(),
                // If there's a message, attach its time. If not, default to 0 so they drop to the bottom.
                lastMessageTime: lastMessage ? lastMessage.createdAt : new Date(0), 
            };
        }));

        // 3. Send the modified array back to the frontend
        res.status(200).json(usersWithLastMessage);
    } catch (error) {
        console.error("Error in getUsersForSidebar: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getAllUsers = async (req, res) => {
    try{
        const loggedInUserId = req.user._id;
        const filteredUsers = await User.find({_id: {$ne:loggedInUserId}}).select("-password");

        res.status(200).json(filteredUsers)
    }catch(error){
        console.error("Error in getUsersForSidebar: ", error);
        res.status(500).json({ message: "Internal server error"});
    }
}

export const getMessages = async (req, res) => {
    try{
        const { id:userToChatId } = req.params;
        const senderId = req.user._id;

        const messages = await Message.find({
            $or:[
                {senderId:senderId, receiverId:userToChatId},
                {senderId:userToChatId, receiverId:senderId}
            ]
        })

        res.status(200).json(messages);

    }catch(error){
        console.log("Error in getMessages controller: ", error);
        res.status(500).json({ message: "Internal server error"})
    }
}

export const sendMessage = async (req, res) => {
    try {
        const { text, image } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        let storageInfo = {};
        let result = null;

        if (image) {
            result = await saveImageMulti(image, senderId.toString(), 'message');
            storageInfo = {
                azure: result.azureUrl,
                cloud: result.cloudUrl,
                local: result.localUrl,
                status: result.success
            };
        }

        const newMessage = new Message({ 
            senderId, 
            receiverId, 
            text, 
            image: result?.azureUrl || result?.cloudUrl || result?.localUrl, 
            imageLocal: result?.localUrl,
            imageCloud: result?.cloudUrl,
            imageAzure: result?.azureUrl
        });
        await newMessage.save();

        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", {
                ...newMessage.toObject(),
                storage: storageInfo
            });
        }

        res.status(201).json({
            ...newMessage.toObject(),
            storage: storageInfo
        });
    } catch (error) {
        console.log("Error in sendMessage controller: ", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
export const editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { text } = req.body;
        // Your logic to find message by ID and update text
        res.status(200).json({ message: "Message updated" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        // Your logic to find message by ID and delete
        res.status(200).json({ message: "Message deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};