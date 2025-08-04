// ui-utils.js

// UI Elements (now fetched dynamically when functions are called or on DOMContentLoaded)
let loadingOverlay;
let messageModal;
let modalMessage;
let modalCloseButton;
let authScreen;
let appScreen;
let appHeader;
let userIdDisplay;
let chatMessagesDiv; // Added for displayMessage

// Initialize modal close button listener once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadingOverlay = document.getElementById('loading-overlay');
    messageModal = document.getElementById('message-modal');
    modalMessage = document.getElementById('modal-message');
    modalCloseButton = document.getElementById('modal-close-button');
    authScreen = document.getElementById('auth-screen');
    appScreen = document.getElementById('app-screen');
    appHeader = document.getElementById('app-header');
    userIdDisplay = document.getElementById('user-id-display');
    chatMessagesDiv = document.getElementById('chat-messages');

    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', () => {
            if (messageModal) messageModal.classList.add('hidden');
        });
    }
});

/**
 * Shows the loading overlay.
 */
export function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }
}

/**
 * Hides the loading overlay.
 */
export function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

/**
 * Displays a message in a modal.
 * @param {string} type - Type of message ('success', 'error', 'info').
 * @param {string} message - The message text.
 */
export function showMessage(type, message) {
    if (modalMessage && messageModal) {
        modalMessage.textContent = message;
        modalMessage.className = 'text-lg font-medium mb-4'; // Reset classes

        // Apply type-specific styling
        switch (type) {
            case 'success':
                modalMessage.classList.add('text-green-600');
                break;
            case 'error':
                modalMessage.classList.add('text-red-600');
                break;
            case 'info':
                modalMessage.classList.add('text-blue-600');
                break;
            default:
                modalMessage.classList.add('text-gray-800');
        }
        messageModal.classList.remove('hidden');
    }
}

/**
 * Displays a chat message in the chat messages div.
 * @param {string} message - The message text.
 * @param {'user'|'gemini'|'model'} sender - The sender of the message.
 * @param {string} [imageUrl] - Optional URL for an image to display with the message.
 */
export function displayMessage(message, sender, imageUrl = null) {
    if (!chatMessagesDiv) {
        console.error("Chat messages div not found.");
        return;
    }

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble', 'max-w-xs', 'p-3', 'rounded-xl', 'shadow-sm', 'text-sm', 'flex', 'flex-col');

    if (sender === 'user') {
        messageBubble.classList.add('user-message', 'bg-purple-200', 'text-purple-800', 'ml-auto');
    } else { // gemini or model
        messageBubble.classList.add('gemini-message', 'bg-blue-100', 'text-blue-800', 'mr-auto');
    }

    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = message;
        img.classList.add('max-w-full', 'h-auto', 'rounded-lg', 'mt-2');
        messageBubble.appendChild(img);
        const textSpan = document.createElement('span');
        textSpan.textContent = message;
        messageBubble.appendChild(textSpan);
    } else {
        messageBubble.textContent = message;
    }

    chatMessagesDiv.appendChild(messageBubble);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Auto-scroll to the latest message
}

/**
 * Shows the login/signup screen and hides the main app screen.
 */
export function showLoginScreen() {
    if (authScreen && appScreen && appHeader) {
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        appHeader.classList.add('hidden');
    }
}

/**
 * Shows the main application screen and hides the login/signup screen.
 * @param {string} uid - The user's UID to display.
 */
export function showMainAppScreen(uid) {
    if (authScreen && appScreen && appHeader && userIdDisplay) {
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        appHeader.classList.remove('hidden');
        userIdDisplay.textContent = `User ID: ${uid}`;
    }
}
