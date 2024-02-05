import axios from "axios";

export const typeDefs = `#graphql
    # Comments in GraphQL strings (such as this one) start with the hash (#) symbol.
    scalar DateTime

    type LoginResponse {
        error: Boolean,
        error_message: String,
        error_code: Int,
        token: String
    }

    type Query {
        otpRequest(email: String!): LoginResponse
        login(email: String!, otp: String!): LoginResponse
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
        }

    },
    
};