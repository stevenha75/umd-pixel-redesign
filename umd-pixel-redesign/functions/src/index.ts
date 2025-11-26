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
const SLACK_BOT_TOKEN = functions.config().slack?.bot_token || process.env.SLACK_BOT_TOKEN;

function assertSlackConfig() {
    if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "Slack OAuth env vars missing (SLACK_CLIENT_ID / SLACK_CLIENT_SECRET)."
        );
    }
}

interface SlackMember {
    id: string;
    name: string;
    real_name: string;
    profile: {
        email: string;
        image_original?: string;
        image_512?: string;
    };
    deleted: boolean;
    is_bot: boolean;
    is_app_user: boolean;
}

export const getSlackUsers = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
        if (!context.auth?.token.isAdmin) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "Must be an admin to fetch Slack users."
            );
        }

        if (!SLACK_BOT_TOKEN) {
            throw new functions.https.HttpsError(
                "failed-precondition",
                "Slack Bot Token missing (SLACK_BOT_TOKEN). Please configure slack.bot_token."
            );
        }

        const allMembers: unknown[] = [];
        let cursor: string | undefined;
        let pageCount = 0;
        const MAX_PAGES = 20; // Safety limit

        try {
            do {
                const response = await axios.get("https://slack.com/api/users.list", {
                    headers: {
                        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
                    },
                    params: {
                        limit: 1000,
                        cursor: cursor,
                    },
                });

                if (!response.data.ok) {
                    throw new functions.https.HttpsError(
                        "internal",
                        `Slack API error: ${response.data.error}`
                    );
                }

                const members = response.data.members || [];
                
                const validChunk = members
                    .filter((m: SlackMember) => 
                        !m.deleted && 
                        !m.is_bot && 
                        !m.is_app_user && 
                        m.id !== "USLACKBOT" &&
                        m.profile?.email
                    )
                    .map((m: SlackMember) => ({
                        id: m.id,
                        name: m.name,
                        real_name: m.real_name,
                        email: m.profile.email,
                        image_original: m.profile.image_original || m.profile.image_512,
                    }));

                allMembers.push(...validChunk);
                
                cursor = response.data.response_metadata?.next_cursor;
                pageCount++;

            } while (cursor && pageCount < MAX_PAGES);

            return { members: allMembers };

        } catch (error) {
            console.error("Failed to fetch Slack users:", error);
             if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError("internal", "Failed to fetch Slack users.");
        }
    });

export const authWithSlack = functions
    .region("us-central1")
    .https.onCall(async (data) => {
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
        const settingsDoc = await admin.firestore().collection("settings").doc("global").get();
        const currentSemesterId = settingsDoc.data()?.currentSemesterId || null;

        let isAdmin = false;
        let pixelDelta = 0;
        const extractPixelDelta = (data: admin.firestore.DocumentData | undefined | null) => {
            const bySemester = (data?.pixelDeltaBySemester || {}) as Record<string, number>;
            const legacy = data?.pixelDelta ?? data?.pixeldelta ?? 0;
            return currentSemesterId && bySemester[currentSemesterId] !== undefined
                ? bySemester[currentSemesterId]
                : legacy;
        };

        if (userDoc.exists) {
            // Case 1: User exists with Slack ID as doc ID (Normal login)
            const userData = userDoc.data();
            isAdmin = userData?.isAdmin || false;
            pixelDelta = extractPixelDelta(userData);
            
            await userRef.update({
                firstName,
                lastName,
                email,
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            // Case 2: Check if user exists by email (Manual creation migration)
            const existingUserQuery = await admin.firestore().collection("users")
                .where("email", "==", email)
                .limit(1)
                .get();

                if (!existingUserQuery.empty) {
                    const oldUserDoc = existingUserQuery.docs[0];
                    const oldUserData = oldUserDoc.data();
                    
                    isAdmin = oldUserData.isAdmin || false;
                    pixelDelta = extractPixelDelta(oldUserData);
                    const oldPixels = oldUserData.pixels ?? 0;
                    const oldPixelCached = oldUserData.pixelCached ?? 0;
                    
                    // Migrate old data to new doc with Slack ID
                    await userRef.set({
                    ...oldUserData,
                    firstName, // Update with latest from Slack
                    lastName,
                    email,
                    slackId: slackUserId,
                    lastLogin: admin.firestore.FieldValue.serverTimestamp(),
                    // Ensure critical fields are preserved
                    isAdmin,
                    pixelDelta,
                    pixels: oldPixels,
                    pixelCached: oldPixelCached,
                });

                // Delete the old manually created document
                await oldUserDoc.ref.delete();
            } else {
                // Case 3: New user
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
            }
        }

        const customToken = await admin.auth().createCustomToken(slackUserId, {
            isAdmin: isAdmin,
            pixelDelta,
        });

        return { token: customToken };
    } catch (error: unknown) {
        console.error("Auth Error:", error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        const axiosResponse =
            typeof error === "object" && error !== null && "response" in error
                ? (error as { response?: { data?: unknown } }).response?.data
                : undefined;
        if (axiosResponse) {
            console.error("Slack API Error Response:", JSON.stringify(axiosResponse));
        }

        const message =
            error instanceof Error
                ? error.message
                : typeof error === "object" && error !== null && "message" in error
                    ? String((error as { message?: unknown }).message)
                    : "Authentication failed.";

        throw new functions.https.HttpsError("internal", message);
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
    .onWrite(async (change) => {
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
    .onWrite(async (change) => {
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
 * 1. Pixels from attended events (where user is not excused).
 * 2. Pixels from approved excused absences (attendance credit only, usually no pixels unless configured).
 * 3. Pixels from activities (multipliers).
 */
async function recalculateUserPixels(userId: string) {
    const db = admin.firestore();

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;

    const settingsDoc = await db.collection("settings").doc("global").get();
    const currentSemesterId = settingsDoc.data()?.currentSemesterId;

    if (!currentSemesterId) {
        console.log("No current semester set.");
        return;
    }

    const userData = userDoc.data() || {};
    const pixelDeltaBySemester = (userData.pixelDeltaBySemester || {}) as Record<string, number>;
    const pixelDeltaLegacy = userData.pixelDelta ?? userData.pixeldelta ?? 0;
    const pixelDelta = pixelDeltaBySemester[currentSemesterId] ?? pixelDeltaLegacy;

    let totalPixels = pixelDelta;

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
    .onWrite(async (change) => {
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

/**
 * Callable: recalculateAllUserPixels
 * Manually triggers a recalculation of pixels for ALL users.
 * Useful when changing semesters.
 */
export const recalculateAllUserPixels = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
        if (!context.auth?.token.isAdmin) {
          throw new functions.https.HttpsError("permission-denied", "Must be an admin.");
        }

        const db = admin.firestore();
        const usersSnap = await db.collection("users").get();
        
        console.log(`Recalculating pixels for ${usersSnap.size} users...`);
        
        const promises = usersSnap.docs.map(doc => recalculateUserPixels(doc.id));
        await Promise.all(promises);
        
        return { success: true, count: usersSnap.size };
    });

export const recalculateUserPixelsCallable = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
        if (!context.auth?.token.isAdmin) {
            throw new functions.https.HttpsError("permission-denied", "Must be an admin.");
        }
        const userId = (data as { userId?: string })?.userId;
        if (!userId) {
            throw new functions.https.HttpsError("invalid-argument", "Missing userId.");
        }
        await recalculateUserPixels(userId);
        return { success: true };
    });
