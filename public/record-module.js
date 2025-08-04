// record-module.js

// Import Firebase variables and functions
import { db, userId, isAuthReady, appId } from './firebase-init.js';
import { showLoading, hideLoading, showMessage } from './ui-utils.js';
import { serverTimestamp, collection, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Internal state variables for recording
let speechRecognition; // Web Speech API SpeechRecognition object
let currentTranscription = ''; // Accumulates transcription across interim results
let isRecording = false; // Flag to track recording state
let currentDraftId = null; // To track the ID of the draft dream being edited in drafts tab (from record)

// --- Dream Suggestions List ---
const dreamSuggestions = [
    "I will give special attention to the nature of time and space.",
    "I may dream of myself in dependent positions. I SUGGEST THAT MY SUBCONSCIOUS MAINTAINS THE ORGANIC INTEGRITY OF MY PHYSICAL ORGANISM.",
    "Constructive suggestions are given free reign, and only those will be reacted to.",
    "Suggestions are those that are in harmony with all levels of the personality structure.",
    "I suggest to wake up the moment my conscious Self finishes with the dream and record it.",
    "I remember my dreams from the more deeper levels of my subconsciousness.",
    "I ask my subconsciousness to recall my dreams.",
    "I will (wake up) after each of my first 5 dreams (and) record each one immediately.",
    "As I fall asleep, I awaken into another kind of wakefulness; Imagine I am awakening the 'next morning'.",
    "I am free of negative influences."
];

// --- Firebase Operations for Draft Dreams (from recording) ---
// These functions are specific to saving drafts from the recording process.
// They are kept here for now but might be moved to a more general 'dreams-data-service' later.
async function saveDraftDream(dreamText, dreamTitle = '') {
    if (!userId || !isAuthReady) {
        showMessage('error', 'Please sign in to save dreams.');
        return null;
    }
    showLoading();
    try {
        const newDraftRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/draft_dreams`), {
            dreamText: dreamText,
            dreamTitle: dreamTitle,
            timestamp: serverTimestamp(),
            isPreAnalyzed: false
        });
        showMessage('success', 'Dream draft saved!');
        return newDraftRef.id;
    } catch (error) {
        console.error("Error saving draft dream:", error);
        showMessage('error', `Failed to save dream draft: ${error.message}`);
        return null;
    } finally {
        hideLoading();
    }
}

/**
 * Initializes event listeners for the Record module.
 * This function should be called once the DOM is loaded and Firebase is ready.
 * UI elements are now fetched within this function to ensure they exist.
 */
export function initializeRecordModule() {
    const startNightRecordingButton = document.getElementById('start-night-recording-button');
    const stopNightRecordingButton = document.getElementById('stop-night-recording-button');
    const audioStatus = document.getElementById('audio-status');
    const dreamInputRecord = document.getElementById('dream-input-record');
    const generateSuggestionButton = document.getElementById('generate-suggestion-button');

    // Web Speech API for audio transcription (Live Microphone Input)
    if (startNightRecordingButton) {
        startNightRecordingButton.addEventListener('click', async () => {
            console.log("Start button clicked. isRecording:", isRecording);
            if (isRecording) {
                console.log("Already recording. Ignoring start click.");
                return;
            }

            if (!currentTranscription) {
                if (dreamInputRecord) dreamInputRecord.value = '';
                currentTranscription = '';
                currentDraftId = null;
                console.log("Starting a fresh recording session.");
            } else {
                console.log("Resuming recording session. Current transcription length:", currentTranscription.length);
            }

            if (dreamInputRecord) dreamInputRecord.disabled = true;
            if (startNightRecordingButton) startNightRecordingButton.disabled = true;
            if (stopNightRecordingButton) stopNightRecordingButton.disabled = false;
            if (audioStatus) audioStatus.textContent = 'Listening for your dream... Speak clearly.';
            isRecording = true;

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                showMessage('error', 'Your browser does not support Web Speech API for transcription. Please type your dream.');
                console.error('Web Speech API not supported.');
                if (dreamInputRecord) dreamInputRecord.disabled = false;
                if (startNightRecordingButton) startNightRecordingButton.disabled = false;
                if (stopNightRecordingButton) stopNightRecordingButton.disabled = true;
                isRecording = false;
                return;
            }

            if (speechRecognition) {
                console.log("Stopping existing speech recognition instance before starting new one.");
                speechRecognition.stop();
                speechRecognition = null;
            }

            speechRecognition = new SpeechRecognition();
            speechRecognition.continuous = true;
            speechRecognition.interimResults = true;
            speechRecognition.lang = 'en-US';

            speechRecognition.onstart = () => {
                console.log('Speech recognition started.');
                if (audioStatus) audioStatus.textContent = 'Listening...';
            };

            speechRecognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscriptForThisEvent = '';

                console.log("SpeechRecognition.onresult event received:", event);
                console.log("event.resultIndex:", event.resultIndex);
                console.log("event.results.length:", event.results.length);

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i];
                    console.log(`  Result ${i}: isFinal=${result.isFinal}, transcript="${result[0].transcript}"`);
                    if (result.isFinal) {
                        finalTranscriptForThisEvent += result[0].transcript;
                    } else {
                        interimTranscript += result[0].transcript;
                    }
                }

                currentTranscription += finalTranscriptForThisEvent;
                if (dreamInputRecord) dreamInputRecord.value = currentTranscription + interimTranscript;
                if (audioStatus) audioStatus.textContent = `Listening: "${dreamInputRecord.value.substring(0, Math.min(dreamInputRecord.value.length, 50))}"`;
                console.log("Current accumulated transcription (currentTranscription):", currentTranscription);
                console.log("Current displayed transcription (dreamInputRecord.value):", dreamInputRecord.value);
            };

            speechRecognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                let errorMessage = `Speech recognition error: ${event.error}. `;
                if (event.error === 'network') {
                    errorMessage += 'Please check your internet connection and try again. If the issue persists, you can type your dream manually.';
                } else if (event.error === 'not-allowed') {
                    errorMessage += 'Microphone access denied. Please allow microphone access in your browser settings.';
                } else if (event.error === 'no-speech') {
                    errorMessage += 'No speech detected. Please try again, speak clearly, or type your dream.';
                } else {
                    errorMessage += 'Please try again or type your dream.';
                }
                showMessage('error', errorMessage);
                if (audioStatus) audioStatus.textContent = 'Speech recognition failed.';
                if (dreamInputRecord) dreamInputRecord.disabled = false;
                if (startNightRecordingButton) startNightRecordingButton.disabled = false;
                if (stopNightRecordingButton) stopNightRecordingButton.disabled = true;
            };

            speechRecognition.onend = () => {
                console.log('Speech recognition ended. isRecording (at onend start):', isRecording);
                if (isRecording) {
                    console.log("Recognition ended but still recording. Attempting restart...");
                    if (audioStatus) audioStatus.textContent = 'Listening (restarting)...';
                    setTimeout(() => {
                        console.log("Restart timeout triggered. isRecording (before restart attempt):", isRecording);
                        if (isRecording) {
                            if (speechRecognition) {
                                speechRecognition.stop();
                                speechRecognition = null;
                            }
                            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                            if (SpeechRecognition) {
                                speechRecognition = new SpeechRecognition();
                                speechRecognition.continuous = true;
                                speechRecognition.interimResults = true;
                                speechRecognition.lang = 'en-US';
                                speechRecognition.onstart = () => { console.log('Speech recognition restarted (onstart).'); if (audioStatus) audioStatus.textContent = 'Listening...'; };
                                speechRecognition.onresult = (event) => {
                                    let interimTranscript = '';
                                    let finalTranscriptForThisEvent = '';
                                    console.log("SpeechRecognition.onresult (restarted) event received:", event);
                                    console.log("event.resultIndex:", event.resultIndex);
                                    console.log("event.results.length:", event.results.length);
                                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                                        const result = event.results[i];
                                        console.log(`  Result ${i}: isFinal=${result.isFinal}, transcript="${result[0].transcript}"`);
                                        if (result.isFinal) {
                                            finalTranscriptForThisEvent += result[0].transcript;
                                        } else {
                                            interimTranscript += result[0].transcript;
                                        }
                                    }
                                    currentTranscription += finalTranscriptForThisEvent;
                                    if (dreamInputRecord) dreamInputRecord.value = currentTranscription + interimTranscript;
                                    if (audioStatus) audioStatus.textContent = `Listening: "${dreamInputRecord.value.substring(0, Math.min(dreamInputRecord.value.length, 50))}"`;
                                    console.log("Current accumulated transcription (currentTranscription):", currentTranscription);
                                    console.log("Current displayed transcription (dreamInputRecord.value):", dreamInputRecord.value);
                                };
                                speechRecognition.onerror = (event) => {
                                    console.error('Speech recognition error (restarted):', event.error);
                                    showMessage('error', `Speech recognition error (restarted): ${event.error}. Please try again.`);
                                    if (audioStatus) audioStatus.textContent = 'Speech recognition failed.';
                                };
                                speechRecognition.onend = () => {
                                    console.log('Speech recognition ended (restarted onend). isRecording:', isRecording);
                                    if (isRecording) {
                                        console.log("Recognition ended but still recording. Attempting restart (from nested onend)...");
                                        if (audioStatus) audioStatus.textContent = 'Listening (restarting)...';
                                        setTimeout(() => {
                                            if (isRecording) {
                                                speechRecognition.start();
                                            } else {
                                                console.log("Stopped during nested restart delay, not restarting.");
                                            }
                                        }, 250);
                                    } else {
                                        console.log("Recognition ended because user pressed stop (from nested onend).");
                                        if (audioStatus) audioStatus.textContent = 'Recording stopped and saved to Drafts.';
                                        if (dreamInputRecord) dreamInputRecord.disabled = false;
                                        if (startNightRecordingButton) startNightRecordingButton.disabled = false;
                                        if (stopNightRecordingButton) stopNightRecordingButton.disabled = true;
                                    }
                                };
                                speechRecognition.start();
                            } else {
                                console.error('Web Speech API not supported after restart attempt.');
                                showMessage('error', 'Your browser does not support Web Speech API for transcription. Please type your dream.');
                                if (audioStatus) audioStatus.textContent = 'Speech recognition failed.';
                                if (dreamInputRecord) dreamInputRecord.disabled = false;
                                if (startNightRecordingButton) startNightRecordingButton.disabled = false;
                                if (stopNightRecordingButton) stopNightRecordingButton.disabled = true;
                            }
                        } else {
                            console.log("Stopped during restart delay, not restarting.");
                        }
                    }, 250);
                } else {
                    console.log("Recognition ended because user pressed stop (main onend).");
                    if (audioStatus) audioStatus.textContent = 'Recording stopped and saved to Drafts.';
                    if (dreamInputRecord) dreamInputRecord.disabled = false;
                    if (startNightRecordingButton) startNightRecordingButton.disabled = false;
                    if (stopNightRecordingButton) stopNightRecordingButton.disabled = true;
                }
            };

            speechRecognition.start();
        });
    }

    if (stopNightRecordingButton) {
        stopNightRecordingButton.addEventListener('click', async () => {
            console.log("Stop button clicked. isRecording (before setting to false):", isRecording);
            isRecording = false;
            if (speechRecognition) {
                console.log("Stopping speech recognition instance.");
                speechRecognition.stop();
            }

            const transcribedText = dreamInputRecord ? dreamInputRecord.value.trim() : '';
            if (transcribedText) {
                console.log("Saving transcribed text to draft. Length:", transcribedText.length);
                const newDraftId = await saveDraftDream(transcribedText);
                if (newDraftId) {
                    currentDraftId = newDraftId; // Keep track of the last saved draft from recording
                    if (audioStatus) audioStatus.textContent = 'Recording stopped. Transcription saved to Drafts.';
                } else {
                    if (audioStatus) audioStatus.textContent = 'Recording stopped. Failed to save transcription to Drafts.';
                }
            } else {
                if (audioStatus) audioStatus.textContent = 'Recording stopped. No speech detected.';
                console.log("No speech detected to save.");
            }
            currentTranscription = '';
            if (dreamInputRecord) dreamInputRecord.value = '';

            if (dreamInputRecord) dreamInputRecord.disabled = false;
            if (startNightRecordingButton) startNightRecordingButton.disabled = false;
            if (stopNightRecordingButton) stopNightRecordingButton.disabled = true;
        });
    }

    // Event listener for Generate Random Suggestion button
    if (generateSuggestionButton) {
        generateSuggestionButton.addEventListener('click', () => {
            const randomIndex = Math.floor(Math.random() * dreamSuggestions.length);
            const suggestion = dreamSuggestions[randomIndex];
            showMessage('info', suggestion);
        });
    }
}
