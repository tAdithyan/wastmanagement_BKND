// config/firebaseAdmin.js

import admin from "firebase-admin";
import serviceAccount from "./firebaseCredentials.json" with { type: "json" };

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

export { admin };