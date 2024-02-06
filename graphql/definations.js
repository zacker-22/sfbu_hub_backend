import axios from "axios";
import e from "express";

export const typeDefs = `#graphql
    # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.
    scalar DateTime

    type LoginResponse {
        error: Boolean,
        error_message: String,
        error_code: Int,
        token: String
    }

    type Course {
        id: String,
        name: String,
        is_public: Boolean,
        schdule_day: String,
        schdule_time1: String,
        schdule_time2: String,
        location: String,
        error: Boolean,
        error_message: String,
    }

    type User {
        email: String,
        token: String,
        courses: [Course]
    }

    type CourseResponse {
        error: Boolean,
        error_message: String,
        courses: [Course]
    }

    type Query {
        otpRequest(email: String!): LoginResponse
        login(email: String!, otp: String!): LoginResponse
        getCourses(email: String!, token: String!): CourseResponse
    }

    type Mutation {
        setCanvasToken(email: String!, token: String!): LoginResponse
    }    
`;


export const resolvers = {
    Query: {
        otpRequest: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            const user = await collection.findOne({email: args.email});
            axios.get(`https://zacker22.pythonanywhere.com/send-email?email=${args.email}&otp=1234`);
            if(!user){
                collection.insertOne({email: args.email, otp: "1234", timestamp: new Date()});
            }
            else{
                collection.updateOne({email: args.email}, {$set: {otp: "1234", timestamp: new Date()}});
            }
            return {error: false, error_message: "OTP sent to your email"};
        },
        login: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            const user = await collection.findOne({email: args.email, otp: args.otp});
            
            if(user){
                await collection.updateOne({email: args.email}, {$set: {otp: "", token: "asdfghjkl", timestamp: new Date()}} );
                return {error: false, error_message: "Logged in successfully", token: "asdfghjkl"};
            }
            else{
                return {error: true, error_message: "Invalid OTP"};
            }
        },
        getCourses: async (parent, args, context, info) => {
            const database = context.database;
            const userCollection = database.collection('users');
            const collection = database.collection('courses');
            console.log(args);
            const user = await userCollection.findOne({email: args.email, token: args.token});
            console.log(user);
            if(user){
                console.log(user.courses);
                return {error: false, error_message: "", courses: await collection.find({id: {$in: user.courses}}).toArray()};
            }else{
                return {error: true, error_message: "Invalid token"};
            } 
        },
        hasCanvasToken: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            const user = await collection.findOne({email: args
            .email, token: args.token});
            if(user.canvas_token){
                return {has_canvas_token: true};
            }
            else{
                return {has_canvas_token: false};
            }
        }

    },
    Mutation: {
        setCanvasToken: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            const user = await collection.findOne({email: args.email, token: args.token});
            if(user){
                collection.updateOne({email: args.email}, {$set: {canvas_token: args.canvas_token}});
                return {error: false, error_message: "Token set successfully"};
            }
            else{
                return {error: true, error_message: "Invalid token"};
            }
        }
    }
};