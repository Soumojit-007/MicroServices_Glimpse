import mongoose from 'mongoose';
const refreshtokenSchema = new mongoose.Schema({
    token : {
        type : String,
        required : true,
        unique : true
    },
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true
    },
    expiresAt : {
        type : Date,
        required : true
    }
} ,{timestamps : true});

refreshtokenSchema.index({expiresAt: 1},{expireAfterSeconds : 0})


const RefreshToken = mongoose.model('RefreshToken' , refreshtokenSchema)



export default RefreshToken