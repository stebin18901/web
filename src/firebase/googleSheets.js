// firebase/googleSheets.js
import { db } from "./firebaseConfig";

// Google Sheets API URL (Replace with your actual Sheet ID & API Key)
const SHEET_ID = "YOUR_SHEET_ID";
const API_KEY = "YOUR_GOOGLE_API_KEY";
const GOOGLE_SHEETS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1?key=${API_KEY}`;

// Fetch quiz responses from Google Sheets
export const fetchQuizResponses = async () => {
  try {
    const response = await fetch(GOOGLE_SHEETS_URL);
    const data = await response.json();
    
    if (data.values) {
      const [headers, ...rows] = data.values;
      return rows.map(row => {
        let obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });
    } else {
      throw new Error("No data found in Google Sheets.");
    }
  } catch (error) {
    throw error;
  }
};

// Save Google Sheets Data to Firestore
export const saveResponsesToFirestore = async (responses) => {
  try {
    for (let response of responses) {
      await addDoc(collection(db, "quizResponses"), response);
    }
  } catch (error) {
    throw error;
  }
};
