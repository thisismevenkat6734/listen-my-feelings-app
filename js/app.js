/* =========================================================
   LISTEN MY FEELINGS
   APP CORE
   V1 — FIREBASE / FIRESTORE
   ========================================================= */

import {
    auth,
    db
} from "../firebase/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    addDoc,
    deleteDoc,
    where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* =========================================================
   CONSTANTS
   ========================================================= */

const MAX_FEELINGS = 30;
const MAX_RESPONSE_LENGTH = 2000;

const APP_HOME = "./app.html";


/* =========================================================
   DOM
   ========================================================= */

const feedContainer =
    document.getElementById("feedContainer");

const createFeelingForm =
    document.getElementById("createFeelingForm");

const feelingText =
    document.getElementById("feelingText");

const feelingMood =
    document.getElementById("feelingMood");

const feelingTopic =
    document.getElementById("feelingTopic");

const songTitle =
    document.getElementById("songTitle");

const songUrl =
    document.getElementById("songUrl");

const publishFeeling =
    document.getElementById("publishFeeling");

const createFeelingModal =
    document.getElementById("createFeelingModal");

const profileMiniName =
    document.getElementById("profileMiniName");

const profileMiniEmail =
    document.getElementById("profileMiniEmail");

const profileMiniAvatar =
    document.getElementById("profileMiniAvatar");

const quickCreateAvatar =
    document.getElementById("quickCreateAvatar");

const moodButtons =
    document.querySelectorAll("[data-mood]");

const topicButtons =
    document.querySelectorAll("[data-topic]");


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;
let currentUserProfile = null;

let feelings = [];

let selectedMood = "all";

let loadingFeed = false;
let publishingFeeling = false;


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function getInitial(name) {

    const value =
        String(name || "")
            .trim();

    if (!value) {
        return "?";
    }

    return value
        .charAt(0)
        .toUpperCase();
}


function normalizeText(value) {

    return String(value || "")
        .trim()
        .replace(/\s+/g, " ");
}


function normalizeEmail(value) {

    return String(value || "")
        .trim()
        .toLowerCase();
}


function showToast(
    message,
    type = "success"
) {

    const toast =
        document.getElementById("toast");

    const toastMessage =
        document.getElementById("toastMessage");

    const toastIcon =
        document.getElementById("toastIcon");

    if (!toast || !toastMessage) {
        return;
    }

    toastMessage.textContent =
        message;

    if (toastIcon) {
        toastIcon.textContent =
            type === "error"
                ? "!"
                : "✓";
    }

    toast.classList.add(
        "visible"
    );

    window.clearTimeout(
        window.__lmfAppToastTimer
    );

    window.__lmfAppToastTimer =
        window.setTimeout(() => {

            toast.classList.remove(
                "visible"
            );

        }, 4000);
}


function setButtonLoading(
    button,
    loading,
    text
) {

    if (!button) {
        return;
    }

    if (loading) {

        if (!button.dataset.originalText) {

            button.dataset.originalText =
                button.textContent;
        }

        button.disabled = true;
        button.setAttribute(
            "aria-busy",
            "true"
        );

        if (text) {
            button.textContent =
                text;
        }

    } else {

        button.disabled = false;

        button.removeAttribute(
            "aria-busy"
        );

        if (button.dataset.originalText) {

            button.textContent =
                button.dataset.originalText;

            delete button.dataset.originalText;
        }
    }
}


/* =========================================================
   DATE / TIME
   ========================================================= */

function formatFeelingDate(
    timestamp
) {

    if (!timestamp) {
        return "Just now";
    }

    let date;

    try {

        if (
            typeof timestamp.toDate ===
            "function"
        ) {
            date =
                timestamp.toDate();
        } else {
            date =
                new Date(timestamp);
        }

    } catch {
        return "Recently";
    }

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "Recently";
    }

    const now =
        new Date();

    const difference =
        Math.max(
            0,
            now.getTime() -
            date.getTime()
        );

    const minutes =
        Math.floor(
            difference / 60000
        );

    if (minutes < 1) {
        return "Just now";
    }

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours =
        Math.floor(
            minutes / 60
        );

    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days =
        Math.floor(
            hours / 24
        );

    if (days < 7) {
        return `${days}d ago`;
    }

    return date.toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year:
                date.getFullYear() !==
                now.getFullYear()
                    ? "numeric"
                    : undefined
        }
    );
}


