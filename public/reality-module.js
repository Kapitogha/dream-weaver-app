// reality-module.js

// Import Firebase variables and functions
import { db, userId, isAuthReady, appId } from './firebase-init.js';
import { showLoading, hideLoading, showMessage, displayMessage } from './ui-utils.js';
import {
    serverTimestamp, collection, addDoc, doc, updateDoc, query, where, orderBy, limit, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Internal state variables for Reality module
let currentConversationId = null; // To track the ID of the active chat conversation

// --- Firebase Operations for Daily Events ---

/**
 * Saves a new daily event to Firestore.
 * @param {string} eventText - The text content of the daily event.
 */
export async function saveDailyEvent(eventText) {
    if (!userId || !isAuthReady) {
        showMessage('error', 'Please sign in to log daily events.');
        return;
    }
    showLoading();
    try {
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/daily_events`), {
            eventText: eventText,
            timestamp: serverTimestamp()
        });
        showMessage('success', 'Daily event logged!');
        const dailyEventInput = document.getElementById('daily-event-input');
        if (dailyEventInput) dailyEventInput.value = ''; // Clear input after saving
    } catch (error) {
        console.error("Error saving daily event:", error);
        showMessage('error', `Failed to log daily event: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Loads and displays the most recent daily events from Firestore.
 */
export async function loadDailyEvents() {
    const dailyEventsList = document.getElementById('daily-events-list');
    if (!userId || !isAuthReady) {
        if (dailyEventsList) dailyEventsList.innerHTML = '<p class="text-gray-500">Please sign in to see your daily events.</p>';
        return;
    }

    if (dailyEventsList) dailyEventsList.innerHTML = '<p class="text-gray-500">Loading daily events...</p>';
    showLoading();

    const q = query(
        collection(db, `artifacts/${appId}/users/${userId}/daily_events`),
        orderBy("timestamp", "desc"),
        limit(10) // Limit to 10 most recent events
    );

    onSnapshot(q, (snapshot) => {
        hideLoading();
        if (dailyEventsList) dailyEventsList.innerHTML = ''; // Clear to prevent duplicates on updates
        if (snapshot.empty) {
            if (dailyEventsList) dailyEventsList.innerHTML = '<p class="text-gray-500">No daily events logged yet.</p>';
        }
        snapshot.forEach((docEntry) => {
            const eventData = docEntry.data();
            const eventDate = eventData.timestamp && eventData.timestamp.toDate ?
                             new Date(eventData.timestamp.toDate()).toLocaleString() :
                             'N/A';

            const eventItem = document.createElement('div');
            eventItem.classList.add('p-3', 'bg-gray-50', 'rounded-lg', 'border', 'border-gray-200', 'text-gray-700', 'text-sm');
            eventItem.innerHTML = `
                <p class="font-semibold">${eventDate}</p>
                <p>${eventData.eventText}</p>
            `;
            if (dailyEventsList) dailyEventsList.appendChild(eventItem);
        });
    }, (error) => {
        hideLoading();
        console.error("Error loading daily events:", error);
        showMessage('error', `Failed to load daily events: ${error.message}`);
    });
}

/**
 * Archives the current chat conversation.
 */
export async function archiveCurrentChat() {
    const chatMessagesDiv = document.getElementById('chat-messages');

    if (!userId || !isAuthReady || !currentConversationId) {
        showMessage('error', 'No active conversation to archive.');
        return;
    }
    showLoading();
    try {
        const conversationRef = doc(db, `artifacts/${appId}/users/${userId}/conversations`, currentConversationId);
        await updateDoc(conversationRef, {
            isArchived: true
        });
        showMessage('success', 'Conversation archived successfully!');
        currentConversationId = null; // Clear current conversation ID
        if (chatMessagesDiv) chatMessagesDiv.innerHTML = ''; // Clear chat display
        startNewConversation(); // Start a new blank conversation
    } catch (error) {
        console.error("Error archiving conversation:", error);
        showMessage('error', `Failed to archive conversation: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Saves a chat message to the current conversation in Firestore.
 * @param {string} text - The content of the message.
 * @param {'user'|'gemini'|'model'} role - The role of the sender ('user' or 'gemini'/'model').
 */
async function saveChatMessage(text, role) {
    if (!userId || !isAuthReady || !currentConversationId) {
        console.warn("Not authenticated or no active conversation to save chat message.");
        return;
    }
    try {
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/conversations/${currentConversationId}/messages`), {
            text: text,
            role: role,
            timestamp: serverTimestamp()
        });
        console.log("Chat message saved:", text);
    } catch (error) {
        console.error("Error saving chat message:", error);
        showMessage('error', `Failed to save chat message: ${error.message}`);
    }
}

/**
 * Starts a new chat conversation or loads the most recent unarchived one.
 */
export async function startNewConversation() {
    const chatMessagesDiv = document.getElementById('chat-messages');

    if (!userId || !isAuthReady) {
        console.warn("User not authenticated or auth not ready for chat.");
        return;
    }

    if (chatMessagesDiv) chatMessagesDiv.innerHTML = '<p class="text-gray-500">Loading chat history...</p>';
    showLoading();

    try {
        // Query for unarchived conversations
        const q = query(
            collection(db, `artifacts/${appId}/users/${userId}/conversations`),
            where("isArchived", "==", false)
        );
        const snapshot = await getDocs(q);

        let conversations = [];
        snapshot.forEach(doc => {
            conversations.push({ id: doc.id, ...doc.data() });
        });

        // Sort by timestamp to get the most recent unarchived conversation
        conversations.sort((a, b) => {
            const timestampA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const timestampB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return timestampB - timestampA;
        });

        if (conversations.length > 0) {
            currentConversationId = conversations[0].id;
            console.log("Loaded existing conversation:", currentConversationId);
        } else {
            // If no unarchived conversations, create a new one
            const newConversationRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/conversations`), {
                timestamp: serverTimestamp(),
                isArchived: false
            });
            currentConversationId = newConversationRef.id;
            console.log("Created new conversation:", currentConversationId);
        }

        // Listen for real-time updates to messages in the current conversation
        const messagesQuery = query(
            collection(db, `artifacts/${appId}/users/${userId}/conversations/${currentConversationId}/messages`),
            orderBy("timestamp", "asc")
        );

        onSnapshot(messagesQuery, (messagesSnapshot) => {
            hideLoading();
            if (chatMessagesDiv) chatMessagesDiv.innerHTML = ''; // Clear to prevent duplicates on updates
            if (messagesSnapshot.empty) {
                if (chatMessagesDiv) chatMessagesDiv.innerHTML = '<p class="text-gray-500">Start a new conversation!</p>';
            }
            messagesSnapshot.forEach(msgDoc => {
                const msgData = msgDoc.data();
                displayMessage(msgData.text, msgData.role);
            });
            if (chatMessagesDiv) chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to bottom
        }, (error) => {
            hideLoading();
            console.error("Error loading chat messages:", error);
            showMessage('error', `Failed to load chat messages: ${error.message}`);
            if (chatMessagesDiv) chatMessagesDiv.innerHTML = '<p class="text-red-500">Error initializing chat.</p>';
        });

    } catch (error) {
        hideLoading();
        console.error("Error starting/loading conversation:", error);
        showMessage('error', `Failed to start/load conversation: ${error.message}`);
        if (chatMessagesDiv) chatMessagesDiv.innerHTML = '<p class="text-red-500">Error initializing chat.</p>';
    }
}

/**
 * Sends a message to the Gemini API for text or image generation.
 * @param {string} prompt - The user's input prompt.
 * @param {boolean} isImageRequest - True if the request is for image generation.
 */
async function sendMessageToGemini(prompt, isImageRequest = false) {
    const loadingChatResponse = document.getElementById('loading-chat-response');
    const sendChatButton = document.getElementById('send-chat-button');
    const chatInput = document.getElementById('chat-input');

    if (!userId || !isAuthReady) {
        showMessage('error', 'Please sign in to use the chat.');
        return;
    }

    if (loadingChatResponse) loadingChatResponse.classList.remove('hidden');
    if (sendChatButton) sendChatButton.disabled = true;
    if (chatInput) chatInput.disabled = true;

    try {
        if (isImageRequest) {
            const payload = { instances: { prompt: prompt }, parameters: { "sampleCount": 1 } };
            const apiKey = ""; // Canvas will provide this
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
                const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
                displayMessage("Here is your image:", 'gemini', imageUrl);
                await saveChatMessage("Generated an image. Note: Images cannot be archived due to storage limitations.", 'gemini');
            } else {
                displayMessage("Sorry, I couldn't generate an image for that request.", 'gemini');
                await saveChatMessage("Failed to generate image.", 'gemini');
            }
        } else {
            // Fetch recent chat history for context (last 5 messages)
            let chatHistory = [];
            const messagesRef = collection(db, `artifacts/${appId}/users/${userId}/conversations/${currentConversationId}/messages`);
            const q = query(messagesRef, orderBy("timestamp"), limit(5)); // Limit context to last 5 messages
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                const data = doc.data();
                // Ensure roles are 'user' or 'model' for Gemini API
                chatHistory.push({ role: data.role === 'user' ? 'user' : 'model', parts: [{ text: data.text }] });
            });

            // Add the current user prompt
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });

            const payload = { contents: chatHistory };
            const apiKey = ""; // Canvas will provide this
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                displayMessage(text, 'gemini');
                await saveChatMessage(text, 'gemini');
            } else {
                displayMessage("Sorry, I couldn't get a response. Please try again.", 'gemini');
                await saveChatMessage("No response from Gemini API.", 'gemini');
            }
        }
    } catch (error) {
        console.error("Gemini API error:", error);
        displayMessage("An error occurred while communicating with the AI. Please try again.", 'gemini');
        await saveChatMessage(`Error: ${error.message}`, 'gemini');
    } finally {
        if (loadingChatResponse) loadingChatResponse.classList.add('hidden');
        if (sendChatButton) sendChatButton.disabled = false;
        if (chatInput) chatInput.disabled = false;
    }
}

/**
 * Initializes event listeners for the Reality module.
 * This function should be called once the DOM is loaded and Firebase is ready.
 * UI elements are now fetched within this function to ensure they exist.
 */
export function initializeRealityModule() {
    const dailyEventInput = document.getElementById('daily-event-input');
    const logDailyEventButton = document.getElementById('log-daily-event-button');
    const sendChatButton = document.getElementById('send-chat-button');
    const chatInput = document.getElementById('chat-input');
    const archiveChatButton = document.getElementById('archive-chat-button');


    // Event listener for Log Daily Event button
    if (logDailyEventButton) {
        logDailyEventButton.addEventListener('click', async () => {
            const eventText = dailyEventInput ? dailyEventInput.value.trim() : '';
            if (eventText) {
                await saveDailyEvent(eventText);
            } else {
                showMessage('info', 'Please enter some text for your daily event.');
            }
        });
    }

    // Event listener for Send Chat button
    if (sendChatButton) {
        sendChatButton.addEventListener('click', async () => {
            const message = chatInput ? chatInput.value.trim() : '';
            if (message) {
                displayMessage(message, 'user'); // Display user message immediately
                await saveChatMessage(message, 'user'); // Save user message to Firestore
                if (chatInput) chatInput.value = ''; // Clear input field

                // Check if the message is an image generation request
                if (message.toLowerCase().startsWith('image of') || message.toLowerCase().startsWith('generate image of')) {
                    const imagePrompt = message.replace(/^(image of|generate image of)\s*/i, '').trim();
                    sendMessageToGemini(imagePrompt, true); // Call with isImageRequest = true
                } else {
                    sendMessageToGemini(message); // Call for text generation
                }
            }
        });
    }

    // Event listener for Enter key in chat input
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (sendChatButton) sendChatButton.click(); // Trigger send button click
            }
        });
    }

    // Event listener for Archive Chat button
    if (archiveChatButton) {
        archiveChatButton.addEventListener('click', archiveCurrentChat);
    }
}
