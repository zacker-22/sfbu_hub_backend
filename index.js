import {connectToDatabase, getDatabase} from './database/database.js';
import {typeDefs, resolvers} from './graphql/definations.js';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { updateDB } from './database/updateDB.js';
import cron from 'node-cron';



import dotenv from 'dotenv';
dotenv.config();

const port = process.env.PORT || 3000

await connectToDatabase();

// cron.schedule('* 2 * * *', async () => {
// await updateDB();
// });
// await updateDB();

const server = new ApolloServer({
    typeDefs,
    resolvers,
});

const { url } = await startStandaloneServer(server, {
    listen: { port: port },
    context: async ({ req }) => {
        return { database: getDatabase() };
    },
});

console.log(`🚀  Server ready at: ${url}`);