/* =========================================================
   FIREBASE ERROR
   ========================================================= */

function getFriendlyError(
    error
) {

    const code =
        error?.code || "";

    switch (code) {

        case "permission-denied":
            return "You don't have permission to perform that action.";

        case "failed-precondition":
            return "This request needs a Firestore index. We'll configure it in the database setup.";

        case "unavailable":
            return "Firebase is temporarily unavailable. Please try again.";

        case "network-request-failed":
            return "Please check your internet connection.";

        default:
            return "Something went wrong. Please try again.";
    }
}


/* =========================================================
   USER PROFILE
   ========================================================= */

async function loadCurrentUserProfile(
    user
) {

    if (!user) {
        return null;
    }

    const userRef =
        doc(
            db,
            "users",
            user.uid
        );

    const snapshot =
        await getDoc(
            userRef
        );

    if (!snapshot.exists()) {
        return null;
    }

    return snapshot.data();
}


function updateProfileUI() {

    const displayName =
        currentUserProfile?.displayName ||
        currentUser?.displayName ||
        "Member";

    const email =
        currentUser?.email ||
        "";

    const initial =
        getInitial(displayName);


    if (profileMiniName) {
        profileMiniName.textContent =
            displayName;
    }

    if (profileMiniEmail) {
        profileMiniEmail.textContent =
            normalizeEmail(email);
    }

    if (profileMiniAvatar) {
        profileMiniAvatar.textContent =
            initial;
    }

    if (quickCreateAvatar) {
        quickCreateAvatar.textContent =
            initial;
    }
}


/* =========================================================
   FEED QUERY
   ========================================================= */

async function loadFeelings() {

    if (loadingFeed) {
        return;
    }

    loadingFeed = true;

    renderFeedLoading();

    try {

        const feelingsQuery =
            query(
                collection(
                    db,
                    "feelings"
                ),
                where(
                    "visibility",
                    "==",
                    "public"
                ),
                where(
                    "status",
                    "==",
                    "active"
                ),
                orderBy(
                    "createdAt",
                    "desc"
                ),
                limit(
                    MAX_FEELINGS
                )
            );

        const snapshot =
            await getDocs(
                feelingsQuery
            );

        feelings =
            snapshot.docs.map(
                feelingDoc => ({
                    id:
                        feelingDoc.id,
                    ...feelingDoc.data()
                })
            );

        renderFeed();

    } catch (error) {

        console.error(
            "Load feelings error:",
            error
        );

        renderFeedError(
            getFriendlyError(error)
        );

    } finally {

        loadingFeed = false;
    }
}


/* =========================================================
   FEED RENDER
   ========================================================= */

function renderFeedLoading() {

    if (!feedContainer) {
        return;
    }

    feedContainer.innerHTML = `
        <div class="feed-status">
            <strong>Loading feelings...</strong>
            <span>
                Finding honest thoughts from the community.
            </span>
        </div>
    `;
}


function renderFeedError(
    message
) {

    if (!feedContainer) {
        return;
    }

    feedContainer.innerHTML = `
        <div class="feed-status">
            <strong>We couldn't load the feed.</strong>
            <span>${escapeHtml(message)}</span>
            <div style="margin-top:14px;">
                <button
                    type="button"
                    id="retryFeedButton"
                    class="primary-app-button"
                >
                    Try again
                </button>
            </div>
        </div>
    `;

    document
        .getElementById(
            "retryFeedButton"
        )
        ?.addEventListener(
            "click",
            loadFeelings
        );
}


