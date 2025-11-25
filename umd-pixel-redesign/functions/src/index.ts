import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

// Ensure admin is initialized only once
if (!admin.apps.length) {
    admin.initializeApp();
}

const SLACK_CLIENT_ID = functions.config().slack?.client_id || process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = functions.config().slack?.client_secret || process.env.SLACK_CLIENT_SECRET;
const SLACK_TEAM_ID = functions.config().slack?.team_id || process.env.SLACK_TEAM_ID;

function assertSlackConfig() {
    if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "Slack OAuth env vars missing (SLACK_CLIENT_ID / SLACK_CLIENT_SECRET)."
        );
    }
}

export const authWithSlack = functions
    .region("us-central1")
    .https.onCall(async (data, _context) => {
    const { code, redirectUri } = data;

    assertSlackConfig();

    if (!code) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Missing 'code' parameter."
        );
    }

    try {
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

        if (SLACK_TEAM_ID && tokenResponse.data.team?.id && tokenResponse.data.team.id !== SLACK_TEAM_ID) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "User is not part of the allowed Slack workspace."
            );
        }

        const { authed_user } = tokenResponse.data;
        const slackUserId = authed_user.id;
        const accessToken = authed_user.access_token;

        const userResponse = await axios.get("https://slack.com/api/users.identity", {
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
        if (!slackUser) {
            throw new functions.https.HttpsError(
                "internal",
                "No user data returned from Slack"
            );
        }
        
        const email = slackUser.email;
        const nameParts = (slackUser.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const userRef = admin.firestore().collection("users").doc(slackUserId);
        const userDoc = await userRef.get();

        let isAdmin = false;
        let pixelDelta = 0;

        if (!userDoc.exists) {
            await userRef.set({
                firstName,
                lastName,
                email,
                slackId: slackUserId,
                isAdmin: false,
                pixels: 0,
                pixelCached: 0,
                pixelDelta: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            const userData = userDoc.data();
            isAdmin = userData?.isAdmin || false;
            pixelDelta = userData?.pixelDelta ?? userData?.pixeldelta ?? 0;
            await userRef.update({
                firstName,
                lastName,
                email,
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        const customToken = await admin.auth().createCustomToken(slackUserId, {
            isAdmin: isAdmin,
            pixelDelta,
        });

        return { token: customToken };
    } catch (error: any) {
        console.error("Auth Error:", error);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        
        if (error?.response?.data) {
            console.error("Slack API Error Response:", JSON.stringify(error.response.data));
        }
        if (error?.message) {
            console.error("Error Message:", error.message);
        }
        
        throw new functions.https.HttpsError(
            "internal",
            error?.message || "Authentication failed."
        );
    }
});

/**
 * Trigger: onEventUpdate
 * Listens for changes in 'events' collection.
 * If 'attendees' or 'pixels' change, recalculates pixels for affected users.
 */
export const onEventUpdate = functions
    .region("us-central1")
    .firestore.document("events/{eventId}")
    .onWrite(async (change, _context) => {
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
export const onExcusedAbsenceUpdate = functions
    .region("us-central1")
    .firestore.document("events/{eventId}/excused_absences/{absenceId}")
    .onWrite(async (change, _context) => {
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

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;
    const pixelDelta = userDoc.data()?.pixelDelta ?? userDoc.data()?.pixeldelta ?? 0;

    let totalPixels = pixelDelta;

    const settingsDoc = await db.collection("settings").doc("global").get();
    const currentSemesterId = settingsDoc.data()?.currentSemesterId;

    if (!currentSemesterId) {
        console.log("No current semester set.");
        return;
    }

    // Get all approved excused absences for this user
    const excusedSnapshot = await db.collectionGroup("excused_absences")
        .where("userId", "==", userId)
        .where("status", "==", "approved")
        .get();

    const excusedEventIds = new Set<string>();
    excusedSnapshot.forEach((doc) => {
        // Parent of excused_absences is the event document
        const eventRef = doc.ref.parent.parent;
        if (eventRef) {
            excusedEventIds.add(eventRef.id);
        }
    });

    const eventsSnapshot = await db.collection("events")
        .where("semesterId", "==", currentSemesterId)
        .get();

    eventsSnapshot.forEach((doc) => {
        const eventData = doc.data();
        const attendees = eventData.attendees || [];
        const pixels = eventData.pixels || 0;

        // Only count pixels if user attended AND is not excused
        if (attendees.includes(userId) && !excusedEventIds.has(doc.id) && pixels > 0) {
            totalPixels += pixels;
        }
    });

    // Activities: pixels * multiplier
    const activitiesSnapshot = await db.collection("activities")
        .where("semesterId", "==", currentSemesterId)
        .get();

    activitiesSnapshot.forEach((doc) => {
        const data = doc.data();
        const multipliers = data.multipliers || {};
        const multiplier = multipliers[userId];
        if (multiplier && data.pixels) {
            totalPixels += data.pixels * multiplier;
        }
    });

    await db.collection("users").doc(userId).update({
        pixels: totalPixels,
        pixelCached: totalPixels,
    });
}

/**
 * Trigger: onActivityUpdate
 * Recalculate pixels for users affected by multipliers.
 */
export const onActivityUpdate = functions
    .region("us-central1")
    .firestore.document("activities/{activityId}")
    .onWrite(async (change, _context) => {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        const userIds = new Set<string>();
        if (before?.multipliers) {
            Object.keys(before.multipliers).forEach((id) => userIds.add(id));
        }
        if (after?.multipliers) {
            Object.keys(after.multipliers).forEach((id) => userIds.add(id));
        }
        await Promise.all(Array.from(userIds).map((uid) => recalculateUserPixels(uid)));
    });
