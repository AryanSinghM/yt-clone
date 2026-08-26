import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: 'process.env.CLOUDINARY_API_KEY', 
  api_secret: 'process.env.CLOUDINARY_API_SECRET'
});


const uploadFile = async (fileLocalPath) => {
    try{
        if(!fileLocalPath) return null
        //uploading file in cloudinary
        const result = await cloudinary.uploader.upload(fileLocalPath, {
            resource_type: "auto"
        })
        //file uploaded in cloudinary
        console.log("file uploaded in cloudinary", result.url)
        return result
    }
    catch(error){
        fs.unlinkSync(fileLocalPath) //remove the locally saved temporary file as the upload operation failed
        return null
    }
    
}

export default uploadFile