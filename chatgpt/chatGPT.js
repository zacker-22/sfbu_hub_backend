import dotenv from 'dotenv';
import { OpenAI} from 'openai'; 

dotenv.config();

export async function getDateTimeFromText(raw_text)  {

    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const messageList = [
        {
            role: 'system',
            content: 'The user will give you a raw text. You have to extract the day of week and two times from the raw text.'
        },
        {
            role: 'system',
            content: 'Convert the day to full day name. Convert time to 24H format'
        },
        {
            role: 'system',
            content: 'Only return thr output in Json format. {day: "Monday", time1: "22:00", time2: "11:00"}, Put null if  the information is not present.'
        }, {
            role: 'user',
            content: raw_text
        }
    ];

    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messageList,
    });

    return JSON.parse(response.choices[0].message.content);
}

export async function getLocationFromText(raw_text)  {

    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    const messageList = [
        {
            role: 'system',
            content: 'The user will give you a raw text. You have to extract the location from the raw text.'
        },
        {
            role: 'system',
            content: 'Return the output in Json format. {location: "location"}, Put null if the information is not present.'
        }, {
            role: 'user',
            content: raw_text
        }
    ];

    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messageList,
    });

    return JSON.parse(response.choices[0].message.content);
}


export async function getReplyToChat(chats, user_context, last_message){
    const openai = new OpenAI(process.env.OPENAI_API_KEY);

    let chat_history = []
    for(let chat of chats){
        chat_history.push({
            role: chat.sender_name === 'Assistant' ? 'system' : 'user',
            content: chat.message
        });
    }
    console.log('chat_history', chat_history);

    const messageList = [
        {
            role: 'system',
            content: 'You are a personal chatbot assistant. You have the following context: \n' + JSON.stringify(user_context)
        },
        {
            role: 'system',
            content: 'The user had following chat with you: \n' + JSON.stringify(chat_history)
        },
        {
            role: 'system',
            content: 'Reply to the user query given the context and chat history. If you don\'t have enough context, Reply with a generic message.'
        },
        {
            role: 'user',
            content: last_message
        }
    ];

    console.log('messageList', messageList);

    

    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messageList,
    });

    return response.choices[0].message.content;
}