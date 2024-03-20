import axios from "axios";
import { updateDB, getAssignments } from "../database/updateDB.js";
import env from 'dotenv';
import {getReplyToChat} from '../chatgpt/chatGPT.js'
env.config();

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
        schedule_day: String,
        schedule_time1: String,
        schedule_time2: String,
        location: String,
        error: Boolean,
        error_message: String,
        members: [User]
    }

    type User {
        email: String,
        token: String,
        courses: [Course],
        canvas_token: String,
        name: String,
        short_name: String,
    }

    type CourseResponse {
        error: Boolean,
        error_message: String,
        courses: [Course]
    }

    type CanvasTokenResponse {
        has_canvas_token: Boolean
    }

    type ChatMessage {
        group_id: String,
        sender_name: String,
        sender_email: String,
        message: String,
        created_at: DateTime
    }

    type Assignments {
        id: String,
        name: String,
        due_at: DateTime,
        course_id: String,
        description: String,
        is_submitted: Boolean
    }

    type ChatReads {
        course_id: String,
        count: Int
    }

    type Query {
        otpRequest(email: String!): LoginResponse
        login(email: String!, otp: String!): LoginResponse
        getCourses(email: String!, token: String!): CourseResponse
        hasCanvasToken(email: String!, token: String!): CanvasTokenResponse
        getCourseMembers(course_id: String!): [User]
        getChatMessages(course_id: String!): [ChatMessage]
        user(email: String!, token: String!): User
        assignments(email: String!, token: String!): [Assignments]
        chatReads(email: String!): [ChatReads]
    }

    type Mutation {
        setCanvasToken(email: String!, token: String!, canvas_token: String!): LoginResponse
        addChatMessage(course_id: String!, sender_name: String!, sender_email: String!, message: String!): LoginResponse
        markChatRead(email: String!, course_id: String!): Boolean
    }    
