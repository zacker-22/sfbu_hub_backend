import { MongoClient } from 'mongodb';


let mydatabase = null;
export const connectToDatabase = async () => {
    try{
        const client = new MongoClient(process.env.MONGODB_URI);
    
        await client.connect();
        mydatabase = client.db('SFBU_HUB');
        console.log("Connected to database");

    }
    catch(err){
        console.log(err);
    }
}

export const getDatabase = () => {
    return mydatabase;
}