// firebase-init.js

// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import UI utility functions
import { showLoading, hideLoading, showMessage, showLoginScreen, showMainAppScreen } from './ui-utils.js';
// Import app content initialization function
import { initializeAppContent } from './app.js'; // Import initializeAppContent

// Global Firebase variables (will be initialized later)
export let app;
export let auth;
export let db;
export let userId = null;
export let isAuthReady = false; // Flag to indicate if auth state has been determined

// The initialAuthToken is only provided by the Canvas environment.
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // appId is still provided by Canvas

/**
 * Initializes Firebase app and services.
 * Sets up authentication state listener.
 */
export async function initializeFirebase() {
    // Ensure the DOM is fully loaded before trying to access window.firebaseConfig
    // This is crucial because window.firebaseConfig is set by a script tag in index.html
    // which might execute after this module script if not handled carefully.
    document.addEventListener('DOMContentLoaded', async () => {
        // Determine firebaseConfig based on environment: window.firebaseConfig (for deployed app)
        // or __firebase_config (for Canvas preview).
        const firebaseConfig = window.firebaseConfig || (typeof __firebase_config !== 'undefined' && __firebase_config !== '' ? JSON.parse(__firebase_config) : null);

        try {
            // Explicitly check for apiKey before initializing Firebase app
            if (!firebaseConfig || !firebaseConfig.apiKey) {
                const errorMessage = "Firebase initialization failed: Missing API Key in Firebase configuration. Please ensure your Firebase project is correctly set up and its configuration is provided in index.html or via Canvas globals.";
                console.error(errorMessage);
                showMessage('error', errorMessage);
                isAuthReady = true; // Still set to true to allow UI to proceed, even if failed
                showLoginScreen(); // Ensure login screen is shown even on error
                setupAuthUIListeners(); // Setup listeners even on error to allow manual login attempts
                return; // Stop initialization if API key is missing
            }

            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);

            // Listen for auth state changes
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    userId = user.uid;
                    isAuthReady = true;
                    console.log("Firebase Auth State Changed: User is signed in.", userId);
                    showMainAppScreen(user.uid); // Show main app screen
                    initializeAppContent(); // Initialize app sections and their listeners
                } else {
                    userId = null;
                    isAuthReady = true;
                    console.log("Firebase Auth State Changed: No user is signed in.");
                    showLoginScreen(); // Show login screen
                }
                // Call setupAuthUIListeners here, after the appropriate screen is visible
                // This ensures the DOM elements are available.
                setupAuthUIListeners();
            });

            // Attempt to sign in with custom token if available (Canvas environment)
            // Note: initialAuthToken is only available in Canvas, not in App Hosting
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("Signed in with custom token (Canvas).");
            } else {
                // If no custom token, sign in anonymously for initial access
                // This is the path for App Hosting deployments if no user is logged in
                await signInAnonymously(auth);
                console.log("Signed in anonymously (App Hosting or no Canvas token).");
            }

        } catch (error) {
            console.error("Error initializing Firebase or signing in:", error);
            showMessage('error', `Firebase initialization failed: ${error.message}. Please ensure your Firebase project configuration is correctly embedded in index.html or provided via Canvas globals.`);
            isAuthReady = true; // Still set to true to allow UI to proceed, even if failed
            showLoginScreen(); // Ensure login screen is shown even on error
            setupAuthUIListeners(); // Setup listeners even on error to allow manual login attempts
        }
    }); // End of DOMContentLoaded listener
}

// --- Authentication Functions ---

/**
 * Handles user sign-up with email and password.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 */
export async function signUp(email, password) {
    showLoading();
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showMessage('success', 'Account created successfully! You are now signed in.');
    } catch (error) {
        console.error("Error signing up:", error);
        showMessage('error', `Sign up failed: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Handles user sign-in with email and password.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 */
export async function signIn(email, password) {
    showLoading();
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage('success', 'Signed in successfully!');
    } catch (error) {
        console.error("Error signing in:", error);
        showMessage('error', `Sign in failed: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Handles Google Sign-In.
 */
export async function signInWithGoogle() {
    showLoading();
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        showMessage('success', 'Signed in with Google successfully!');
    }  catch (error) {
        console.error("Error signing in with Google:", error);
        showMessage('error', `Google sign-in failed: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Handles user sign-out.
 */
export async function userSignOut() {
    showLoading();
    try {
        await signOut(auth);
        showMessage('info', 'Signed out successfully.');
    } catch (error) {
        console.error("Error signing out:", error);
        showMessage('error', `Sign out failed: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Sets up event listeners for the authentication UI elements.
 * This function should be called by app.js once the DOM is ready and Firebase is initialized.
 * UI elements are now fetched within this function to ensure they exist.
 */
export function setupAuthUIListeners() {
    const signupButton = document.getElementById('signup-button');
    const signinButton = document.getElementById('signin-button');
    const googleSigninButton = document.getElementById('google-signin-button');
    const signoutButton = document.getElementById('signout-button');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    if (signupButton) {
        signupButton.addEventListener('click', () => signUp(emailInput.value, passwordInput.value));
    }
    if (signinButton) {
        signinButton.addEventListener('click', () => signIn(emailInput.value, passwordInput.value));
    }
    if (googleSigninButton) {
        googleSigninButton.addEventListener('click', signInWithGoogle);
    }
    // Sign-out button is on the app-header, which is hidden initially.
    // It's checked and added here, but will only be active once appHeader is visible.
    if (signoutButton) {
        signoutButton.addEventListener('click', userSignOut);
    }
}
