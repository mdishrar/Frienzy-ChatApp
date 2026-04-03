import mongoose from "mongoose";

export const connectDB = async () =>{
    try{
        mongoose.connection.on('connected',()=>{
            console.log("Mongoose database is connected !!!")
        })
        await mongoose.connect(`${process.env.MONGO_URL}/Cluster0`)
    }catch(error){
        console.log("mongooser error : ",error)
    }
}