function renderFeed() {

    if (!feedContainer) {
        return;
    }

    let visibleFeelings =
        feelings;

    if (
        selectedMood &&
        selectedMood !== "all"
    ) {

        visibleFeelings =
            feelings.filter(
                feeling =>
                    String(
                        feeling.mood || ""
                    ).toLowerCase() ===
                    selectedMood.toLowerCase()
            );
    }


    if (!visibleFeelings.length) {

        feedContainer.innerHTML = `
            <div class="feed-status">
                <strong>
                    No feelings here yet.
                </strong>

                <span>
                    Be the first person to share something genuine.
                </span>

                <div style="margin-top:14px;">
                    <button
                        type="button"
                        id="emptyCreateButton"
                        class="primary-app-button"
                    >
                        Share a feeling
                    </button>
                </div>
            </div>
        `;

        document
            .getElementById(
                "emptyCreateButton"
            )
            ?.addEventListener(
                "click",
                openComposerFromApp
            );

        return;
    }


    feedContainer.innerHTML =
        visibleFeelings
            .map(
                renderFeelingCard
            )
            .join("");


    attachFeelingActions();
}


/* =========================================================
   FEELING CARD
   ========================================================= */

function renderFeelingCard(
    feeling
) {

    const displayName =
        feeling.authorDisplayName ||
        "Anonymous";

    const initial =
        getInitial(
            displayName
        );

    const mood =
        feeling.mood ||
        "Reflective";

    const topic =
        feeling.topic ||
        "life";

    const createdAt =
        formatFeelingDate(
            feeling.createdAt
        );

    const text =
        escapeHtml(
            feeling.text || ""
        );

    const feelingId =
        escapeHtml(
            feeling.id
        );

    const songTitleValue =
        feeling.songTitle ||
        "";

    const songUrlValue =
        feeling.songUrl ||
        "";

    const hasSong =
        Boolean(
            feeling.hasSong &&
            songUrlValue
        );


    const songHtml =
        hasSong
            ? `
                <div class="song-card">

                    <div class="song-icon">
                        ♪
                    </div>

                    <div class="song-info">
                        <strong>
                            ${escapeHtml(
                                songTitleValue ||
                                "Attached song"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                feeling.songProvider ||
                                "Music"
                            )}
                        </small>
                    </div>

                    <button
                        type="button"
                        class="song-open"
                        data-action="song"
                        data-song-url="${escapeHtml(
                            songUrlValue
                        )}"
                    >
                        Open
                    </button>

                </div>
            `
            : "";


    return `
        <article
            class="feeling-card"
            data-feeling-id="${feelingId}"
        >

            <div class="feeling-header">

                <div class="feeling-author">

                    <div class="feeling-author-avatar">
                        ${escapeHtml(initial)}
                    </div>

                    <div class="feeling-author-info">

                        <strong>
                            ${escapeHtml(
                                displayName
                            )}
                        </strong>

                        <div class="feeling-meta">
                            ${escapeHtml(
                                createdAt
                            )}
                            ·
                            ${escapeHtml(
                                mood
                            )}
                        </div>

                    </div>

                </div>


                <button
                    type="button"
                    class="more-button"
                    aria-label="More options"
                    data-action="more"
                    data-feeling-id="${feelingId}"
                >
                    •••
                </button>

            </div>


            <div class="feeling-text">
                ${text}
            </div>


            <div class="feeling-tags">

                <span class="feeling-tag">
                    ${escapeHtml(
                        mood
                    )}
                </span>

                <span class="feeling-tag">
                    #${escapeHtml(
                        topic
                    )}
                </span>

            </div>


            ${songHtml}


            <div class="feeling-actions">

                <button
                    type="button"
                    class="feeling-action"
                    data-action="understand"
                    data-feeling-id="${feelingId}"
                >
                    <span class="action-icon">♡</span>
                    <span class="understand-label">
                        I Understand
                    </span>
                </button>


                <button
                    type="button"
                    class="feeling-action"
                    data-action="respond"
                    data-feeling-id="${feelingId}"
                >
                    <span class="action-icon">○</span>
                    Respond
                </button>


                <button
                    type="button"
                    class="feeling-action"
                    data-action="connect"
                    data-feeling-id="${feelingId}"
                >
                    <span class="action-icon">↗</span>
                    Connect
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   FEELING ACTIONS
   ========================================================= */

function attachFeelingActions() {

    document
        .querySelectorAll(
            "[data-action]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();

                    const action =
                        button.dataset.action;

                    const feelingId =
                        button.dataset.feelingId;


                    if (
                        action ===
                        "understand"
                    ) {

                        await toggleUnderstand(
                            feelingId,
                            button
                        );

                        return;
                    }


                    if (
                        action ===
                        "respond"
                    ) {

                        await respondToFeeling(
                            feelingId
                        );

                        return;
                    }


                    if (
                        action ===
                        "connect"
                    ) {

                        await connectToFeeling(
                            feelingId,
                            button
                        );

                        return;
                    }


                    if (
                        action ===
                        "song"
                    ) {

                        openSong(
                            button.dataset.songUrl
                        );

                        return;
                    }


                    if (
                        action ===
                        "more"
                    ) {

                        openFeelingOptions(
                            feelingId
                        );
                    }

                }
            );

        });
}


/* =========================================================
   I UNDERSTAND
   ========================================================= */

async function hasUnderstood(
    feelingId
) {

    if (!currentUser) {
        return false;
    }

    const understandRef =
        doc(
            db,
            "feelings",
            feelingId,
            "understands",
            currentUser.uid
        );

    const snapshot =
        await getDoc(
            understandRef
        );

    return snapshot.exists();
}


async function toggleUnderstand(
    feelingId,
    button
) {

    if (!currentUser) {
        showToast(
            "Please log in to use I Understand.",
            "error"
        );

        return;
    }

    if (
        button.dataset.busy ===
        "true"
    ) {
        return;
    }

    button.dataset.busy =
        "true";

    try {

        const understandRef =
            doc(
                db,
                "feelings",
                feelingId,
                "understands",
                currentUser.uid
            );

        const snapshot =
            await getDoc(
                understandRef
            );


        if (snapshot.exists()) {

            await deleteDoc(
                understandRef
            );

            button.classList.remove(
                "understood"
            );

            showToast(
                "Removed from I Understand.",
                "success"
            );

        } else {

            await setDoc(
                understandRef,
                {
                    userId:
                        currentUser.uid,

                    createdAt:
                        serverTimestamp()
                }
            );

            button.classList.add(
                "understood"
            );

            showToast(
                "Your understanding was shared.",
                "success"
            );
        }

    } catch (error) {

        console.error(
            "Understand error:",
            error
        );

        showToast(
            getFriendlyError(error),
            "error"
        );

    } finally {

        delete button.dataset.busy;
    }
}


/* =========================================================
   PRELOAD UNDERSTAND STATE
   ========================================================= */

async function updateUnderstandStates() {

    if (!currentUser) {
        return;
    }

    const buttons =
        document.querySelectorAll(
            '[data-action="understand"]'
        );

    for (
        const button of buttons
    ) {

        const feelingId =
            button.dataset.feelingId;

        try {

            const understood =
                await hasUnderstood(
                    feelingId
                );

            if (understood) {

                button.classList.add(
                    "understood"
                );
            }

        } catch {
            /*
             * A failed individual state lookup
             * should not break the entire feed.
             */
        }
    }
}


/* =========================================================
   RESPOND
   ========================================================= */

async function respondToFeeling(
    feelingId
) {

    if (!currentUser) {

        showToast(
            "Please log in to respond.",
            "error"
        );

        return;
    }


    const feeling =
        feelings.find(
            item =>
                item.id ===
                feelingId
        );

    if (!feeling) {
        return;
    }


    const response =
        window.prompt(
            "Write a meaningful response:"
        );


    if (
        response === null
    ) {
        return;
    }


    const text =
        response.trim();


    if (!text) {

        showToast(
            "Please write something before sending.",
            "error"
        );

        return;
    }


    if (
        text.length >
        MAX_RESPONSE_LENGTH
    ) {

        showToast(
            "Your response is too long.",
            "error"
        );

        return;
    }


    try {

        await addDoc(
            collection(
                db,
                "feelings",
                feelingId,
                "responses"
            ),
            {
                userId:
                    currentUser.uid,

                authorName:
                    currentUserProfile?.displayName ||
                    currentUser.displayName ||
                    "Member",

                text:
                    text,

                status:
                    "active",

                createdAt:
                    serverTimestamp()
            }
        );


        showToast(
            "Your response was shared.",
            "success"
        );

    } catch (error) {

        console.error(
            "Response error:",
            error
        );

        showToast(
            getFriendlyError(error),
            "error"
        );
    }
}


/* =========================================================
   CONNECT
   ========================================================= */

function makeConnectionId(
    userA,
    userB
) {

    return userA < userB
        ? `${userA}_${userB}`
        : `${userB}_${userA}`;
}


async function connectToFeeling(
    feelingId,
    button
) {

    if (!currentUser) {

        showToast(
            "Please log in to connect.",
            "error"
        );

        return;
    }


    const feeling =
        feelings.find(
            item =>
                item.id ===
                feelingId
        );


    if (!feeling) {
        return;
    }


    const targetUserId =
        feeling.authorId;


    if (!targetUserId) {

        showToast(
            "This feeling cannot receive a connection right now.",
            "error"
        );

        return;
    }


    if (
        targetUserId ===
        currentUser.uid
    ) {

        showToast(
            "You cannot connect with your own feeling.",
            "error"
        );

        return;
    }


    if (
        button.dataset.busy ===
        "true"
    ) {
        return;
    }


    button.dataset.busy =
        "true";


    try {

        const connectionKey =
            makeConnectionId(
                currentUser.uid,
                targetUserId
            );


        const connectionRef =
            doc(
                db,
                "connections",
                connectionKey
            );


        const existing =
            await getDoc(
                connectionRef
            );


        if (existing.exists()) {

            const data =
                existing.data();


            if (
                data.status ===
                "accepted"
            ) {

                showToast(
                    "You are already connected.",
                    "success"
                );

                return;
            }


            if (
                data.status ===
                "pending"
            ) {

                showToast(
                    "Connection request already sent.",
                    "success"
                );

                return;
            }


            if (
                data.status ===
                "ended" ||
                data.status ===
                "cancelled"
            ) {

                await setDoc(
                    connectionRef,
                    {
                        userA:
                            connectionKey.split("_")[0],

                        userB:
                            connectionKey.split("_")[1],

                        requesterId:
                            currentUser.uid,

                        status:
                            "pending",

                        createdAt:
                            serverTimestamp(),

                        updatedAt:
                            serverTimestamp()
                    }
                );

                showToast(
                    "Connection request sent.",
                    "success"
                );

                return;
            }
        }


        await setDoc(
            connectionRef,
            {
                userA:
                    currentUser.uid <
                    targetUserId
                        ? currentUser.uid
                        : targetUserId,

                userB:
                    currentUser.uid <
                    targetUserId
                        ? targetUserId
                        : currentUser.uid,

                requesterId:
                    currentUser.uid,

                status:
                    "pending",

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()
            }
        );


        button.textContent =
            "Requested";

        button.disabled =
            true;


        showToast(
            "Connection request sent.",
            "success"
        );

    } catch (error) {

        console.error(
            "Connection error:",
            error
        );

        showToast(
            getFriendlyError(error),
            "error"
        );

    } finally {

        delete button.dataset.busy;
    }
}


/* =========================================================
   SONG
   ========================================================= */

function openSong(
    url
) {

    if (!url) {
        return;
    }

    let parsed;

    try {

        parsed =
            new URL(url);

    } catch {

        showToast(
            "This song link is not valid.",
            "error"
        );

        return;
    }


    const allowedHosts = [
        "youtube.com",
        "www.youtube.com",
        "youtu.be",
        "spotify.com",
        "open.spotify.com"
    ];


    const allowed =
        allowedHosts.some(
            host =>
                parsed.hostname ===
                host ||
                parsed.hostname.endsWith(
                    `.${host}`
                )
        );


    if (!allowed) {

        showToast(
            "Only supported music links can be opened.",
            "error"
        );

        return;
    }


    window.open(
        parsed.href,
        "_blank",
        "noopener,noreferrer"
    );
}


/* =========================================================
   MORE OPTIONS
   ========================================================= */

function openFeelingOptions(
    feelingId
) {

    if (!currentUser) {
        return;
    }


    const feeling =
        feelings.find(
            item =>
                item.id ===
                feelingId
        );


    if (!feeling) {
        return;
    }


    const isOwner =
        feeling.authorId ===
        currentUser.uid;


    const action =
        window.prompt(
            isOwner
                ? "Type DELETE to delete this feeling."
                : "Type REPORT to report this feeling."
        );


    if (!action) {
        return;
    }


    const normalized =
        action
            .trim()
            .toUpperCase();


    if (
        isOwner &&
        normalized ===
        "DELETE"
    ) {

        deleteOwnFeeling(
            feelingId
        );

        return;
    }


    if (
        !isOwner &&
        normalized ===
        "REPORT"
    ) {

        reportFeeling(
            feelingId
        );

        return;
    }


    showToast(
        "No action was taken.",
        "success"
    );
}


/* =========================================================
   DELETE OWN FEELING
   ========================================================= */

async function deleteOwnFeeling(
    feelingId
) {

    const feeling =
        feelings.find(
            item =>
                item.id ===
                feelingId
        );


    if (
        !feeling ||
        feeling.authorId !==
        currentUser?.uid
    ) {
        return;
    }


    const confirmed =
        window.confirm(
            "Delete this feeling? This cannot be undone."
        );


    if (!confirmed) {
        return;
    }


    try {

        await deleteDoc(
            doc(
                db,
                "feelings",
                feelingId
            )
        );


        showToast(
            "Feeling deleted.",
            "success"
        );


        await loadFeelings();

    } catch (error) {

        console.error(
            "Delete feeling error:",
            error
        );

        showToast(
            getFriendlyError(error),
            "error"
        );
    }
}


/* =========================================================
   REPORT FEELING
   ========================================================= */

async function reportFeeling(
    feelingId
) {

    const reason =
        window.prompt(
            "Why are you reporting this feeling?"
        );


    if (reason === null) {
        return;
    }


    const cleanReason =
        reason.trim();


    if (!cleanReason) {

        showToast(
            "Please provide a report reason.",
            "error"
        );

        return;
    }


    if (
        cleanReason.length >
        1000
    ) {

        showToast(
            "Your report is too long.",
            "error"
        );

        return;
    }


    try {

        await addDoc(
            collection(
                db,
                "reports"
            ),
            {
                reporterId:
                    currentUser.uid,

                targetType:
                    "feeling",

                targetId:
                    feelingId,

                reason:
                    cleanReason,

                status:
                    "open",

                createdAt:
                    serverTimestamp()
            }
        );


        showToast(
            "Thank you. Your report was submitted.",
            "success"
        );

    } catch (error) {

        console.error(
            "Report error:",
            error
        );

        showToast(
            getFriendlyError(error),
            "error"
        );
    }
}


/* =========================================================
   CREATE FEELING
   ========================================================= */

function getSongProvider(
    url
) {

    if (!url) {
        return "";
    }

    try {

        const hostname =
            new URL(url)
                .hostname
                .toLowerCase();

        if (
            hostname.includes(
                "youtube.com"
            ) ||
            hostname.includes(
                "youtu.be"
            )
        ) {
            return "YouTube";
        }

        if (
            hostname.includes(
                "spotify.com"
            )
        ) {
            return "Spotify";
        }

        return "Music";

    } catch {
        return "Music";
    }
}


function validateSongUrl(
    value
) {

    if (!value) {
        return true;
    }

    try {

        const url =
            new URL(value);

        if (
            url.protocol !==
            "https:"
        ) {
            return false;
        }

        const host =
            url.hostname
                .toLowerCase();

        return (
            host === "youtube.com" ||
            host === "www.youtube.com" ||
            host === "youtu.be" ||
            host.endsWith(".youtube.com") ||
            host === "spotify.com" ||
            host === "open.spotify.com" ||
            host.endsWith(".spotify.com")
        );

    } catch {
        return false;
    }
}


async function publishFeelingPost(
    event
) {

    event.preventDefault();


    if (!currentUser) {

        showToast(
            "Please log in before sharing a feeling.",
            "error"
        );

        return;
    }


    if (publishingFeeling) {
        return;
    }


    const text =
        String(
            feelingText?.value ||
            ""
        ).trim();


    const mood =
        String(
            feelingMood?.value ||
            ""
        ).trim();


    const topic =
        String(
            feelingTopic?.value ||
            ""
        ).trim();


    const title =
        String(
            songTitle?.value ||
            ""
        ).trim();


    const url =
        String(
            songUrl?.value ||
            ""
        ).trim();


    if (!text) {

        showToast(
            "Please write what you are feeling.",
            "error"
        );

        feelingText?.focus();

        return;
    }


    if (
        text.length >
        2000
    ) {

        showToast(
            "Your feeling is too long.",
            "error"
        );

        return;
    }


    if (!mood) {

        showToast(
            "Please choose a mood.",
            "error"
        );

        return;
    }


    if (!topic) {

        showToast(
            "Please choose a topic.",
            "error"
        );

        return;
    }


    if (
        title &&
        title.length >
        200
    ) {

        showToast(
            "Song title is too long.",
            "error"
        );

        return;
    }


    if (
        url &&
        !validateSongUrl(url)
    ) {

        showToast(
            "Please use a valid YouTube or Spotify HTTPS link.",
            "error"
        );

        return;
    }


    publishingFeeling =
        true;


    setButtonLoading(
        publishFeeling,
        true,
        "Sharing..."
    );


    try {

        const displayName =
            currentUserProfile?.displayName ||
            currentUser.displayName ||
            "Member";


        const hasSong =
            Boolean(
                title ||
                url
            );


        await addDoc(
            collection(
                db,
                "feelings"
            ),
            {
                authorId:
                    currentUser.uid,

                authorDisplayName:
                    displayName,

                text:
                    text,

                mood:
                    mood,

                topic:
                    topic,

                visibility:
                    "public",

                status:
                    "active",

                understoodCount:
                    0,

                hasSong:
                    hasSong,

                songProvider:
                    hasSong
                        ? getSongProvider(url)
                        : "",

                songTitle:
                    title,

                songUrl:
                    url,

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()
            }
        );


        createFeelingForm?.reset();

        closeComposer();

        showToast(
            "Your feeling is now shared.",
            "success"
        );


        await loadFeelings();

    } catch (error) {

        console.error(
            "Publish feeling error:",
            error
        );

        showToast(
            getFriendlyError(error),
            "error"
        );

    } finally {

        publishingFeeling =
            false;

        setButtonLoading(
            publishFeeling,
            false
        );
    }
}


/* =========================================================
   COMPOSER CONTROL
   ========================================================= */

function openComposerFromApp() {

    createFeelingModal?.classList.add(
        "visible"
    );

    createFeelingModal?.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";

    window.setTimeout(() => {

        feelingText?.focus();

    }, 80);
}


function closeComposer() {

    createFeelingModal?.classList.remove(
        "visible"
    );

    createFeelingModal?.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow =
        "";
}


/* =========================================================
   MOOD FILTER
   ========================================================= */

function attachMoodFilters() {

    moodButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    selectedMood =
                        button.dataset.mood ||
                        "all";


                    moodButtons.forEach(
                        item => {

                            item.classList.toggle(
                                "active",
                                item === button
                            );

                        }
                    );


                    renderFeed();
                }
            );

        }
    );
}


/* =========================================================
   TOPIC FILTER
   ========================================================= */

function attachTopicFilters() {

    topicButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const topic =
                        button.dataset.topic;

                    window.location.href =
                        `discover.html?topic=${encodeURIComponent(
                            topic
                        )}`;

                }
            );

        }
    );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function attachNavigation() {

    const targets = {
        home:
            "app.html",

        discover:
            "discover.html",

        notifications:
            "notifications.html",

        messages:
            "messages.html",

        profile:
            "profile.html",

        settings:
            "settings.html"
    };


    document
        .querySelectorAll(
            "[data-nav]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const destination =
                        targets[
                            button.dataset.nav
                        ];

                    if (
                        destination &&
                        destination !==
                        APP_HOME
                    ) {

                        window.location.href =
                            destination;
                    }

                }
            );

        });


    document
        .getElementById(
            "searchButton"
        )
        ?.addEventListener(
            "click",
            () => {

                window.location.href =
                    "discover.html";
            }
        );


    document
        .getElementById(
            "notificationButton"
        )
        ?.addEventListener(
            "click",
            () => {

                window.location.href =
                    "notifications.html";
            }
        );


    document
        .getElementById(
            "profileButton"
        )
        ?.addEventListener(
            "click",
            () => {

                window.location.href =
                    "profile.html";
            }
        );
}


/* =========================================================
   AUTH STATE
   ========================================================= */

function attachAuthState() {

    onAuthStateChanged(
        auth,
        async user => {

            if (!user) {

                window.location.replace(
                    "./index.html"
                );

                return;
            }


            currentUser =
                user;


            try {

                currentUserProfile =
                    await loadCurrentUserProfile(
                        user
                    );


                if (
                    !currentUserProfile
                ) {

                    showToast(
                        "Your account profile could not be loaded.",
                        "error"
                    );

                    return;
                }


                if (
                    currentUserProfile.status !==
                    "active"
                ) {

                    showToast(
                        "Your account is currently unavailable.",
                        "error"
                    );

                    return;
                }


                updateProfileUI();

                await loadFeelings();

                await updateUnderstandStates();

            } catch (error) {

                console.error(
                    "Auth initialization error:",
                    error
                );

                showToast(
                    getFriendlyError(error),
                    "error"
                );
            }

        }
    );
}


/* =========================================================
   FORM / UI EVENTS
   ========================================================= */

function attachComposerEvents() {

    createFeelingForm?.addEventListener(
        "submit",
        publishFeelingPost
    );


    document
        .getElementById(
            "openCreateFeeling"
        )
        ?.addEventListener(
            "click",
            openComposerFromApp
        );


    document
        .getElementById(
            "mobileCreateFeeling"
        )
        ?.addEventListener(
            "click",
            openComposerFromApp
        );


    document
        .getElementById(
            "quickCreateButton"
        )
        ?.addEventListener(
            "click",
            openComposerFromApp
        );


    document
        .getElementById(
            "quickTextAction"
        )
        ?.addEventListener(
            "click",
            openComposerFromApp
        );


    document
        .getElementById(
            "quickMoodAction"
        )
        ?.addEventListener(
            "click",
            openComposerFromApp
        );


    document
        .getElementById(
            "quickSongAction"
        )
        ?.addEventListener(
            "click",
            openComposerFromApp
        );


    document
        .getElementById(
            "closeCreateFeeling"
        )
        ?.addEventListener(
            "click",
            closeComposer
        );


    document
        .getElementById(
            "cancelFeeling"
        )
        ?.addEventListener(
            "click",
            closeComposer
        );


    createFeelingModal?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                createFeelingModal
            ) {
                closeComposer();
            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                createFeelingModal?.classList.contains(
                    "visible"
                )
            ) {

                closeComposer();
            }

        }
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initializeApp() {

    attachAuthState();

    attachComposerEvents();

    attachMoodFilters();

    attachTopicFilters();

    attachNavigation();

    /*
     * Make sure the page does not remain visually
     * locked if a service worker or other optional
     * feature fails.
     */

    if (
        "serviceWorker" in navigator
    ) {

        window.addEventListener(
            "load",
            () => {

                navigator.serviceWorker
                    .register(
                        "./sw.js",
                        {
                            scope: "./"
                        }
                    )
                    .catch(() => {});

            }
        );

    }
}


/* =========================================================
   START
   ========================================================= */

initializeApp();
