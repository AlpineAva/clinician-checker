import axios from 'axios';
import nodemailer from 'nodemailer';
import * as turf from '@turf/turf'

const EMAIL_FROM = '';
const EMAIL_TO = '';
const GMAIL_APP_KEY = ''; 
const CLINICIANS = [1, 2, 3, 4, 5, 6];

var cliniciansOutOfBounds = new Set();
var cliniciansOutOfBoundsInformation = {};
var errorMessages = new Set();

function runService() {
    setInterval(queryClinicians, 20000); // every 20 seconds check status
    setInterval(notifyEmails, 300000) // every 5 minutes send a notification email
}

function queryClinicians() {
    CLINICIANS.forEach(c => {
        axios.get('https://3qbqr98twd.execute-api.us-west-2.amazonaws.com/test/clinicianstatus/' + c)
            .then(res => processRequest(res.data, c))
            .catch(err => errorMessages.add(err));
    });
}

function processRequest(data, clinicianNumber) {
    if(data.error) {
        errorMessages.add(data.error);
        return;
    }
    let location = data.features.filter(f => f.geometry.type === "Point")[0];
    let polygons = data.features.filter(f => f.geometry.type === "Polygon");
    let isInside = polygons.some(poly => inAnyLocation(location, poly));

    if(!isInside && !cliniciansOutOfBounds.has(clinicianNumber)) {
        cliniciansOutOfBounds.add(clinicianNumber);
        cliniciansOutOfBoundsInformation[clinicianNumber] = {
            geoData: JSON.stringify(data) 
        }
    }
}


// Handles the edge case where a polygon has multiple arrays
function inAnyLocation(location, poly) {
    let coordinateArrays = poly.geometry.coordinates;
    return coordinateArrays.some(c => turf.inside(location, turf.polygon([c])));
}


function sendOutOfBoundsEmail(clinicianNumber) {
    let title = 'Clinician ' + clinicianNumber + ' is out of bounds!';
    let body = 'GeoData\n' + cliniciansOutOfBoundsInformation[clinicianNumber].geoData;
    sendEmail(title, body);
}

function sendErrorEmail(error) {
    let title = 'An Error occurred with the server while checking clinician locations';
    let body = 'Error Details Below\n' + error;
    sendEmail(title, body);
}

function sendEmail(title, body) {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: EMAIL_FROM,
          pass: GMAIL_APP_KEY
        }
      });
      
      var mailOptions = {
        from: EMAIL_FROM,
        to: EMAIL_TO,
        subject: title,
        text: body
      };
      
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
}

function notifyEmails() {
    cliniciansOutOfBounds.forEach(c => {
        sendOutOfBoundsEmail(c)
    });

    errorMessages.forEach(error => {
        sendErrorEmail(error);
    });

    cliniciansOutOfBounds = new Set();
    cliniciansOutOfBoundsInformation = {};
}

runService();