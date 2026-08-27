import userModel from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js"
import uploadFile from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";


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
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
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

export {registerUser}