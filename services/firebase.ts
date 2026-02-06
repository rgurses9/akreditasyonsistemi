import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyByfKGwyEzeL86S57zmLs1Smj9Yg3hOVd4",
  authDomain: "akreditasyonkarti.firebaseapp.com",
  projectId: "akreditasyonkarti",
  storageBucket: "akreditasyonkarti.firebasestorage.app",
  messagingSenderId: "1044285877635",
  appId: "1:1044285877635:web:9b5fb77d694891de73dab6",
  measurementId: "G-6JWPMQF9X6"
};

let app;
let analytics;

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  // Initialize Analytics
  analytics = getAnalytics(app);
} catch (error) {
  console.warn("Firebase başlatılamadı, uygulama çevrimdışı modda devam ediyor:", error);
}

export { app, analytics };