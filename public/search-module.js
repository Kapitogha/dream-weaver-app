// search-module.js

// Import Firebase variables and functions
import { db, userId, isAuthReady, appId } from './firebase-init.js';
import { showLoading, hideLoading, showMessage } from './ui-utils.js';
import {
    collection, query, orderBy, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import functions from dreams-module for matching
import { openMatchModalForSearch } from './dreams-module.js';

// Internal state variables for Search module
let selectedDreamForMatch = null;
let selectedEventForMatch = null;

/**
 * Updates the state and text of the 'Match Selected' button based on current selections.
 */
function updateMatchSelectedButtonState() {
    const matchSelectedButton = document.getElementById('match-selected-button');
    if (!matchSelectedButton) return;

    if (selectedDreamForMatch && selectedEventForMatch) {
        matchSelectedButton.disabled = false;
        matchSelectedButton.textContent = 'Match Selected (1 Dream, 1 Event)';
    } else {
        matchSelectedButton.disabled = true;
        matchSelectedButton.textContent = 'Match Selected (1 Dream, 1 Event)';
    }
}

/**
 * Performs a search across archived dreams and daily events based on a search term and time scope.
 */
export async function performSearch() {
    const searchInput = document.getElementById('search-input');
    const timeScopeSearch = document.getElementById('time-scope-search');
    const searchResultsList = document.getElementById('search-results-list');

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const selectedTimeScope = timeScopeSearch ? timeScopeSearch.value : 'allTime';

    if (!searchTerm) {
        if (searchResultsList) searchResultsList.innerHTML = '<p class="text-gray-500">Please enter a search term.</p>';
        return;
    }

    if (!userId || !isAuthReady) {
        if (searchResultsList) searchResultsList.innerHTML = '<p class="text-gray-500">Please sign in to search your data.</p>';
        return;
    }

    if (searchResultsList) searchResultsList.innerHTML = '<p class="text-gray-500">Searching...</p>';
    showLoading();

    selectedDreamForMatch = null; // Reset selections on new search
    selectedEventForMatch = null;
    updateMatchSelectedButtonState();

    try {
        const dreamResults = [];
        const eventResults = [];

        const now = new Date();
        let startDate = new Date(0); // Default to all time

        // Determine start date based on selected time scope
        if (selectedTimeScope === 'last7Days') {
            startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (selectedTimeScope === 'last30Days') {
            startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        } else if (selectedTimeScope === 'lastYear') {
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        }

        // Fetch and filter archived dreams
        const dreamsQuery = query(
            collection(db, `artifacts/${appId}/users/${userId}/archived_dreams`),
            orderBy("timestamp", "desc")
        );
        const dreamSnapshot = await getDocs(dreamsQuery);
        dreamSnapshot.forEach(docEntry => {
            const dreamData = docEntry.data();
            const dreamText = dreamData.dreamText ? dreamData.dreamText.toLowerCase() : '';
            const dreamTitle = dreamData.dreamTitle ? dreamData.dreamTitle.toLowerCase() : '';
            const dreamTimestamp = dreamData.timestamp ? dreamData.timestamp.toDate().getTime() : 0;

            if ((dreamText.includes(searchTerm) || dreamTitle.includes(searchTerm)) && dreamTimestamp >= startDate.getTime()) {
                dreamResults.push({
                    id: docEntry.id,
                    type: 'Dream',
                    content: dreamData.dreamText,
                    title: dreamData.dreamTitle,
                    timestamp: dreamData.timestamp,
                    matchedRealityEvent: dreamData.matchedRealityEvent || ''
                });
            }
        });

        // Fetch and filter daily events
        const eventsQuery = query(
            collection(db, `artifacts/${appId}/users/${userId}/daily_events`),
            orderBy("timestamp", "desc")
        );
        const eventSnapshot = await getDocs(eventsQuery);
        eventSnapshot.forEach(docEntry => {
            const eventData = docEntry.data();
            const eventText = eventData.eventText ? eventData.eventText.toLowerCase() : '';
            const eventTimestamp = eventData.timestamp ? eventData.timestamp.toDate().getTime() : 0;

            if (eventText.includes(searchTerm) && eventTimestamp >= startDate.getTime()) {
                eventResults.push({
                    id: docEntry.id,
                    type: 'Daily Event',
                    content: eventData.eventText,
                    timestamp: eventData.timestamp
                });
            }
        });

        displaySearchResults(dreamResults, eventResults);

    } catch (error) {
        console.error("Error during search:", error);
        showMessage('error', `Failed to perform search: ${error.message}`);
        if (searchResultsList) searchResultsList.innerHTML = '<p class="text-red-500">Error performing search.</p>';
    } finally {
        hideLoading();
    }
}

/**
 * Displays the search results in the UI.
 * @param {Array<object>} dreamResults - Array of matching dream objects.
 * @param {Array<object>} eventResults - Array of matching daily event objects.
 */
function displaySearchResults(dreamResults, eventResults) {
    const searchResultsList = document.getElementById('search-results-list');
    if (!searchResultsList) return;

    searchResultsList.innerHTML = ''; // Clear previous results
    console.log("Displaying search results. Dream results count:", dreamResults.length, "Event results count:", eventResults.length);

    // Sort results by timestamp (most recent first)
    dreamResults.sort((a, b) => {
        const timestampA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
        const timestampB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
        return timestampB - timestampA;
    });

    eventResults.sort((a, b) => {
        const timestampA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
        const timestampB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
        return timestampB - timestampA;
    });

    // Display Dream Results
    const dreamResultsContainer = document.createElement('div');
    dreamResultsContainer.classList.add('space-y-3', 'mt-4', 'p-4', 'border', 'border-purple-200', 'rounded-lg', 'bg-purple-50');
    dreamResultsContainer.innerHTML = '<h4 class="text-xl font-bold text-purple-800 mb-3">Your Archived Dreams</h4>';
    if (dreamResults.length === 0) {
        dreamResultsContainer.innerHTML += '<p class="text-gray-600">No dreams found matching your criteria in this timeframe.</p>';
    } else {
        dreamResults.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.classList.add('search-result-item');

            const itemHeader = document.createElement('div');
            itemHeader.classList.add('search-result-item-header');

            const typeSpan = document.createElement('span');
            typeSpan.classList.add('search-result-type');
            typeSpan.textContent = item.type;
            itemHeader.appendChild(typeSpan);

            const dateSpan = document.createElement('span');
            dateSpan.classList.add('text-gray-500', 'text-xs');
            dateSpan.textContent = item.timestamp && item.timestamp.toDate ?
                                  new Date(item.timestamp.toDate()).toLocaleString() : 'N/A';
            itemHeader.appendChild(dateSpan);
            resultItem.appendChild(itemHeader);

            const titlePara = document.createElement('p');
            titlePara.classList.add('font-semibold', 'text-gray-800', 'mb-1');
            titlePara.textContent = item.title || 'Untitled Dream';
            resultItem.appendChild(titlePara);

            const contentPara = document.createElement('p');
            contentPara.classList.add('text-gray-700', 'text-sm');
            contentPara.textContent = item.content.substring(0, 150) + (item.content.length > 150 ? '...' : '');
            resultItem.appendChild(contentPara);

            if (item.matchedRealityEvent) {
                const matchPara = document.createElement('p');
                matchPara.classList.add('text-green-600', 'text-xs', 'mt-1');
                matchPara.innerHTML = `<strong>Match:</strong> ${item.matchedRealityEvent}`;
                resultItem.appendChild(matchPara);
            }

            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('search-result-actions', 'flex', 'justify-between', 'items-center');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('search-result-checkbox', 'form-checkbox', 'text-blue-600');
            checkbox.setAttribute('data-id', item.id);
            checkbox.setAttribute('data-type', 'dream');
            checkbox.addEventListener('change', (e) => {
                selectedDreamForMatch = e.target.checked ? { id: item.id, content: item.content, title: item.title } : null;
                // Uncheck other dream checkboxes
                document.querySelectorAll('.search-result-checkbox[data-type="dream"]').forEach(otherCheckbox => {
                    if (otherCheckbox !== e.target) {
                        otherCheckbox.checked = false;
                    }
                });
                updateMatchSelectedButtonState();
            });
            actionsDiv.appendChild(checkbox);

            const addMatchButton = document.createElement('button');
            addMatchButton.classList.add('px-3', 'py-1', 'bg-blue-500', 'text-white', 'rounded-md', 'hover:bg-blue-600', 'edit-match-button');
            addMatchButton.textContent = item.matchedRealityEvent ? 'Edit Match' : 'Add Match';
            addMatchButton.setAttribute('data-id', item.id);
            addMatchButton.setAttribute('data-dream-text', item.content);
            addMatchButton.setAttribute('data-matched-event', item.matchedRealityEvent);
            actionsDiv.appendChild(addMatchButton);
            resultItem.appendChild(actionsDiv);

            addMatchButton.addEventListener('click', (event) => {
                // Call a function from dreams-module to open the match modal
                openMatchModalForSearch(event.target.dataset.id, event.target.dataset.dreamText, event.target.dataset.matchedEvent);
            });
            dreamResultsContainer.appendChild(resultItem);
        });
    }
    searchResultsList.appendChild(dreamResultsContainer);


    // Display Daily Event Results
    const eventResultsContainer = document.createElement('div');
    eventResultsContainer.classList.add('space-y-3', 'mt-6', 'p-4', 'border', 'border-green-200', 'rounded-lg', 'bg-green-50');
    eventResultsContainer.innerHTML = '<h4 class="text-xl font-bold text-green-800 mb-3">Your Daily Events</h4>';
    if (eventResults.length === 0) {
        eventResultsContainer.innerHTML += '<p class="text-gray-600">No daily events found matching your criteria.</p>';
    } else {
        eventResults.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.classList.add('search-result-item');

            const itemHeader = document.createElement('div');
            itemHeader.classList.add('search-result-item-header');

            const typeSpan = document.createElement('span');
            typeSpan.classList.add('search-result-type');
            typeSpan.textContent = item.type;
            itemHeader.appendChild(typeSpan);

            const dateSpan = document.createElement('span');
            dateSpan.classList.add('text-gray-500', 'text-xs');
            dateSpan.textContent = item.timestamp && item.timestamp.toDate ?
                                  new Date(item.timestamp.toDate()).toLocaleString() : 'N/A';
            itemHeader.appendChild(dateSpan);
            resultItem.appendChild(itemHeader);

            const contentPara = document.createElement('p');
            contentPara.classList.add('text-gray-700', 'text-sm');
            contentPara.textContent = item.content.substring(0, 150) + (item.content.length > 150 ? '...' : '');
            resultItem.appendChild(contentPara);

            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('search-result-actions', 'flex', 'justify-between', 'items-center');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('search-result-checkbox', 'form-checkbox', 'text-green-600');
            checkbox.setAttribute('data-id', item.id);
            checkbox.setAttribute('data-type', 'event');
            checkbox.addEventListener('change', (e) => {
                selectedEventForMatch = e.target.checked ? { id: item.id, content: item.content } : null;
                // Uncheck other event checkboxes
                document.querySelectorAll('.search-result-checkbox[data-type="event"]').forEach(otherCheckbox => {
                    if (otherCheckbox !== e.target) {
                        otherCheckbox.checked = false;
                    }
                });
                updateMatchSelectedButtonState();
            });
            actionsDiv.appendChild(checkbox);

            resultItem.appendChild(actionsDiv);

            eventResultsContainer.appendChild(resultItem);
        });
    }
    searchResultsList.appendChild(eventResultsContainer);

    if (dreamResults.length === 0 && eventResults.length === 0) {
        if (searchResultsList) searchResultsList.innerHTML = '<p class="text-gray-500">No results found for your search criteria in either dreams or daily events.</p>';
    }
}

/**
 * Handles the click event for the "Match Selected" button.
 * Opens the match modal with details of the selected dream and event.
 */
function handleMatchSelectedClick() {
    if (selectedDreamForMatch && selectedEventForMatch) {
        // Call a function from dreams-module to open the match modal with both selected items
        openMatchModalForSearch(
            selectedDreamForMatch.id,
            selectedDreamForMatch.content,
            `Matched with daily event: "${selectedEventForMatch.content}"`
        );
    } else {
        showMessage('info', 'Please select exactly one dream and one daily event to match.');
    }
}

/**
 * Initializes event listeners for the Search module.
 * This function should be called once the DOM is loaded and Firebase is ready.
 * UI elements are now fetched within this function to ensure they exist.
 */
export function initializeSearchModule() {
    const searchButton = document.getElementById('search-button');
    const timeScopeSearch = document.getElementById('time-scope-search');
    const matchSelectedButton = document.getElementById('match-selected-button');

    if (searchButton) searchButton.addEventListener('click', performSearch);
    if (timeScopeSearch) timeScopeSearch.addEventListener('change', performSearch); // Re-run search when time scope changes
    if (matchSelectedButton) matchSelectedButton.addEventListener('click', handleMatchSelectedClick);
}
