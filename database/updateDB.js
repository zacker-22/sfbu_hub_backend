import axios from "axios";
import { getDatabase } from "./database.js";
import JSSoup from 'jssoup';
import { getDateTimeFromText, getLocationFromText } from "../chatgpt/chatGPT.js";
import { text } from "express";
import { config } from "dotenv";


function getConfig(accessToken, page=1) {
    return {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://sfbu.instructure.com/api/v1/courses/?page=${page}&include[]=syllabus_body&per_page=100`,
        headers: { 
        'Authorization': `Bearer ${accessToken}`
        }
    }
}
  
 

export const updateDB = async (oneUser = null) => {
    const database = getDatabase();
    const courseCollection = database.collection('courses');
    const userCollection = database.collection('users');

    const users = oneUser == null ?  await userCollection.find().toArray() : [oneUser];
    const cacheCollection = database.collection('cache');
    for(const user of users){
        
        if(user.canvas_token){
            console.log("updating user: ", user.email);
            let page = 1;
            let courses = [];
            let response = null;

            try{
                response = await axios(getConfig(user.canvas_token, page));
            }
            catch(err){
                console.log("error in fetching courses from canvas");
                userCollection.updateOne({_id: user._id}, {$unset: {canvas_token : ""} });
            }
            


            if(response == null){
                continue;
            }

            courses = courses.concat(response.data);
            
            
            let maxTerm = Math.max(...courses.map(course => parseInt(course.enrollment_term_id) ));
            
            courses = courses.filter(course => course.enrollment_term_id === maxTerm);


            for(let course of courses){
                
                const Soup = JSSoup.default;

                let soup = new Soup(course.syllabus_body);
                
                let schedule = soup.text.indexOf('Schedule');
                let location = soup.text.indexOf('Location');
      
                let scheduleText = soup.text.substring(schedule, schedule + 100);
                let locationText = soup.text.substring(location, location + 100);

                let scheduleJson = await cacheCollection.findOne({query: scheduleText});
                let locationJson = await cacheCollection.findOne({query: locationText});

                scheduleJson = scheduleJson?.result;
                locationJson = locationJson?.result;


                if(scheduleJson === null || scheduleJson === undefined || scheduleJson.time1 == null || scheduleJson.time2 == null || scheduleJson.day == null){
                    scheduleJson = await getDateTimeFromText(scheduleText);
                    cacheCollection.insertOne({query: scheduleText, result: scheduleJson});
                }
                if(locationJson === null || locationJson === undefined){
                    locationJson = await getLocationFromText(locationText);
                    cacheCollection.insertOne({query: locationText, result: locationJson});
                }


                await courseCollection.updateOne({id: course.id}, {$set: {
                    id: course.id,
                    name: course.name,
                    is_public: course.is_public,
                    schedule_day: scheduleJson?.day ?? null,
                    schedule_time1: scheduleJson?.time1 ?? null ,
                    schedule_time2: scheduleJson?.time2 ?? null,
                    location: locationJson?.location,
                }}, {upsert: true});
            }
            
            userCollection.updateOne({_id: user._id}, {$set: {courses: courses.map(course => course.id)}});
        }
    }
}
