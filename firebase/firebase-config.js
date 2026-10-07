/* =========================================================
   LISTEN MY FEELINGS
   Firebase Client Configuration
   Firebase Web SDK 12.2.1
   ========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/*
 * Firebase Web configuration.
 *
 * IMPORTANT:
 * Firebase Web API keys are identifiers for the Firebase
 * project and are not treated as server secrets.
 *
 * Real security is enforced through:
 * - Firebase Authentication
 * - Firestore Security Rules
 * - Proper database structure
 *
 * Never place Firebase Admin SDK credentials,
 * service-account private keys, or other server secrets
 * in this file.
 */

const firebaseConfig = {
    apiKey: "AIzaSyDaYNx89vnvc-SHrTNfNrQ0gJCYdnrBOI",
    authDomain: "createyourownidentity-2e2a3.firebaseapp.com",
    projectId: "createyourownidentity-2e2a3",
    storageBucket: "createyourownidentity-2e2a3.firebasestorage.app",
    messagingSenderId: "316875593955",
    appId: "1:316875593955:web:529cb0fe3c45f2cca54dd6",
    measurementId: "G-LXVR8CJWRE"
};


/*
 * Initialize Firebase exactly once.
 */

const firebaseApp = initializeApp(firebaseConfig);


/*
 * Firebase Authentication
 *
 * V1 authentication will use:
 * - Email
 * - Password
 *
 * Passwords are handled by Firebase Authentication.
 * We do not store passwords in Firestore or Local Storage.
 */

const auth = getAuth(firebaseApp);


/*
 * Cloud Firestore
 *
 * Firestore will be the primary application database
 * for V1.
 */

const db = getFirestore(firebaseApp);


/*
 * Export only the Firebase client instances required
 * by the application.
 */

export {
    firebaseApp,
    auth,
    db
};
