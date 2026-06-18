const { onCall, HttpsError } = require("firebase-functions/v2/https"); // ← add HttpsError
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({ region: "europe-west1" });

exports.createStaffUser = onCall(
  {
    cors: [
      "http://localhost:3000",
      "http://localhost:5173",      // Vite dev server
      "https://your-production-domain.com", // ← swap in your real domain
    ],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not signed in");
    }

    const callerDoc = await admin.firestore()
      .doc(`users/${request.auth.uid}`).get();

    if (callerDoc.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admins only");
    }

    const { firstName, lastName, email, password, role, clinicId, createdBy } = request.data;

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    await admin.firestore().doc(`users/${userRecord.uid}`).set({
      userId:             userRecord.uid,
      clinicId,
      firstName,
      lastName,
      name:               `${firstName} ${lastName}`,
      email,
      role,
      active:             true,
      mustChangePassword: true,
      createdBy:          createdBy || "admin",
      createdAt:          admin.firestore.FieldValue.serverTimestamp(),
    });

    return { uid: userRecord.uid };
  }
);