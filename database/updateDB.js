import axios from "axios";
import { getDatabase } from "./database.js";
import JSSoup from 'jssoup';
import { getDateTimeFromText, getLocationFromText } from "../chatgpt/chatGPT.js";
import { text } from "express";


function getConfig(accessToken, page=1) {
    return {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://sfbu.instructure.com/api/v1/courses/?page=${page}`,
        headers: { 
        'Authorization': `Bearer ${accessToken}`
        }
    }
}
  
 

export const updateDB = async () => {
    const database = getDatabase();
    const courseCollection = database.collection('courses');
    const userCollection = database.collection('users');
    const users = await userCollection.find().toArray();
    const cacheCollection = database.collection('cache');
    for(const user of users){
        if(user.canvas_token){
            let page = 1;
            let courses = [];
            let response = await axios(getConfig(user.canvas_token, page));
            courses = courses.concat(response.data);
            while(response.headers.link.includes('rel="next"')){
                page++;
                response = await axios(getConfig(user.canvas_token, page));
                courses = courses.concat(response.data);
            }
            
            let maxTerm = Math.max(...courses.map(course => parseInt(course.enrollment_term_id) ));
            
            courses = courses.filter(course => course.enrollment_term_id === maxTerm);

            // console.log(courses);



            for(let course of courses){
                let courseHtml = await axios.get(`https://sfbu.instructure.com/courses/${course.id}/`);
                const Soup = JSSoup.default;

                let soup = new Soup(courseHtml.data);
                
                let schedule = soup.text.indexOf('Schedule');
                let location = soup.text.indexOf('Location');
      
                let scheduleText = soup.text.substring(schedule, schedule + 150);
                let locationText = soup.text.substring(location, location + 150);
                let scheduleJson = await cacheCollection.findOne({query: scheduleText});
                let locationJson = await cacheCollection.findOne({query: locationText});

                if(scheduleJson == null){
                    scheduleJson = await getDateTimeFromText(scheduleText);
                    cacheCollection.insertOne({query: scheduleText, result: scheduleJson});
                }
                if(locationJson == null){
                    locationJson = await getLocationFromText(locationText);
                    cacheCollection.insertOne({query: locationText, result: locationJson});
                }


                courseCollection.updateOne({id: course.id}, {$set: {
                    id: course.id,
                    name: course.name,
                    is_public: course.is_public,
                    schedule_day: scheduleJson.day,
                    schedule_time1: scheduleJson.time1,
                    schedule_time2: scheduleJson.time2,
                    location: locationJson.location,
                }}, {upsert: true});
            }
            
            userCollection.updateOne({_id: user._id}, {$set: {courses: courses.map(course => course.id)}});

        }
    }
}
