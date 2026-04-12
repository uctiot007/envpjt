import express from "express";
import { forgotPassword, login, logout, resetPassword, signup, verifyEmail, checkAuth, updateProfile, updateProfileLocal, getUserById, getFriends, sendFriendRequest, acceptFriendRequest, ignoreFriendRequest, removeFriend, changeAccountPrivacy, getRequestsSent, getRequestsInbox, getRequestsIgnored, getUserFriends } from "../controllers/userControllers.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { getAllUsers } from "../controllers/messageController.js";

const router = express.Router();

router.get('/check-auth', verifyToken, checkAuth)

router.post('/login', login);

router.post('/signup', signup);

router.post('/logout', logout);

router.post('/verify-email', verifyEmail);

router.post('/forgot-password', forgotPassword);

router.post('/reset-password/:token', resetPassword);

router.put('/update-profile', verifyToken, updateProfile);
router.put('/updateProfile', verifyToken, updateProfile);

router.get('/user/:id', verifyToken, getUserById);

router.get('/friends/', verifyToken, getFriends);

router.put('/friends/send/:id', verifyToken, sendFriendRequest);

router.put('/friends/accept/:id', verifyToken, acceptFriendRequest);

router.put('/friends/ignore/:id', verifyToken, ignoreFriendRequest);

router.delete('/friends/remove/:id', verifyToken, removeFriend);

router.get('/friends/inbox', verifyToken, getRequestsInbox);
router.get('/friends/sent', verifyToken, getRequestsSent);
router.get('/friends/ignored', verifyToken, getRequestsIgnored);

router.put('/user/privacy', verifyToken, changeAccountPrivacy);

router.post('/search', verifyToken, getAllUsers)

router.get('/user/:id/friends', verifyToken, getUserFriends);

export default router;