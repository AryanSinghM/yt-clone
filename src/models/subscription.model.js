import mongoose, { mongo } from "mongoose"

const subscriptionSchema = new mongoose.Schema({
    subscriber: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },
    channel: {
        type: mongoose.Schema.Types.ObjectId,
        ref:"user"
    }

}, {timestamps: true})

const subscriptionModel = mongoose.model("subscription", subscriptionSchema)

export default subscriptionModel