import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String, 
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String
    },
    profilePic: {
        type: String,
        default: "",
    },
    profilePicLocal: {
        type: String,
        default: "",
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    isVerified: {
        type: Boolean,
        default: true
    },

    isPrivate: {
        type: Boolean,
        default: false
    },

    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
        
    friendRequestsSent: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],

    friendRequestsReceived: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],

    friendRequestsIgnored: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],

    libraryGames: [{ type: mongoose.Schema.Types.ObjectId, ref: "Game" }],

    installedGames: [{ type: mongoose.Schema.Types.ObjectId, ref: "Game" }],

    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,
    verificationToken: String,
    verificationTokenExpiresAt: Date, 
}, {timestamps: true});

const User = mongoose.model('users', userSchema);


export default User;