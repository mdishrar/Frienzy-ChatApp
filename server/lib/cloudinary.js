import { v2 as cloudinary} from "cloudinary"

cloudinary.config({
    cloud_name: process.env.CLOUDINAY_CLOUD_NAME,
    api_key : process.env.CLOUDINAY_CLOUD_API_KEY,
    api_secret : process.env.CLOUDINAY_CLOUD_SECRET_KEY,
})

export default cloudinary;