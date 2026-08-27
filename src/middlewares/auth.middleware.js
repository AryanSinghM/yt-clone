import userModel from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"


const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        const accessToken = req.cookies?.accessToken || req.header("Authorization")?.replace("bearer ", "")

        if(!accessToken){
            throw new ApiError(401, "Unathorized request")
        }

        const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET)

        const user = await userModel.findOne({_id: decoded?._id})
        .select("-password -refreshToken")

        if(!user){
            // discuss in next video
            throw new ApiError(401, "Invalid access Token")
        }

        req.user = user
        next()

    } catch (error) {
        throw new ApiError(404, error?.message || "Invalid access token")
    }
    
})

export default verifyJWT