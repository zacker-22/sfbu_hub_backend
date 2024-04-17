import axios from "axios";
import * as OneSignal from '@onesignal/node-onesignal';
// import { getDatabase } from "../database/database";

export const sendNotificationToCourse = async (email, courseId) => {
    // const database = getDatabase();
    // const userCollection = database.collection('users');
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
        name: 'string',
        include_aliases: {'external_id': ['a2cbe38d-a23b-4bbb-ac3f-e4e853f3bd15']},
        contents: {en: 'New Message'},
        target_channel: 'push',
        isAndroid: true,
    })
    };

    fetch(url, options)
    .then(res => res.json())
    .then(json => console.log(json))
    .catch(err => console.error('error:' + err));
    }