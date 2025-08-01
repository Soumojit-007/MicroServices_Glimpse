import mongoose from 'mongoose'

const postSchema = new mongoose.Schema({
    user:{
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true
    },
    content : {
        type : String,
        required : true,
    },
    mediaIds :[
        {
            type : String
        }
    ],
    // createdAt :{
    //     type : Date , 
    //     default : Date.now
    // }
},{timestamps : true})
//since we will have a different service for search
postSchema.index({content : 'text'})


const Post = mongoose.model('Post' , postSchema)


export default Post