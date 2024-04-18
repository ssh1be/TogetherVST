// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC8N2DrZddIjadKk6iKJyAYDJfAvaMz8fc",
  authDomain: "together-70afc.firebaseapp.com",
  projectId: "together-70afc",
  storageBucket: "together-70afc.appspot.com",
  messagingSenderId: "903769378174",
  appId: "1:903769378174:web:f693fc7570746954feb72f",
  measurementId: "G-89JEF3BJ8S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
