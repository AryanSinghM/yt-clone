import userModel from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js"
import {uploadFile, deleteFile} from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"


const registerUser = asyncHandler(async (req, res, next) => {

    // get user details from frontend
    // validation - not empty
    // check if user already exists: username , email
    // check for images , check for avatar
    // upload them cloudinary, avatar
    // create user object - create an entry in db
    // remove password and refresh token field from response
    // check for user response
    // return res

    const {fullName, username, email, password} = req.body;

    console.log(fullName, username, email, password);

    if(
        [username, fullName, email, password].some((field) => 
        field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required")
    }

    const isUserAlreadyExists = await userModel.findOne({
        $or: [{username}, {email}]
    })

    if(isUserAlreadyExists){
        throw new ApiError(409, "user with given username or email already exists")
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "avatar file is required")
    }

    const avatar = await uploadFile(avatarLocalPath)

    let coverImage = null;
    if(coverImageLocalPath){
        coverImage = await uploadFile(coverImageLocalPath)
    }

    if(!avatar){
        throw new ApiError(400, "failed to upload avatar in cloudinary")
    }
    if(coverImageLocalPath && !coverImage){
        throw new ApiError(400, "failed to upload coverImage in cloudinary")
    }
    

    const user = await userModel.create({
        fullName, 
        email,
        password,
        avatar: {
            secure_url: avatar.secure_url,
            public_id: avatar.public_id
        },
        coverImage: {
            secure_url: coverImage?.secure_url || "",
            public_id: coverImage?.public_id || ""
        } ,
        username: username.toLowerCase()
    })

    const createdUser = await userModel.findById(user._id)
                        .select("-password -refreshToken")

    if(!createdUser){
        throw new ApiError(500, "something went wrong while registering the user")
    }


    return res.status(201).json(
        new ApiResponse(201, createdUser, "successfully registered")
    )

})


const generateAccessAndRefreshToken = async (userId) => {
    try{
        const user = await userModel.findOne({_id: userId})

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    }catch(error){
        throw new ApiError(401, "something went wrong while generating acccess and refresh token")
    }
}


const loginUser = asyncHandler(async (req, res, next) => {
    // 1. take input (username or email and password) from user
    // 2. check in db if user with obtained username or email already exists
    // 3. if not , return error that user is not registered
    // 4. then check password using bcrypt
    // 5. if false, return error that wrong user credentials
    // 6. if true, then we need to generate access and refresh token
    // 7. now, we have access and refresh tokens
    // 8. set refresh token in db for that user
    // 9. send access and refresh token to client using res.cookie
    // 10. show successfully logged in

    const {username, email, password} = req.body

    if(!username && !email){
        throw new ApiError(300, "username or email is required")
    }

    const user = await userModel.findOne({
        $or: [
            {email}, {username}
        ]
    })

    if(!user){
        throw new ApiError(404, "user does not exist, here")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if(!isPasswordCorrect){
        throw new ApiError(401, "wrong user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await userModel.findOne({_id: user._id})
                            .select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, 
            {user: loggedInUser, accessToken, refreshToken},
            "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req, res, next) => {
    // 1. take refresh token req.cookies
    // 2. find the user , using this refreshtoken
    // 3. update refreshtoken of user to null or undefined in db
    // 4. clear the accesstoken and refreshtoken from the client side using res.clearCookie

    const user = await userModel.findOneAndUpdate(
        {_id: req.user._id},
        {$set : {refreshToken: null}},
        { new : true }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {username: user.username}, "successfully logged out")
    )

})


const refreshAccessToken = asyncHandler( async (req, res) => {
    //here we refresh both access and refresh token for better security
    const UserRefreshToken = req.cookies?.refreshToken || req.header("Authentication")?.replace("Bearer ", "") || req.body?.refreshToken

    if(!UserRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decoded = jwt.verify(UserRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user = await userModel.findById(decoded?._id)

        if(!user){
            throw new ApiError(401, "Unauthorized access")
        }

        //now we will check if dbrefreshtoken == refreshtoken
        if(user.refreshToken !== UserRefreshToken){
            throw new ApiError(401, "Invalid refresh token")
        } 

        //now generate new access and refresh token and send in res
        const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)
        //this function will automatically set the new refreshtoken into db

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
        .status(200)
        .cookie("accessToken", accessToken)
        .cookie("refreshToken", refreshToken)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken}, 
                "Access Token refreshed Successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "something went wrong while refreshing access token")
    }
    

})


const changeCurrentPassword = asyncHandler( async (req, res) => {
    const user = await userModel.findById(req.user?._id)
    const {oldPassword, newPassword} = req.body

    if(oldPassword === newPassword){
        throw new ApiError(401, "new password cannot be same as old password")
    }

    if(!user.isPasswordCorrect(oldPassword)){
        throw new ApiError(400, "wrong old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(200, {username: user.username}, "password changed successfully")
    )
})


const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await userModel.findById(req.user?._id).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200, {user: user}, "user details fetched successfully")
    )
})


const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, email} = req.body

    if(!fullName || !email){
        throw new ApiError(400, "fullName or email is not updated")
    }

    const user = await userModel.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName, email
            }
        }, 
        { new : true }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200, {user}, "details updated successfully")
    )
})


const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        console.log(avatarLocalPath)
        throw new ApiError(400, "avatar file is missing")
    }

    const avatar = await uploadFile(avatarLocalPath)

    if(!avatar.secure_url){
        throw new ApiError(400, "failed to upload avatar in cloudinary")
    }

    //get public id of old image and delete from cloudinary
    const oldAvatar = req.user?.avatar

    //upload the new image in the database
    const user = await userModel.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {avatar: {
                    secure_url: avatar.secure_url,
                    public_id: avatar.public_id
                }
            }
        },
        {new: true}

    ).select("-password -refreshToken")


    //delete the old image from the cloudinary
    if(!oldAvatar?.public_id){
        throw new ApiError(400, "failed to fetch public_id of avatar")
    } 
    else{
        const deleted = await deleteFile(oldAvatar.public_id)

        if(!deleted){
            throw new ApiError(400, "failed to delete old avatar from cloudinary")
        }
        console.log("successfully deleted old avatar")
    }


    return res
    .status(200)
    .json(
        new ApiResponse(200, {avatar: avatar.secure_url}, "avatar updated successfully")
    )
})


const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "coverImage file is missing")
    }

    const coverImage = await uploadFile(coverImageLocalPath)

    if(!coverImage.secure_url){
        throw new ApiError(400, "failed to upload coverImage in cloudinary")
    }

    //get public id of old image and delete from cloudinary
    const oldCoverImage = req.user?.coverImage

    //update the new image in db
    const user = await userModel.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {coverImage: {
                    secure_url: coverImage.secure_url,
                    public_id: coverImage.public_id
                }
            }
        },
        {new: true}

    ).select("-password -refreshToken")

    //now delete the old image from the cloudinary
    if(!oldCoverImage?.public_id){
        throw new ApiError(400, "failed to fetch public id of old cover iamge")
    } 
    else{
        const deleted = await deleteFile(oldCoverImage.public_id)

        if(!deleted){
            throw new ApiError(400, "failed to delete coverimage from cloudinary")
        }
        console.log("successfully deleted old coverImage")
    }
    

    return res
    .status(200)
    .json(
        new ApiResponse(200, {coverImage: coverImage.secure_url}, "coverImage updated successfully")
    )
})


export {
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken,
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar,
    updateUserCoverImage
}