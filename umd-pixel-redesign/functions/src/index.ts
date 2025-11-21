import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

// Ensure admin is initialized only once
if (!admin.apps.length) {
    admin.initializeApp();
}

// Placeholders for Slack Credentials - User to fill these in
const SLACK_CLIENT_ID = "PLACEHOLDER_SLACK_CLIENT_ID";
const SLACK_CLIENT_SECRET = "PLACEHOLDER_SLACK_CLIENT_SECRET";

export const authWithSlack = functions.https.onCall(async (data, context) => {
    const { code, redirectUri } = data;

    if (!code) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Missing 'code' parameter."
        );
    }

    try {
        // 1. Exchange code for access token
        const tokenResponse = await axios.post(
            "https://slack.com/api/oauth.v2.access",
            null,
            {
                params: {
                    client_id: SLACK_CLIENT_ID,
                    client_secret: SLACK_CLIENT_SECRET,
                    code: code,
                    redirect_uri: redirectUri,
                },
            }
        );

        if (!tokenResponse.data.ok) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                `Slack OAuth failed: ${tokenResponse.data.error}`
            );
        }

        const { authed_user } = tokenResponse.data;
        const slackUserId = authed_user.id;
        const accessToken = authed_user.access_token;

        // 2. Get User Info (to get email/name)
        const userResponse = await axios.get("https://slack.com/api/users.info", {
            params: {
                user: slackUserId,
            },
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!userResponse.data.ok) {
            throw new functions.https.HttpsError(
                "internal",
                `Failed to fetch user info: ${userResponse.data.error}`
            );
        }

        const slackUser = userResponse.data.user;
        const email = slackUser.profile.email;
        const firstName = slackUser.profile.first_name || slackUser.real_name.split(" ")[0];
        const lastName = slackUser.profile.last_name || slackUser.real_name.split(" ").slice(1).join(" ");

        // 3. Check if user exists in Firestore
        const userRef = admin.firestore().collection("users").doc(slackUserId);
        const userDoc = await userRef.get();

        let isAdmin = false;

        if (!userDoc.exists) {
            await userRef.set({
                firstName,
                lastName,
                email,
                slackId: slackUserId,
                isAdmin: false,
                pixels: 0,
                pixelDelta: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            const userData = userDoc.data();
            isAdmin = userData?.isAdmin || false;
            await userRef.update({
                firstName,
                lastName,
                email,
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // 4. Create Firebase Custom Token
        const customToken = await admin.auth().createCustomToken(slackUserId, {
            isAdmin: isAdmin,
        });

        return { token: customToken };
    } catch (error) {
        console.error("Auth Error:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Authentication failed."
        );
    }
});

// --- Phase 4: Backend Logic ---

/**
 * Trigger: onEventUpdate
 * Listens for changes in 'events' collection.
 * If 'attendees' or 'pixels' change, recalculates pixels for affected users.
 */
export const onEventUpdate = functions.firestore
    .document("events/{eventId}")
    .onWrite(async (change, context) => {
        const beforeData = change.before.exists ? change.before.data() : null;
        const afterData = change.after.exists ? change.after.data() : null;

        // If deleted, we need to remove pixels from attendees
        // If created, we need to add pixels to attendees
        // If updated, we need to handle diffs

        const affectedUserIds = new Set<string>();

        if (beforeData && beforeData.attendees) {
            beforeData.attendees.forEach((uid: string) => affectedUserIds.add(uid));
        }
        if (afterData && afterData.attendees) {
            afterData.attendees.forEach((uid: string) => affectedUserIds.add(uid));
        }

        // Recalculate for all affected users
        const promises = Array.from(affectedUserIds).map(async (userId) => {
            await recalculateUserPixels(userId);
        });

        await Promise.all(promises);
    });

/**
 * Trigger: onExcusedAbsenceUpdate
 * Listens for changes in 'events/{eventId}/excused_absences' subcollection.
 * If status changes to 'approved', recalculate pixels.
 */
export const onExcusedAbsenceUpdate = functions.firestore
    .document("events/{eventId}/excused_absences/{absenceId}")
    .onWrite(async (change, context) => {
        const afterData = change.after.exists ? change.after.data() : null;
        const beforeData = change.before.exists ? change.before.data() : null;

        const userId = afterData?.userId || beforeData?.userId;

        if (userId) {
            await recalculateUserPixels(userId);
        }
    });

/**
 * Helper function to recalculate total pixels for a user.
 * Sums up:
 * 1. Pixels from attended events.
 * 2. Pixels from approved excused absences (if applicable - usually excused means no pixels but attendance credit, 
 *    BUT the old code logic says: if (required && attended == "Excused") -> requiredExcused += 1.
 *    And: if (attended == "Attended" && eventDoc["pixels"] > 0) -> pixelsEarned += eventDoc["pixels"].
 *    So Excused absences do NOT give pixels, only attendance credit.
 *    Wait, let's double check the old code.
 */
async function recalculateUserPixels(userId: string) {
    const db = admin.firestore();

    // 1. Get User's Pixel Delta (manual adjustment)
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;
    const pixelDelta = userDoc.data()?.pixelDelta || 0;

    let totalPixels = pixelDelta;

    // 2. Get all events where user is an attendee
    // Note: In a large scale app, this query might be expensive. 
    // Better to keep a running total, but for migration fidelity we replicate the "recalculate all" approach first.
    // Or we can query only events this semester? 
    // The old code queried ALL events in the CURRENT semester.

    // Let's get the current semester first
    const settingsDoc = await db.collection("settings").doc("global").get();
    const currentSemesterId = settingsDoc.data()?.currentSemesterId;

    if (!currentSemesterId) {
        console.log("No current semester set.");
        return;
    }

    // Query events in current semester
    const eventsSnapshot = await db.collection("events")
        .where("semesterId", "==", currentSemesterId)
        .get();

    eventsSnapshot.forEach((doc) => {
        const eventData = doc.data();
        const attendees = eventData.attendees || [];
        const pixels = eventData.pixels || 0;

        if (attendees.includes(userId)) {
            totalPixels += pixels;
        }
    });

    // 3. Update User
    await db.collection("users").doc(userId).update({
        pixels: totalPixels,
    });
}
