import {connectToDatabase, getDatabase} from './database/database.js';
import {typeDefs, resolvers} from './graphql/definations.js';
import { ApolloServer } from '@apollo/server';
import cron from 'node-cron';
import express from 'express';
import { PubSub } from 'graphql-subscriptions';
import { WebSocketServer } from 'ws';
import {createServer} from 'http';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { useServer } from 'graphql-ws/lib/use/ws';
import cors from 'cors';
import bodyParser from 'body-parser';
import { expressMiddleware } from '@apollo/server/express4';
import { updateDB } from './database/updateDB.js';



import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000

process.setMaxListeners(0);

await connectToDatabase();

// cron.schedule('* 2 * * *', async () => {
await updateDB();
// });
// await updateDB();

// console.log(random.str);
const pubsub = new PubSub();
const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();
const httpServer = createServer(app);

// Set up WebSocket server.
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/',
});
const serverCleanup = useServer({ schema, context: ({ req }) => ({ database: getDatabase(), pubsub: pubsub, req }) }, wsServer);


// Set up ApolloServer.
const server = new ApolloServer({
  schema,
  context: ({ req }) => ({ database: getDatabase(), pubsub: pubsub, req }),
  plugins: [
    // Proper shutdown for the HTTP server.
    ApolloServerPluginDrainHttpServer({ httpServer }),

    // Proper shutdown for the WebSocket server.
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

await server.start();
app.use('/', cors(), bodyParser.json(), expressMiddleware(server, {
    context: async ({ req, res }) => ({
      database: getDatabase(),
     pubsub: pubsub,
    }),
  }), 
  );

// Now that our HTTP server is fully set up, actually listen.
httpServer.listen(PORT, () => {
  console.log(`🚀 Query endpoint ready at http://localhost:${PORT}/graphql`);
  console.log(`🚀 Subscription endpoint ready at ws://localhost:${PORT}/graphql`);
});

