import jwt from "jsonwebtoken"

export const generateAccessToken = (userId) => {
    const token = jwt.sign({userId},process.env.JWT_ACCESS_TOKEN,{expiresIn:"10m",});
    return token;
}

export const generateRefreshToken = (userId) => { 
    const token = jwt.sign({userId},process.env.JWT_REFRESH_TOKEN,{expiresIn:"7d",});
    return token;
}