`;


export const resolvers = {
    Query: {
        otpRequest: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            const user = await collection.findOne({email: args.email});
            let otp = Math.floor(1000 + Math.random() * 9000).toString();

            if(args.email == process.env.TEST_EMAIL){
                otp = "1234";
            }else{
                axios.get(`https://zacker22.pythonanywhere.com/send-email?email=${args.email}&otp=${otp}`);
            }
            

            
            if(!user){
                collection.insertOne({email: args.email, otp: otp, timestamp: new Date()});
                // updateDB(await collection.findOne({email: args.email}));
            }
            else{
                collection.updateOne({email: args.email}, {$set: {otp: otp, timestamp: new Date()}});
              
            }
            return {error: false, error_message: "OTP sent to your email"};
        },
        login: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            const user = await collection.findOne({email: args.email, otp: args.otp});
            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            
            if(user){
                await collection.updateOne({email: args.email}, {$set: {otp: "", token: token, timestamp: new Date()}} );
                return {error: false, error_message: "Logged in successfully", token: token};
            }
            else{
                return {error: true, error_message: "Invalid OTP"};
            }
        },
        getCourses: async (parent, args, context, info) => {
            const database = context.database;
            const userCollection = database.collection('users');
            const collection = database.collection('courses');
  
            const user = await userCollection.findOne({email: args.email, token: args.token});
            console.log(user);
            if(user){
                return {error: false, error_message: "", courses: await collection.find({id: {$in: user.courses}}).toArray()};
            }else{
                return {error: true, error_message: "Invalid token"};
            } 
        },
        hasCanvasToken: async (parent, args, context, info) => {
            console.log(args);
            const database = context.database;
            const collection = database.collection('users');
            const user = await collection.findOne({email: args.email, token: args.token});
            if(user.canvas_token){
                return {has_canvas_token: true};
            }
            else{
                return {has_canvas_token: false};
            }
        },
        getCourseMembers: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            return await collection.find({courses: parseInt(args.course_id) }).toArray();
        },
        getChatMessages: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('chats');
            return (await collection.find({course_id: args.course_id})).toArray() || [];
        },
        user: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            return await collection.findOne({email: args.email, token: args.token});
        },
        assignments: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            const user = await collection.findOne({email: args.email, token: args.token});
            const courseCollection = database.collection('courses');
            if(user){
                const canvas_token = user.canvas_token;
                if(!canvas_token){
                    return [];
                }
                const courses = user.courses;
                
                let assignments = [];
                let promises = [];
                for(let course of courses){
                    const course_name = (await courseCollection.findOne({id: course})).name;
                    promises.push(getAssignments(canvas_token, course).then(response => {
                        const currentAssignments = response.map(assignment => {
                            return {
                                id: assignment.id,
                                name: assignment.name,
                                due_at: assignment.due_at,
                                course_id: course,
                                description: course_name,
                                is_submitted: assignment.has_submitted_submissions
                            }
                        });
                        assignments = assignments.concat(currentAssignments);
                    }));                    
                }
                await Promise.all(promises);
                // remove assignment with due_at == null and is_submitted == false
                const contextCollection = database.collection('context');
                if(contextCollection.findOne({email: args.email})){
                    contextCollection.insertOne({email: args.email, assignments: assignments});
                }
                else{
                    contextCollection.updateOne({email: args.email}, {$set: {assignments: assignments}});
                }
                assignments = assignments.filter(
                    assignment => (assignment.due_at != null) && (assignment.is_submitted == false || new Date(assignment.due_at) > new Date())
                )
                return assignments;
            }
            else{
                return [];
            }
        },
        chatReads: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('chat_reads');
            const userCollection = database.collection('users');
            const courses = (await userCollection.findOne({email: args.email})).courses;
            let chatReads = [];

            const chatCollection = database.collection('chats');

            for(let course of courses){
                const chatRead = await collection.findOne({email: args.email, course_id: course.toString()});
                const chatCount = await chatCollection.countDocuments({course_id:  course.toString() });
                if(chatRead){
                    chatReads.push({course_id: chatRead.course_id, count: chatCount - chatRead.count});
                }else{
                    chatReads.push({course_id: course, count: chatCount});
                }
            }
            return chatReads;
        }
    },
    Course: {
        members: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            console.log(parent);
            return (await collection.find( {courses : parseInt(parent.id), canvas_token: {$exists : true} } )).toArray() || [];
        }

    },

    Mutation: {
        setCanvasToken: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('users');
            const user = await collection.findOne({email: args.email, token: args.token});
            if(user){
                await collection.updateOne({email: args.email}, {$set: {canvas_token: args.canvas_token}});
                await updateDB(user);
                return {error: false, error_message: "Token set successfully"};
                
            }
            else{
                return {error: true, error_message: "Invalid token"};
            }
        },
        addChatMessage: async (parent, args, context, info) => {
            try{
                const database = context.database;
                const userCollection = database.collection('users');
                const user = await userCollection.findOne({email: args.sender_email});
                const collection = database.collection('chats');
                if(args.course_id.startsWith("chat_bot")){
                    
                    const chat_history = await (await collection.find({course_id: args.course_id})).toArray();
                    const user_context = "User: " + args.sender_name + " (" + args.sender_email + ")";
                    const last_message = args.message;
                    const canvas_token = user.canvas_token;
                    if(!canvas_token){
                        return [];
                    }
                    const courses = user.courses;
                    collection.insertOne({course_id: args.course_id, sender_name: args.sender_name, sender_email: args.sender_email, message: args.message, created_at: new Date()});
                    const reply = await getReplyToChat(chat_history, user_context, last_message);
                    collection.insertOne({course_id: args.course_id, sender_name: "Assistant", sender_email: "", message: reply, created_at: new Date()}); 
                    return {error: false, error_message: "Message sent successfully"};                   
                }
                collection.insertOne({course_id: args.course_id, sender_name: args.sender_name, sender_email: args.sender_email, message: args.message, created_at: new Date()});
                return {error: false, error_message: "Message sent successfully"};
            }
            catch(err){
                return {error: true, error_message: "Error in sending message"};
            }
        },
        markChatRead: async (parent, args, context, info) => {
            const database = context.database;
            const collection = database.collection('chat_reads');
            const chatRead = await collection.findOne({email: args.email, course_id: args.course_id});
            const chatCollection = database.collection('chats');
            const chatCount = await chatCollection.countDocuments({course_id: args.course_id});
            if(chatRead){
                collection.updateOne({email: args.email, course_id: args.course_id}, {$set: {count: chatCount}});
            }
            else{
                collection.insertOne({email: args.email, course_id: args.course_id, count: chatCount});
            }
            return true;
        }
    }
};