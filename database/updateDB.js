import axios from "axios";
import { getDatabase } from "./database.js";
import JSSoup from 'jssoup';
import { getDateTimeFromText, getLocationFromText } from "../chatgpt/chatGPT.js";


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
                
                let schdule = soup.text.indexOf('Schedule');
                let location = soup.text.indexOf('Location');
                // console.log(course.is_public);
                // console.log(course.name);
                // console.log(soup.text.substring(schdule, schdule + 150));
                // console.log(await getDateTimeFromText(soup.text.substring(schdule, schdule + 150)));
                // console.log(soup.text.substring(location, location + 150));
                // console.log(await getLocationFromText(soup.text.substring(location, location + 150)));

                

                let courseSchedule = await getDateTimeFromText(soup.text.substring(schdule, schdule + 150));
                let courseLocation = await getLocationFromText(soup.text.substring(location, location + 150));
                courseCollection.updateOne({id: course.id}, {$set: {
                    id: course.id,
                    name: course.name,
                    is_public: course.is_public,
                    schdule_day: courseSchedule.day,
                    schdule_time1: courseSchedule.time1,
                    schdule_time2: courseSchedule.time2,
                    location: courseLocation.location,
                }}, {upsert: true});
            }
            
            userCollection.updateOne({_id: user._id}, {$set: {courses: courses.map(course => course.id)}});
            console.log(user, courses.map(course => course.id));

        }
    }
}
