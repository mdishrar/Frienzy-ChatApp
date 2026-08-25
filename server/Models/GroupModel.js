import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },
    admin: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);
const Group=mongoose.models.Group || mongoose.model("Group", GroupSchema);
export default Group; 
