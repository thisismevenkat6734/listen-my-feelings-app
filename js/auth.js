/* =========================================================
   LISTEN MY FEELINGS
   Firebase Authentication
   V1 — Email / Password
   ========================================================= */

import {
    createUserWithEmailAndPassword,
    deleteUser,
    onAuthStateChanged,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    auth,
    db
} from "../firebase/firebase-config.js";


/* =========================================================
   DOM
   ========================================================= */

const authModal = document.getElementById("authModal");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const forgotForm = document.getElementById("forgotForm");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const registerName = document.getElementById("registerName");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");
const registerAgreement = document.getElementById("registerAgreement");

const forgotEmail = document.getElementById("forgotEmail");

const loginSubmit = document.getElementById("loginSubmit");
const registerSubmit = document.getElementById("registerSubmit");
const forgotSubmit = document.getElementById("forgotSubmit");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastIcon = document.getElementById("toastIcon");


/* =========================================================
   CONSTANTS
   ========================================================= */

const APP_HOME = "./app.html";

const MIN_PASSWORD_LENGTH = 8;
const MAX_DISPLAY_NAME_LENGTH = 50;


/* =========================================================
   INTERNAL STATE
   ========================================================= */

let authOperationInProgress = false;


/* =========================================================
   TOAST
   ========================================================= */

function showAuthToast(message, type = "success") {

    if (!toast || !toastMessage) {
        return;
    }

    toastMessage.textContent = message;

    if (toastIcon) {
        toastIcon.textContent =
            type === "error" ? "!" : "✓";
    }

    toast.classList.add("visible");

    window.clearTimeout(
        window.__lmfAuthToastTimer
    );

    window.__lmfAuthToastTimer =
        window.setTimeout(() => {
            toast.classList.remove("visible");
        }, 4000);
}


/* =========================================================
   AUTH MODAL
   ========================================================= */

function closeAuthModal() {

    if (!authModal) {
        return;
    }

    authModal.classList.remove("visible");

    authModal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );
}


/* =========================================================
   BUTTON STATE
   ========================================================= */

function setButtonLoading(
    button,
    loading,
    loadingText
) {

    if (!button) {
        return;
    }

    if (loading) {

        if (!button.dataset.originalHtml) {
            button.dataset.originalHtml =
                button.innerHTML;
        }

        button.disabled = true;
        button.setAttribute(
            "aria-busy",
            "true"
        );

        const span =
            button.querySelector("span");

        if (span && loadingText) {
            span.textContent = loadingText;
        } else if (loadingText) {
            button.textContent = loadingText;
        }

    } else {

        button.disabled = false;

        button.removeAttribute(
            "aria-busy"
        );

        if (button.dataset.originalHtml) {
            button.innerHTML =
                button.dataset.originalHtml;
        }
    }
}


/* =========================================================
   INPUT HELPERS
   ========================================================= */

function normalizeEmail(value) {

    return String(value || "")
        .trim()
        .toLowerCase();
}


function normalizeDisplayName(value) {

    return String(value || "")
        .trim()
        .replace(/\s+/g, " ");
}


function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
}


function validatePassword(password) {

    if (password.length < MIN_PASSWORD_LENGTH) {
        return "Password must contain at least 8 characters.";
    }

    if (password.length > 128) {
        return "Password is too long.";
    }

    return null;
}


function validateDisplayName(name) {

    if (!name) {
        return "Please enter your display name.";
    }

    if (name.length < 2) {
        return "Display name must contain at least 2 characters.";
    }

    if (name.length > MAX_DISPLAY_NAME_LENGTH) {
        return "Display name is too long.";
    }

    return null;
}


/* =========================================================
   FIREBASE ERROR MESSAGES
   ========================================================= */

function getFirebaseErrorMessage(error) {

    const code = error?.code || "";

    switch (code) {

        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/invalid-credential":
            return "The email or password is incorrect.";

        case "auth/user-disabled":
            return "This account has been disabled.";

        case "auth/email-already-in-use":
            return "An account already exists with this email.";

        case "auth/weak-password":
            return "Please choose a stronger password.";

        case "auth/too-many-requests":
            return "Too many attempts. Please wait a little and try again.";

        case "auth/network-request-failed":
            return "Network error. Please check your internet connection.";

        case "auth/operation-not-allowed":
            return "Email/password authentication is not enabled for this Firebase project.";

        case "auth/user-not-found":
            return "No account was found with this email.";

        case "auth/requires-recent-login":
            return "Please sign in again and retry.";

        default:
            return "Something went wrong. Please try again.";
    }
}


