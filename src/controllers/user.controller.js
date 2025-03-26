import { asyncHandler } from '../utils/asyncHandler.js';   
import { ApiError } from '../utils/ApiError.js';
import {User} from '../models/user.models.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from "../utils/ApiResponse.js";
// import jwt from "jsonwebtoken"


const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user detail from frontend (check from data model)
    // validation of formats, not empty etc
     // check if user already exists (check using username and email)
    // check for images, check for avatar
    // upload to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation 
    // return res
    const { fullName, username, email, password } = req.body;
    console.log("email:", email); 

    
    if ([fullName, username, email, password].some(field => field?.trim() === "")) {
        throw new ApiError(400, "Please fill all the fields");
    }

    const existedUser  = await User.findOne({
        $or: [{username}, {email}]
    })

    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }
        
        const avatarLocalPath = req.files?.avatar[0]?.path;
     //const coverImageLocalPath = req.files?.coverImage[0]?.path;

     let coverImageLocalPath;
     if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
         coverImageLocalPath = req.files.coverImage[0].path
     }
     

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    } 

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken");


    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered successfully")
    )







   
})
const loginUser = asyncHandler(async (req, res) => {
       // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie
    const{email,password,username} = req.body

    if(!username || !email){
        throw new ApiError(400, "Please provide username or email");

    }
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
     throw new ApiError(401, "Invalid user credentials")
     }

     const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

     const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

     const options = {
        httpOnly : true,
        secure : true

     }
     return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user : loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User Logged in successfully"

            )
        )

    })
    const logoutUser = asyncHandler(async(req, res) => {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $unset: {
                    refreshToken: 1 // this removes the field from document
                }
            },
            {
                new: true
            }
        )
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out")) 
    })
    

export { 
    registerUser,
    loginUser,
    logoutUser,


 };
