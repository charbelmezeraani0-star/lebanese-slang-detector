// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCMLulhogAsgNySqu46tO6NgxArt60lrhY",
  authDomain: "slangdetector-204f1.firebaseapp.com",
  projectId: "slangdetector-204f1",
  storageBucket: "slangdetector-204f1.firebasestorage.app",
  messagingSenderId: "1027036454180",
  appId: "1:1027036454180:web:821c3893d296d8adf267b1"
};

const app = initializeApp(firebaseConfig);


export const db = getFirestore(app);
