import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyByfKGwyEzeL86S57zmLs1Smj9Yg3hOVd4",
  authDomain: "akreditasyonkarti.firebaseapp.com",
  databaseURL: "https://akreditasyonkarti-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "akreditasyonkarti",
  storageBucket: "akreditasyonkarti.firebasestorage.app",
  messagingSenderId: "1044285877635",
  appId: "1:1044285877635:web:9b5fb77d694891de73dab6",
  measurementId: "G-6JWPMQF9X6"
};

let app;
let analytics;
let database;

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  // Initialize Analytics
  analytics = getAnalytics(app);
  // Initialize Realtime Database
  database = getDatabase(app);
} catch (error) {
  console.warn("Firebase başlatılamadı, uygulama çevrimdışı modda devam ediyor:", error);
}

export { app, analytics, database };