require('dotenv').config();
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, setDoc } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: process.env.FIREBASE_APIKEY,
    authDomain: "plutonium-wallet.firebaseapp.com",
    projectId: "plutonium-wallet",
    storageBucket: "plutonium-wallet.appspot.com",
    messagingSenderId: process.env.FIREBASE_MESSAGINGSENDERID,
    appId: process.env.FIREBASE_APPID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getUserDetails = async (id) => {
    const docRef = doc(db, "wallets", id.toLowerCase());
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return ({ status: 200, data: docSnap.data(), msg: "User Data fetched successfully!" })
    } else {
        return ({ status: 400, data: null, msg: "User not found!" })
    }
}

const addUserDetails = async (id, data) => {
    try {
        const docRef = doc(db, "wallets", id.toLowerCase());
        await setDoc(docRef, data);
        return ({ status: 200, data: null, msg: "User Data stored successfully!" })
    }
    catch (e) {
        return ({ status: 400, data: e, msg: "Error storing user data! Please try again." })
    }
}

module.exports = { getUserDetails, addUserDetails }