/* =========================================================
   FIREBASE PERSISTENCE
   ========================================================= */

async function prepareAuthPersistence() {

    await setPersistence(
        auth,
        browserLocalPersistence
    );
}


/* =========================================================
   USER PROFILE
   ========================================================= */

async function createUserProfile(
    user,
    displayName
) {

    const userRef =
        doc(
            db,
            "users",
            user.uid
        );

    await setDoc(
        userRef,
        {
            uid: user.uid,
            displayName: displayName,
            role: "user",
            status: "active",
            bio: "",
            mood: "",
            createdAt: serverTimestamp()
        }
    );
}


async function getUserProfile(uid) {

    const userRef =
        doc(
            db,
            "users",
            uid
        );

    const snapshot =
        await getDoc(userRef);

    if (!snapshot.exists()) {
        return null;
    }

    return snapshot.data();
}


/* =========================================================
   REDIRECT
   ========================================================= */

function goToApp() {

    window.location.assign(
        APP_HOME
    );
}


/* =========================================================
   LOGIN
   ========================================================= */

async function handleLogin() {

    if (authOperationInProgress) {
        return;
    }

    const email =
        normalizeEmail(
            loginEmail?.value
        );

    const password =
        String(
            loginPassword?.value || ""
        );

    if (!email || !isValidEmail(email)) {

        showAuthToast(
            "Please enter a valid email address.",
            "error"
        );

        loginEmail?.focus();

        return;
    }

    if (!password) {

        showAuthToast(
            "Please enter your password.",
            "error"
        );

        loginPassword?.focus();

        return;
    }

    authOperationInProgress = true;

    setButtonLoading(
        loginSubmit,
        true,
        "Signing in..."
    );

    try {

        await prepareAuthPersistence();

        const credential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        const profile =
            await getUserProfile(
                credential.user.uid
            );

        if (!profile) {

            await signOut(auth);

            throw new Error(
                "PROFILE_NOT_FOUND"
            );
        }

        if (profile.status !== "active") {

            await signOut(auth);

            throw new Error(
                "ACCOUNT_NOT_ACTIVE"
            );
        }

        showAuthToast(
            "Welcome back.",
            "success"
        );

        window.setTimeout(
            goToApp,
            500
        );

    } catch (error) {

        if (error.message === "PROFILE_NOT_FOUND") {

            showAuthToast(
                "Your account profile could not be found. Please contact support.",
                "error"
            );

        } else if (
            error.message === "ACCOUNT_NOT_ACTIVE"
        ) {

            showAuthToast(
                "Your account is currently unavailable.",
                "error"
            );

        } else {

            showAuthToast(
                getFirebaseErrorMessage(error),
                "error"
            );
        }

    } finally {

        authOperationInProgress = false;

        setButtonLoading(
            loginSubmit,
            false
        );
    }
}


/* =========================================================
   REGISTER
   ========================================================= */

