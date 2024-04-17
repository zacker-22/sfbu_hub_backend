import axios from "axios";
import * as OneSignal from '@onesignal/node-onesignal';
import { getDatabase } from "../database/database.js";


const sendNotification = (heading, content, id) => {
    const url = 'https://api.onesignal.com/notifications';
    const options = {
    method: 'POST',
    headers: {
        accept: 'application/json',
        Authorization: `Basic ${process.env.ONE_SIGNAL_KEY}`,
        'content-type': 'application/json'
    },
    body: JSON.stringify({
        app_id: `${process.env.ONE_SIGNAL_APP_ID}`,
        name: `${heading}`,
        include_aliases: {'external_id': [`${id}`]},
        contents: {en: `${content}`},
        target_channel: 'push',
    })
    };

    fetch(url, options)
    .then(res => res.json())
    .then(json => console.log(json))
    .catch(err => console.error('error:' + err));
}

export const sendNotificationToCourse = async (email, courseId, name) => {
    const database = getDatabase();
    const userCollection = database.collection('users');
    const courseCollection = database.collection('courses');


    const users = await userCollection.find({}).toArray();
    const course = await courseCollection.findOne({id: parseInt(courseId)});
    const courseName = course.name;
    for(const user of users) {
        console.log(user.email, user.courses && user.courses.includes(parseInt(courseId)));
        if(user.courses && user.courses.includes(parseInt(courseId)) && user.email !== email && user.notification_token) {
            console.log("Sending notification to: " + user.email);
            sendNotification(`New Message in ${courseName}`, `${name} sent a new message in ${courseName}`, user.notification_token);
        }
    }
   
}