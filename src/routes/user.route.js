import express from "express"
import { loginUser, registerUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controller.js"
import upload from "../middlewares/multer.middleware.js"
import verifyJWT from "../middlewares/auth.middleware.js"

const router = express.Router()


router.route("/register").post(upload.fields([
    {
        name: "avatar",
        maxCount: 1
    },
    {
        name: "coverImage",
        maxCount: 1
    }
]), registerUser)

router.route("/login").post(loginUser)


//secure routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").get(refreshAccessToken)
router.route("/change-password").put(verifyJWT, changeCurrentPassword)
router.route("/userProfile").get(verifyJWT, getCurrentUser)
router.route("/updateProfile").put(verifyJWT, updateAccountDetails)
router.route("/updateAvatar").put(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/updateCoverImage").put(verifyJWT, upload.single("coverImage"), updateUserCoverImage)


export default router