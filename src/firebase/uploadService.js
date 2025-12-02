// uploadService.js
import { storage } from '../firebase/firebaseConfig'; // Adjust the import path as needed
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const uploadPdf = async (file) => {
    if (!file) return ""; // Return empty string if no file
    const storageRef = ref(storage, "pdfs/" + file.name); // Store PDFs in 'pdfs' folder
    try {
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading PDF:", error);
        return ""; // Return empty string on error
    }
};