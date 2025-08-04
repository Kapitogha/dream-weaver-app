// stats-module.js

// Import Firebase variables and functions
import { db, userId, isAuthReady, appId } from './firebase-init.js';
import { showLoading, hideLoading, showMessage } from './ui-utils.js';
import {
    collection, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Stop Words for Top Insights ---
const stopWords = new Set([
    "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "with",
    "in", "out", "into", "through", "over", "under", "of", "about", "above", "below", "up", "down",
    "then", "now", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each",
    "few", "more", "most", "other", "some", "such", "no", "not", "only", "own", "same", "so",
    "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now", "ve", "ll",
    "m", "re", "d", "this", "that", "these", "those", "is", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "doing", "would", "could", "shall", "may", "might",
    "must", "it", "its", "i", "me", "my", "myself", "we", "us", "our", "ours", "ourselves", "you",
    "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers",
    "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what",
    "which", "who", "whom", "whose", "this", "that", "these", "those", "am", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "go", "went",
    "gone", "goes", "going", "come", "came", "comes", "coming", "say", "says", "said", "saying",
    "make", "makes", "made", "making", "get", "gets", "got", "getting", "see", "sees", "saw", "seeing",
    "know", "knows", "knew", "knowing", "take", "takes", "took", "taking", "think", "thinks", "thought",
    "thinking", "look", "looks", "looked", "looking", "want", "wants", "wanted", "wanting", "give",
    "gives", "gave", "giving", "use", "uses", "used", "using", "find", "finds", "found", "finding",
    "tell", "tells", "told", "telling", "ask", "asks", "asked", "asking", "work", "works", "worked",
    "working", "seem", "seems", "seemed", "seeming", "feel", "feels", "felt", "feeling", "try",
    "tries", "tried", "trying", "leave", "leaves", "left", "leaving", "call", "calls", "called",
    "calling", "also", "very", "much", "too", "often", "always", "never", "sometimes", "usually",
    "really", "just", "even", "still", "yet", "already", "almost", "around", "away", "back", "down",
    "forward", "here", "in", "off", "on", "out", "over", "under", "of", "about", "above", "below",
    "beneath", "beside", "between", "beyond", "but", "by", "despite", "during", "except", "for",
    "from", "in", "inside", "into", "like", "near", "of", "off", "on", "onto", "opposite", "out",
    "outside", "over", "past", "per", "plus", "round", "save", "since", "than", "through", "to",
    "toward", "under", "underneath", "until", "up", "upon", "with", "within", "without", "i'm", "you're",
    "he's", "she's", "it's", "we're", "they're", "i've", "you've", "we've", "they've", "i'd", "you'd",
    "he'd", "she'd", "we'd", "they'd", "i'll", "you'll", "he'll", "she'll", "it'll", "we'll", "they'll",
    "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't", "doesn't", "don't", "didn't",
    "won't", "wouldn't", "shan't", "shouldn't", "can't", "cannot", "couldn't", "mustn't", "here's",
    "there's", "what's", "where's", "when's", "why's", "how's", "let's", "that's", "who's", "whom's",
    "whose's", "this's", "these's", "those's", "mr", "mrs", "ms", "dr", "prof", "etc", "e.g.", "i.e.",
    "vs", "via", "etc", "eg", "ie", "dr", "mr", "mrs", "ms", "prof", "fig", "figs", "cf", "viz"
]);

/**
 * Helper function to tokenize text for frequency analysis.
 * @param {string} text - The text to tokenize.
 * @returns {Array<string>} An array of cleaned, lowercased words.
 */
function tokenizeAndClean(text) {
    if (!text) return [];
    return text.toLowerCase().split(/[^a-z0-9]+/)
               .filter(word => word.length > 1 && !stopWords.has(word));
}

/**
 * Helper function to update a frequency map with new terms.
 * @param {object} map - The frequency map object.
 * @param {Array<string>} terms - An array of terms to add to the map.
 */
function updateFrequencyMap(map, terms) {
    terms.forEach(term => {
        map[term] = (map[term] || 0) + 1;
    });
}

/**
 * Helper function to display top terms from a frequency map in a list element.
 * @param {HTMLElement} element - The UL element to display the terms in.
 * @param {object} freqMap - The frequency map object.
 */
function displayTopTerms(element, freqMap) {
    if (!element) return;
    element.innerHTML = '';
    const sortedTerms = Object.entries(freqMap).sort(([,a],[,b]) => b - a);
    if (sortedTerms.length === 0) {
        element.innerHTML = '<li class="text-gray-500">No data</li>';
    } else {
        sortedTerms.slice(0, 5).forEach(([term, count]) => {
            const li = document.createElement('li');
            li.textContent = `${term} (${count})`;
            element.appendChild(li);
        });
    }
}

/**
 * Loads and displays overall statistics (total dreams, events, chats, matches).
 */
export async function loadStats() {
    const statTotalDreams = document.getElementById('stat-total-dreams');
    const statTotalEvents = document.getElementById('stat-total-events');
    const statTotalChats = document.getElementById('stat-total-chats');
    const statMatchedDreams = document.getElementById('stat-matched-dreams');

    if (!userId || !isAuthReady) {
        if (statTotalDreams) statTotalDreams.textContent = 'N/A';
        if (statTotalEvents) statTotalEvents.textContent = 'N/A';
        if (statTotalChats) statTotalChats.textContent = 'N/A';
        if (statMatchedDreams) statMatchedDreams.textContent = 'N/A';
        return;
    }

    showLoading();
    try {
        const dreamsSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/archived_dreams`));
        if (statTotalDreams) statTotalDreams.textContent = dreamsSnapshot.size;

        const eventsSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/daily_events`));
        if (statTotalEvents) statTotalEvents.textContent = eventsSnapshot.size;

        const chatsSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/conversations`));
        if (statTotalChats) statTotalChats.textContent = chatsSnapshot.size;

        let matchedDreamsCount = 0;
        dreamsSnapshot.forEach(doc => {
            if (doc.data().matchedRealityEvent) {
                matchedDreamsCount++;
            }
        });
        if (statMatchedDreams) statMatchedDreams.textContent = matchedDreamsCount;

    } catch (error) {
        console.error("Error loading stats:", error);
        showMessage('error', `Failed to load statistics: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Loads and displays detailed dream analysis statistics.
 */
export async function loadDetailedDreamStats() {
    const statActionsPerformed = document.getElementById('stat-actions-performed');
    const statLocationInfo = document.getElementById('stat-location-info');
    const statTimeInDream = document.getElementById('stat-time-in-dream');
    const statMovementsThroughTime = document.getElementById('stat-movements-through-time');
    const statEmotionalContent = document.getElementById('stat-emotional-content');
    const statSurfacePsychologicalContent = document.getElementById('stat-surface-psychological-content');
    const statWorkDoneInDream = document.getElementById('stat-work-done-in-dream');
    const statFamiliarPersonsSpokenTo = document.getElementById('stat-familiar-persons-spoken-to');
    const statRelationToPastEvents = document.getElementById('stat-relation-to-past-events');
    const statRelationToFutureEvents = document.getElementById('stat-relation-to-future-events');
    const statMessagesReceived = document.getElementById('stat-messages-received');
    const statAwarenessOfSpace = document.getElementById('stat-awareness-of-space');

    if (!userId || !isAuthReady) {
        if (statActionsPerformed) statActionsPerformed.textContent = 'N/A';
        if (statLocationInfo) statLocationInfo.textContent = 'N/A';
        if (statTimeInDream) statTimeInDream.textContent = 'N/A';
        if (statMovementsThroughTime) statMovementsThroughTime.textContent = 'N/A';
        if (statEmotionalContent) statEmotionalContent.textContent = 'N/A';
        if (statSurfacePsychologicalContent) statSurfacePsychologicalContent.textContent = 'N/A';
        if (statWorkDoneInDream) statWorkDoneInDream.textContent = 'N/A';
        if (statFamiliarPersonsSpokenTo) statFamiliarPersonsSpokenTo.textContent = 'N/A';
        if (statRelationToPastEvents) statRelationToPastEvents.textContent = 'N/A';
        if (statRelationToFutureEvents) statRelationToFutureEvents.textContent = 'N/A';
        if (statMessagesReceived) statMessagesReceived.textContent = 'N/A';
        if (statAwarenessOfSpace) statAwarenessOfSpace.textContent = 'N/A';
        return;
    }

    showLoading();
    try {
        const dreamsSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/archived_dreams`));

        const categoryCounts = {
            actionsPerformed: 0,
            location: 0,
            timeInDream: 0,
            movementsThroughTime: 0,
            emotionalContent: 0,
            surfacePsychologicalContent: 0,
            workDoneInDream: 0,
            familiarPersonsSpokenTo: 0,
            relationToPastEvents: 0,
            relationToFutureEvents: 0,
            messagesReceived: 0,
            awarenessOfSpace: 0
        };

        dreamsSnapshot.forEach(docEntry => {
            const dreamData = docEntry.data();
            try {
                const analysis = JSON.parse(dreamData.analysisText);

                for (const key in categoryCounts) {
                    if (analysis[key] && analysis[key].trim() !== '') {
                        categoryCounts[key]++;
                    }
                }
            } catch (e) {
                // Ignore parsing errors for dreams that might not have full analysis JSON
                console.warn("Could not parse analysis for dream:", docEntry.id, e);
            }
        });

        if (statActionsPerformed) statActionsPerformed.textContent = categoryCounts.actionsPerformed;
        if (statLocationInfo) statLocationInfo.textContent = categoryCounts.location;
        if (statTimeInDream) statTimeInDream.textContent = categoryCounts.timeInDream;
        if (statMovementsThroughTime) statMovementsThroughTime.textContent = categoryCounts.movementsThroughTime;
        if (statEmotionalContent) statEmotionalContent.textContent = categoryCounts.emotionalContent;
        if (statSurfacePsychologicalContent) statSurfacePsychologicalContent.textContent = categoryCounts.surfacePsychologicalContent;
        if (statWorkDoneInDream) statWorkDoneInDream.textContent = categoryCounts.workDoneInDream;
        if (statFamiliarPersonsSpokenTo) statFamiliarPersonsSpokenTo.textContent = categoryCounts.familiarPersonsSpokenTo;
        if (statRelationToPastEvents) statRelationToPastEvents.textContent = categoryCounts.relationToPastEvents;
        if (statRelationToFutureEvents) statRelationToFutureEvents.textContent = categoryCounts.relationToFutureEvents;
        if (statMessagesReceived) statMessagesReceived.textContent = categoryCounts.messagesReceived;
        if (statAwarenessOfSpace) statAwarenessOfSpace.textContent = categoryCounts.awarenessOfSpace;

    } catch (error) {
        console.error("Error loading detailed dream stats:", error);
        showMessage('error', `Failed to load detailed dream statistics: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Loads and displays top insights derived from dream analyses.
 */
export async function loadTopInsights() {
    const topEmotionalContent = document.getElementById('top-emotional-content');
    const topLocations = document.getElementById('top-locations');
    const topFamiliarPersons = document.getElementById('top-familiar-persons');
    const topActionsPerformed = document.getElementById('top-actions-performed');
    const topSurfacePsychologicalContent = document.getElementById('top-surface-psychological-content');
    const topMessagesReceived = document.getElementById('top-messages-received');

    if (!userId || !isAuthReady) {
        if (topEmotionalContent) topEmotionalContent.innerHTML = '<li class="text-gray-500">No data</li>';
        if (topLocations) topLocations.innerHTML = '<li class="text-gray-500">No data</li>';
        if (topFamiliarPersons) topFamiliarPersons.innerHTML = '<li class="text-gray-500">No data</li>';
        if (topActionsPerformed) topActionsPerformed.innerHTML = '<li class="text-gray-500">No data</li>';
        if (topSurfacePsychologicalContent) topSurfacePsychologicalContent.innerHTML = '<li class="text-gray-500">No data</li>';
        if (topMessagesReceived) topMessagesReceived.innerHTML = '<li class="text-gray-500">No data</li>';
        return;
    }

    showLoading();
    try {
        const dreamsSnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${userId}/archived_dreams`));

        const emotionalContentFreq = {};
        const locationFreq = {};
        const familiarPersonsFreq = {};
        const actionsPerformedFreq = {};
        const surfacePsychologicalContentFreq = {};
        const messagesReceivedFreq = {};

        dreamsSnapshot.forEach(docEntry => {
            const dreamData = docEntry.data();
            try {
                const analysis = JSON.parse(dreamData.analysisText);

                updateFrequencyMap(emotionalContentFreq, tokenizeAndClean(analysis.emotionalContent));
                updateFrequencyMap(locationFreq, tokenizeAndClean(analysis.location));
                updateFrequencyMap(familiarPersonsFreq, tokenizeAndClean(analysis.familiarPersonsSpokenTo));
                updateFrequencyMap(actionsPerformedFreq, tokenizeAndClean(analysis.actionsPerformed));
                updateFrequencyMap(surfacePsychologicalContentFreq, tokenizeAndClean(analysis.surfacePsychologicalContent));
                updateFrequencyMap(messagesReceivedFreq, tokenizeAndClean(analysis.messagesReceived));

            } catch (e) {
                // Ignore parsing errors for dreams that might not have full analysis JSON
                console.warn("Could not parse analysis for top insights:", docEntry.id, e);
            }
        });

        displayTopTerms(topEmotionalContent, emotionalContentFreq);
        displayTopTerms(topLocations, locationFreq);
        displayTopTerms(topFamiliarPersons, familiarPersonsFreq);
        displayTopTerms(topActionsPerformed, actionsPerformedFreq);
        displayTopTerms(topSurfacePsychologicalContent, surfacePsychologicalContentFreq);
        displayTopTerms(topMessagesReceived, messagesReceivedFreq);

    } catch (error) {
        console.error("Error loading top insights:", error);
        showMessage('error', `Failed to load top insights: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Initializes event listeners for the Stats module.
 * This function should be called once the DOM is loaded and Firebase is ready.
 */
export function initializeStatsModule() {
    // No specific event listeners needed here yet, as functions are called directly by app.js
    // when the stats sub-tabs are activated.
}