async function handleRegister() {

    if (authOperationInProgress) {
        return;
    }

    const displayName =
        normalizeDisplayName(
            registerName?.value
        );

    const email =
        normalizeEmail(
            registerEmail?.value
        );

    const password =
        String(
            registerPassword?.value || ""
        );

    const agreementAccepted =
        Boolean(
            registerAgreement?.checked
        );


    const nameError =
        validateDisplayName(
            displayName
        );

    if (nameError) {

        showAuthToast(
            nameError,
            "error"
        );

        registerName?.focus();

        return;
    }


    if (!email || !isValidEmail(email)) {

        showAuthToast(
            "Please enter a valid email address.",
            "error"
        );

        registerEmail?.focus();

        return;
    }


    const passwordError =
        validatePassword(
            password
        );

    if (passwordError) {

        showAuthToast(
            passwordError,
            "error"
        );

        registerPassword?.focus();

        return;
    }


    if (!agreementAccepted) {

        showAuthToast(
            "Please agree to the Terms and Privacy Policy.",
            "error"
        );

        registerAgreement?.focus();

        return;
    }


    authOperationInProgress = true;

    setButtonLoading(
        registerSubmit,
        true,
        "Creating..."
    );

    let createdUser = null;

    try {

        await prepareAuthPersistence();

        const credential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        createdUser =
            credential.user;


        await updateProfile(
            createdUser,
            {
                displayName: displayName
            }
        );


        await createUserProfile(
            createdUser,
            displayName
        );


        showAuthToast(
            "Your account has been created.",
            "success"
        );


        window.setTimeout(
            goToApp,
            700
        );

    } catch (error) {

        /*
         * If Firebase Auth account was created but
         * Firestore profile creation failed, attempt
         * to remove the incomplete Auth account.
         */
        if (
            createdUser &&
            error?.code !== "auth/email-already-in-use"
        ) {

            try {
                await deleteUser(
                    createdUser
                );
            } catch {
                /*
                 * Do not expose cleanup details
                 * to the user.
                 */
            }
        }

        showAuthToast(
            getFirebaseErrorMessage(error),
            "error"
        );

    } finally {

        authOperationInProgress = false;

        setButtonLoading(
            registerSubmit,
            false
        );
    }
}


/* =========================================================
   PASSWORD RESET
   ========================================================= */

async function handlePasswordReset() {

    if (authOperationInProgress) {
        return;
    }

    const email =
        normalizeEmail(
            forgotEmail?.value
        );

    if (!email || !isValidEmail(email)) {

        showAuthToast(
            "Please enter a valid email address.",
            "error"
        );

        forgotEmail?.focus();

        return;
    }

    authOperationInProgress = true;

    setButtonLoading(
        forgotSubmit,
        true,
        "Sending..."
    );

    try {

        await sendPasswordResetEmail(
            auth,
            email
        );

        /*
         * Do not reveal whether an account exists.
         * This avoids unnecessary account enumeration.
         */
        showAuthToast(
            "If an account exists for this email, a password reset link has been sent.",
            "success"
        );

        if (forgotEmail) {
            forgotEmail.value = "";
        }

    } catch (error) {

        if (
            error?.code === "auth/invalid-email"
        ) {

            showAuthToast(
                "Please enter a valid email address.",
                "error"
            );

        } else if (
            error?.code === "auth/too-many-requests"
        ) {

            showAuthToast(
                "Too many requests. Please wait and try again.",
                "error"
            );

        } else {

            showAuthToast(
                "We couldn't send the reset email right now. Please try again.",
                "error"
            );
        }

    } finally {

        authOperationInProgress = false;

        setButtonLoading(
            forgotSubmit,
            false
        );
    }
}


/* =========================================================
   FORM EVENTS
   ========================================================= */

/*
 * Capture phase is intentional.
 *
 * The current landing page already has temporary UI-only
 * submit handlers. This capture listener takes control of
 * authentication without requiring us to duplicate or merge
 * form markup.
 */

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();
            event.stopImmediatePropagation();

            handleLogin();

        },
        true
    );
}


if (registerForm) {

    registerForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();
            event.stopImmediatePropagation();

            handleRegister();

        },
        true
    );
}


if (forgotForm) {

    forgotForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();
            event.stopImmediatePropagation();

            handlePasswordReset();

        },
        true
    );
}


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(
    auth,
    user => {

        window.__LMF_CURRENT_USER__ =
            user || null;

        window.dispatchEvent(
            new CustomEvent(
                "lmf-auth-state-changed",
                {
                    detail: {
                        user: user || null
                    }
                }
            )
        );
    }
);


/* =========================================================
   PUBLIC AUTH API
   ========================================================= */

window.LMF_AUTH = {
    getCurrentUser() {
        return auth.currentUser;
    },

    async signOut() {
        await signOut(auth);
    },

    async getCurrentUserProfile() {

        const user =
            auth.currentUser;

        if (!user) {
            return null;
        }

        return getUserProfile(
            user.uid
        );
    }
};


/* =========================================================
   INITIALIZATION
   ========================================================= */

prepareAuthPersistence()
    .catch(() => {
        /*
         * Persistence failure should not prevent
         * Firebase Auth from initializing.
         */
    });
