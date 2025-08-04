// dreams-module.js

// Import Firebase variables and functions
import { db, userId, isAuthReady, appId } from './firebase-init.js';
import { showLoading, hideLoading, showMessage } from './ui-utils.js';
import {
    serverTimestamp, collection, addDoc, doc, updateDoc, deleteDoc,
    query, orderBy, limit, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Internal state variables for Dreams module
let currentDraftId = null; // To track the ID of the draft dream currently being edited
let dreamsToAnalyze = []; // Stores dreams fetched for the analysis tab's time scope
let currentDreamIdForMatch = null; // To track the ID of the dream for which a match is being added/edited

// --- Firebase Operations for Dreams ---

/**
 * Saves a new dream draft to Firestore or updates an existing one.
 * @param {string} dreamText - The text content of the dream.
 * @param {string} dreamTitle - The title of the dream (optional).
 * @param {boolean} isPreAnalyzed - Whether the dream has been pre-analyzed (default false).
 * @returns {Promise<string|null>} The ID of the saved/updated draft or null if failed.
 */
export async function saveDraftDream(dreamText, dreamTitle = '', isPreAnalyzed = false) {
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
            isPreAnalyzed: isPreAnalyzed
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
 * Updates an existing dream draft in Firestore.
 * @param {string} draftId - The ID of the draft dream to update.
 * @param {string} dreamText - The updated text content of the dream.
 * @param {string} dreamTitle - The updated title of the dream.
 * @param {boolean} isPreAnalyzed - The updated pre-analyzed status.
 */
export async function updateDraftDream(draftId, dreamText, dreamTitle = '', isPreAnalyzed = false) {
    if (!userId || !isAuthReady || !draftId) {
        showMessage('error', 'Cannot update draft. Please sign in or select a draft.');
        return;
    }
    showLoading();
    try {
        const draftRef = doc(db, `artifacts/${appId}/users/${userId}/draft_dreams`, draftId);
        await updateDoc(draftRef, {
            dreamText: dreamText,
            dreamTitle: dreamTitle,
            timestamp: serverTimestamp(), // Update timestamp on edit
            isPreAnalyzed: isPreAnalyzed
        });
        console.log(`Draft ${draftId} updated. isPreAnalyzed set to: ${isPreAnalyzed}`);
        // No message here, as this is often called internally by other functions
    } catch (error) {
        console.error("Error updating draft dream:", error);
        showMessage('error', `Failed to update draft dream: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Deletes a dream draft from Firestore.
 * @param {string} draftId - The ID of the draft dream to delete.
 */
export async function deleteDraftDream(draftId) {
    if (!userId || !isAuthReady || !draftId) {
        showMessage('error', 'Cannot delete draft. Please sign in or select a draft.');
        return;
    }
    showLoading();
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/draft_dreams`, draftId));
        showMessage('success', 'Draft dream deleted!');
        // Clear current input if the deleted draft was being edited
        const dreamInputDraft = document.getElementById('dream-input-draft');
        const dreamTitleDraft = document.getElementById('dream-title-draft');
        const analysisContent = document.getElementById('analysis-content');
        const dreamAnalysisOutput = document.getElementById('dream-analysis-output');

        if (currentDraftId === draftId) {
            if (dreamInputDraft) dreamInputDraft.value = '';
            if (dreamTitleDraft) dreamTitleDraft.value = '';
            currentDraftId = null;
        }
        // Also clear analysis input/output if the deleted draft was loaded there
        if (analysisContent) analysisContent.innerHTML = '';
        if (dreamAnalysisOutput) dreamAnalysisOutput.classList.add('hidden');
    } catch (error) {
        console.error("Error deleting draft dream:", error);
        showMessage('error', `Failed to delete draft dream: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Saves an analyzed dream to the archived_dreams collection in Firestore.
 * @param {string} dreamText - The original text of the dream.
 * @param {string} analysisJsonString - The JSON string of the dream analysis.
 * @param {string} dreamTitle - The title of the dream (optional).
 */
export async function saveAnalyzedDream(dreamText, analysisJsonString, dreamTitle = '') {
    if (!userId || !isAuthReady) {
        showMessage('error', 'Please sign in to save dreams.');
        return;
    }
    showLoading();
    try {
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/archived_dreams`), {
            dreamText: dreamText,
            analysisText: analysisJsonString, // Save the full JSON string
            dreamTitle: dreamTitle,
            timestamp: serverTimestamp(),
            matchedRealityEvent: '' // Initialize with empty string for no match
        });
        showMessage('success', 'Dream analyzed and archived successfully!');
    } catch (error) {
        console.error("Error saving analyzed dream:", error);
        showMessage('error', `Failed to save analyzed dream: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Performs dream analysis using the Gemini API and archives the dream.
 * @param {string} draftId - The ID of the draft dream to analyze and archive.
 * @param {string} dreamText - The text content of the dream to analyze.
 * @param {string} dreamTitle - The title of the dream.
 */
export async function analyzeAndArchiveDream(draftId, dreamText, dreamTitle = '') {
    if (!userId || !isAuthReady) {
        showMessage('error', 'Please sign in to analyze and archive dreams.');
        return;
    }
    showLoading();
    try {
        // Perform analysis, requesting expanded JSON for archiving
        const analysisJsonString = await performDreamAnalysis(dreamText, dreamTitle, true);

        if (analysisJsonString) {
            // Save to archived_dreams
            await saveAnalyzedDream(dreamText, analysisJsonString, dreamTitle);
            // Delete from draft_dreams
            await deleteDraftDream(draftId);

            showMessage('success', 'Dream analyzed and moved to Archive!');
            // We'll need a way to switch sub-tabs, this will be handled by app.js or a dedicated tab manager
            // For now, we'll just reload the archive.
            loadArchivedDreams();
            loadDraftDreams(); // Reload drafts to show it's gone
        } else {
            showMessage('error', 'Analysis failed, dream not archived.');
        }
    } catch (error) {
        console.error("Error analyzing and archiving dream:", error);
        showMessage('error', `Failed to analyze and archive dream: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Deletes an archived dream from Firestore.
 * @param {string} dreamId - The ID of the archived dream to delete.
 */
export async function deleteArchivedDream(dreamId) {
    if (!userId || !isAuthReady || !dreamId) {
        showMessage('error', 'Cannot delete archived dream. Please sign in or select a dream.');
        return;
    }
    showLoading();
    try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/archived_dreams`, dreamId));
        showMessage('success', 'Archived dream deleted!');
    } catch (error) {
        console.error("Error deleting archived dream:", error);
        showMessage('error', `Failed to delete archived dream: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Loads and displays draft dreams from Firestore.
 */
export async function loadDraftDreams() {
    console.log("loadDraftDreams called. userId:", userId, "isAuthReady:", isAuthReady);
    const draftDreamsList = document.getElementById('draft-dreams-list');
    if (!userId || !isAuthReady) {
        if (draftDreamsList) draftDreamsList.innerHTML = '<p class="text-gray-500">Please sign in to see your drafts.</p>';
        return;
    }

    if (draftDreamsList) draftDreamsList.innerHTML = '<p class="text-gray-500">Loading drafts...</p>';
    showLoading();

    const q = query(
        collection(db, `artifacts/${appId}/users/${userId}/draft_dreams`),
        orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snapshot) => {
        hideLoading();
        if (draftDreamsList) draftDreamsList.innerHTML = ''; // Clear to prevent duplicates on updates
        if (snapshot.empty) {
            if (draftDreamsList) draftDreamsList.innerHTML = '<p class="text-gray-500">No draft dreams yet. Record a dream on the "Record" tab!</p>';
        }
        snapshot.forEach((docEntry) => {
            const dreamData = docEntry.data();
            const dreamId = docEntry.id;
            const dreamDate = dreamData.timestamp && dreamData.timestamp.toDate ?
                             new Date(dreamData.timestamp.toDate()).toLocaleString() :
                             'N/A';
            const snippet = dreamData.dreamText.substring(0, 100) + (dreamData.dreamText.length > 100 ? '...' : '');
            const dreamTitle = dreamData.dreamTitle || 'Untitled Dream';
            const isPreAnalyzed = dreamData.isPreAnalyzed || false;

            const dreamItem = document.createElement('div');
            dreamItem.classList.add('draft-item');
            if (isPreAnalyzed) {
                dreamItem.classList.add('pre-analyzed-draft');
            }
            dreamItem.innerHTML = `
                <div class="draft-item-content">
                    <p class="text-gray-700 text-sm font-semibold">${dreamTitle} (${dreamDate}) ${isPreAnalyzed ? '<span class="tick-icon">✓</span>' : ''}</p>
                    <p class="text-gray-600 text-xs mt-1">${snippet}</p>
                </div>
                <div class="draft-item-actions">
                    <button class="px-3 py-1 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 edit-draft-button" data-id="${dreamId}">Edit</button>
                    <button class="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 pre-analyse-button" data-id="${dreamId}" data-dream-text="${dreamData.dreamText}" data-dream-title="${dreamData.dreamTitle || ''}">Pre-analyse</button>
                    <button class="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 delete-draft-button" data-id="${dreamId}">Delete</button>
                </div>
            `;
            if (draftDreamsList) draftDreamsList.appendChild(dreamItem);

            dreamItem.querySelector('.edit-draft-button').addEventListener('click', () => {
                const dreamInputDraft = document.getElementById('dream-input-draft');
                const dreamTitleDraft = document.getElementById('dream-title-draft');
                if (dreamInputDraft) dreamInputDraft.value = dreamData.dreamText;
                if (dreamTitleDraft) dreamTitleDraft.value = dreamData.dreamTitle || '';
                currentDraftId = dreamId; // Set the current draft being edited
            });

            dreamItem.querySelector('.pre-analyse-button').addEventListener('click', async (event) => {
                const id = event.target.dataset.id;
                const text = event.target.dataset.dreamText;
                const title = event.target.dataset.dreamTitle;
                await analyzeAndArchiveDream(id, text, title);
            });

            dreamItem.querySelector('.delete-draft-button').addEventListener('click', () => {
                deleteDraftDream(dreamId);
            });
        });
    }, (error) => {
        hideLoading();
        console.error("Error loading draft dreams:", error);
        showMessage('error', `Failed to load draft dreams: ${error.message}`);
    });
}

/**
 * Loads and displays archived dreams from Firestore.
 */
export async function loadArchivedDreams() {
    console.log("loadArchivedDreams called. userId:", userId, "isAuthReady:", isAuthReady);
    const archivedDreamsList = document.getElementById('archived-dreams-list');
    if (!userId || !isAuthReady) {
        if (archivedDreamsList) archivedDreamsList.innerHTML = '<p class="text-gray-500">Please sign in to see your archived dreams.</p>';
        return;
    }

    if (archivedDreamsList) archivedDreamsList.innerHTML = '<p class="text-gray-500">Loading archived dreams...</p>';
    showLoading();

    const q = query(
        collection(db, `artifacts/${appId}/users/${userId}/archived_dreams`),
        orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snapshot) => {
        hideLoading();
        if (archivedDreamsList) archivedDreamsList.innerHTML = ''; // Clear to prevent duplicates on updates
        if (snapshot.empty) {
            if (archivedDreamsList) archivedDreamsList.innerHTML = '<p class="text-gray-500">No archived dreams yet. Analyze and save your dreams!</p>';
        }
        snapshot.forEach((docEntry) => {
            const dreamData = docEntry.data();
            const dreamId = docEntry.id;
            const dreamDate = dreamData.timestamp && dreamData.timestamp.toDate ?
                             new Date(dreamData.timestamp.toDate()).toLocaleDateString() :
                             'N/A';
            const dreamTitle = dreamData.dreamTitle || 'Untitled Dream';
            const analysisTextContent = dreamData.analysisText;

            let displayAnalysisSummary = '';
            try {
                const parsedAnalysis = JSON.parse(analysisTextContent);
                displayAnalysisSummary = `Actions: ${parsedAnalysis.actionsPerformed || 'N/A'}. Emotions: ${parsedAnalysis.emotionalContent || 'N/A'}. Location: ${parsedAnalysis.location || 'N/A'}.`;
            } catch (e) {
                displayAnalysisSummary = analysisTextContent;
            }

            const dreamItem = document.createElement('div');
            dreamItem.classList.add('archive-item');
            dreamItem.innerHTML = `
                <div class="archive-item-content">
                    <h4 class="font-semibold text-purple-600 mb-1">${dreamTitle} (${dreamDate})</h4>
                    <p class="text-gray-700 text-sm mb-2"><strong>Your Dream:</strong> ${dreamData.dreamText.substring(0, 150)}...</p>
                    <p class="text-gray-600 text-sm"><strong>Summary:</strong> ${displayAnalysisSummary}</p>
                </div>
                <div class="archive-item-actions">
                    <button class="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 view-details-button" data-id="${dreamId}">View Details</button>
                    <button class="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 delete-archived-button" data-id="${dreamId}">Delete</button>
                </div>
            `;
            if (archivedDreamsList) archivedDreamsList.appendChild(dreamItem);

            dreamItem.querySelector('.view-details-button').addEventListener('click', () => {
                displayArchivedDreamDetails(dreamData);
            });
            dreamItem.querySelector('.delete-archived-button').addEventListener('click', () => {
                deleteArchivedDream(dreamId);
            });
        });
    }, (error) => {
        hideLoading();
        console.error("Error loading archived dreams:", error);
        showMessage('error', `Failed to load archived dreams: ${error.message}`);
    });
}

/**
 * Displays the detailed analysis of an archived dream in a modal.
 * @param {object} dreamData - The data of the dream to display.
 */
function displayArchivedDreamDetails(dreamData) {
    const viewDreamDetailsModal = document.getElementById('view-dream-details-modal');
    const viewDreamDetailsTitle = document.getElementById('view-dream-details-title');
    const viewDreamText = document.getElementById('view-dream-text');
    const viewAnalysisContent = document.getElementById('view-analysis-content');

    if (!viewDreamDetailsModal || !viewDreamDetailsTitle || !viewDreamText || !viewAnalysisContent) {
        console.error("Missing UI elements for dream details modal.");
        return;
    }

    viewDreamDetailsTitle.textContent = dreamData.dreamTitle || 'Untitled Dream';
    viewDreamText.textContent = dreamData.dreamText;
    viewAnalysisContent.innerHTML = ''; // Clear previous content

    try {
        const parsedAnalysis = JSON.parse(dreamData.analysisText);
        const analysisHeadings = {
            "actionsPerformed": "Actions Performed",
            "location": "Location",
            "timeInDream": "Time in Dream",
            "movementsThroughTime": "Movements Through Time",
            "emotionalContent": "Emotional Content",
            "surfacePsychologicalContent": "Surface Psychological Content",
            "workDoneInDream": "Work Done Within the Dream",
            "familiarPersonsSpokenTo": "Familiar Persons Spoken To",
            "relationToPastEvents": "Relation to Past Events",
            "relationToFutureEvents": "Relation to Future Events",
            "messagesReceived": "Messages Given or Received",
            "awarenessOfSpace": "Awareness of Space"
        };

        for (const key in analysisHeadings) {
            if (parsedAnalysis[key] && parsedAnalysis[key].trim() !== '') {
                const div = document.createElement('div');
                div.classList.add('analysis-section-item');
                const h4 = document.createElement('h4');
                h4.textContent = analysisHeadings[key];
                const p = document.createElement('p');
                p.textContent = parsedAnalysis[key];
                div.appendChild(h4);
                div.appendChild(p);
                viewAnalysisContent.appendChild(div);
            }
        }
    } catch (jsonError) {
        console.error("Failed to parse JSON for archived dream details:", jsonError);
        const p = document.createElement('p');
        p.textContent = "Error: Could not display detailed analysis. Raw content: " + dreamData.analysisText;
        viewAnalysisContent.appendChild(p);
    }
    viewDreamDetailsModal.classList.remove('hidden');
}

/**
 * Loads and displays dreams that have a matched reality event from Firestore.
 */
export async function loadMatchedDreams() {
    const matchedDreamsList = document.getElementById('matched-dreams-list');
    if (!userId || !isAuthReady) {
        if (matchedDreamsList) matchedDreamsList.innerHTML = '<p class="text-gray-500">Please sign in to see your matched dreams.</p>';
        return;
    }

    if (matchedDreamsList) matchedDreamsList.innerHTML = '<p class="text-gray-500">Loading matched dreams...</p>';
    showLoading();

    const q = query(
        collection(db, `artifacts/${appId}/users/${userId}/archived_dreams`),
        orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snapshot) => {
        hideLoading();
        if (matchedDreamsList) matchedDreamsList.innerHTML = ''; // Clear previous content

        let hasMatches = false;
        snapshot.forEach((docEntry) => {
            const dreamData = docEntry.data();
            const matchedEvent = dreamData.matchedRealityEvent || '';

            if (matchedEvent) { // Filter in JavaScript
                hasMatches = true;
                const dreamDate = dreamData.timestamp && dreamData.timestamp.toDate ?
                                 new Date(dreamData.timestamp.toDate()).toLocaleString() :
                                 'N/A';
                const dreamTitle = dreamData.dreamTitle || 'Untitled Dream';

                const dreamItem = document.createElement('div');
                dreamItem.classList.add('p-4', 'bg-white', 'rounded-lg', 'shadow-sm', 'border', 'border-blue-200', 'flex', 'flex-col', 'md:flex-row', 'gap-4', 'mb-4');

                dreamItem.innerHTML = `
                    <div class="flex-1 p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <h4 class="font-semibold text-blue-700 mb-1">${dreamTitle} (${dreamDate})</h4>
                        <p class="text-gray-700 text-sm mb-2"><strong>Dream:</strong> ${dreamData.dreamText}</p>
                    </div>
                    <div class="flex-1 p-2 bg-green-50 rounded-lg border border-green-100">
                        <h4 class="font-semibold text-green-700 mb-1">Matched Reality Event:</h4>
                        <p class="text-gray-700 text-sm">${matchedEvent}</p>
                    </div>
                `;
                if (matchedDreamsList) matchedDreamsList.appendChild(dreamItem);
            }
        });

        if (!hasMatches) {
            if (matchedDreamsList) matchedDreamsList.innerHTML = '<p class="text-gray-600">No dream-reality matches found yet. Use the \'Search\' tab to find dreams and add matches.</p>';
        }
    }, (error) => {
        hideLoading();
        console.error("Error loading matched dreams:", error);
        showMessage('error', `Failed to load matched dreams: ${error.message}`);
    });
}

/**
 * Loads dreams for analysis based on the selected time scope.
 * This function now loads from archived_dreams.
 */
export async function loadDreamsForAnalysisTab() {
    const perDreamAnalysisList = document.getElementById('per-dream-analysis-list');
    if (!userId || !isAuthReady) {
        if (perDreamAnalysisList) perDreamAnalysisList.innerHTML = '<p class="text-gray-500">Please sign in to load dreams for analysis.</p>';
        return;
    }

    const timeScopeSelect = document.getElementById('time-scope-select');
    const analyzeDreamInAnalysisTabButton = document.getElementById('analyze-dream-in-analysis-tab');

    const selectedScope = timeScopeSelect ? timeScopeSelect.value : 'allTime'; // Default if element not found
    if (perDreamAnalysisList) perDreamAnalysisList.innerHTML = '<p class="text-gray-500">Loading dreams...</p>';
    showLoading();

    let q;

    console.log(`loadDreamsForAnalysisTab: Selected scope: ${selectedScope}`);

    // Always query archived dreams
    q = query(
        collection(db, `artifacts/${appId}/users/${userId}/archived_dreams`),
        orderBy("timestamp", "desc")
    );

    try {
        const snapshot = await getDocs(q);
        let fetchedDreams = [];
        console.log(`Found ${snapshot.size} archived dreams.`);
        snapshot.forEach(doc => {
            const dreamData = doc.data();
            fetchedDreams.push({ id: doc.id, ...dreamData });
        });

        const now = new Date();
        let startDate;

        // Filter dreams based on time scope in JavaScript
        switch (selectedScope) {
            case 'lastNight':
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0); // Start of today (midnight)
                dreamsToAnalyze = fetchedDreams.filter(dream => {
                    const dreamTimestamp = dream.timestamp ? dream.timestamp.toDate().getTime() : 0;
                    return dreamTimestamp >= startDate.getTime();
                });
                if (perDreamAnalysisList) perDreamAnalysisList.classList.remove('hidden'); // Show the list for individual dreams
                if (analyzeDreamInAnalysisTabButton) analyzeDreamInAnalysisTabButton.classList.add('hidden'); // Hide the main button for 'lastNight'
                break;
            case 'last7Days':
                startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                dreamsToAnalyze = fetchedDreams.filter(dream => {
                    const dreamTimestamp = dream.timestamp ? dream.timestamp.toDate().getTime() : 0;
                    return dreamTimestamp >= startDate.getTime();
                });
                if (perDreamAnalysisList) perDreamAnalysisList.classList.add('hidden'); // Hide for holistic view
                if (analyzeDreamInAnalysisTabButton) {
                    analyzeDreamInAnalysisTabButton.classList.remove('hidden'); // Show the main button
                    analyzeDreamInAnalysisTabButton.textContent = 'Analyze Dreams Holistically'; // Change text to plural
                    analyzeDreamInAnalysisTabButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                    analyzeDreamInAnalysisTabButton.classList.add('bg-purple-600', 'hover:bg-purple-700');
                }
                break;
            case 'last30Days':
                startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                dreamsToAnalyze = fetchedDreams.filter(dream => {
                    const dreamTimestamp = dream.timestamp ? dream.timestamp.toDate().getTime() : 0;
                    return dreamTimestamp >= startDate.getTime();
                });
                if (perDreamAnalysisList) perDreamAnalysisList.classList.add('hidden');
                if (analyzeDreamInAnalysisTabButton) {
                    analyzeDreamInAnalysisTabButton.classList.remove('hidden');
                    analyzeDreamInAnalysisTabButton.textContent = 'Analyze Dreams Holistically';
                    analyzeDreamInAnalysisTabButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                    analyzeDreamInAnalysisTabButton.classList.add('bg-purple-600', 'hover:bg-purple-700');
                }
                break;
            case 'lastYear':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                dreamsToAnalyze = fetchedDreams.filter(dream => {
                    const dreamTimestamp = dream.timestamp ? dream.timestamp.toDate().getTime() : 0;
                    return dreamTimestamp >= startDate.getTime();
                });
                if (perDreamAnalysisList) perDreamAnalysisList.classList.add('hidden');
                if (analyzeDreamInAnalysisTabButton) {
                    analyzeDreamInAnalysisTabButton.classList.remove('hidden');
                    analyzeDreamInAnalysisTabButton.textContent = 'Analyze Dreams Holistically';
                    analyzeDreamInAnalysisTabButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                    analyzeDreamInAnalysisTabButton.classList.add('bg-purple-600', 'hover:bg-purple-700');
                }
                break;
            case 'allTime':
                dreamsToAnalyze = fetchedDreams; // No date filtering needed for all time
                if (perDreamAnalysisList) perDreamAnalysisList.classList.add('hidden');
                if (analyzeDreamInAnalysisTabButton) {
                    analyzeDreamInAnalysisTabButton.classList.remove('hidden');
                    analyzeDreamInAnalysisTabButton.textContent = 'Analyze Dreams Holistically';
                    analyzeDreamInAnalysisTabButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                    analyzeDreamInAnalysisTabButton.classList.add('bg-purple-600', 'hover:bg-purple-700');
                }
                break;
            default:
                if (perDreamAnalysisList) perDreamAnalysisList.innerHTML = '<p class="text-gray-500">Invalid time scope selected.</p>';
                if (analyzeDreamInAnalysisTabButton) analyzeDreamInAnalysisTabButton.classList.add('hidden');
                return;
        }

        // Always sort the dreams in JavaScript after filtering
        dreamsToAnalyze.sort((a, b) => {
            const timestampA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const timestampB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return timestampB - timestampA; // Sort descending (most recent first)
        });

        if (perDreamAnalysisList) perDreamAnalysisList.innerHTML = ''; // Clear previous content

        if (selectedScope === 'lastNight') {
            if (dreamsToAnalyze.length === 0) {
                if (perDreamAnalysisList) perDreamAnalysisList.innerHTML = '<p class="text-gray-500">No archived dreams logged from last night.</p>';
            } else {
                dreamsToAnalyze.forEach((dreamData, index) => {
                    const dreamDate = dreamData.timestamp && dreamData.timestamp.toDate ?
                                     new Date(dreamData.timestamp.toDate()).toLocaleString() :
                                     'N/A';
                    const snippet = dreamData.dreamText.substring(0, 100) + (dreamData.dreamText.length > 100 ? '...' : '');
                    const dreamTitle = dreamData.dreamTitle || 'Untitled Dream';
                    const dreamItem = document.createElement('div');
                    dreamItem.classList.add('draft-item', 'cursor-pointer');
                    dreamItem.innerHTML = `
                        <div class="draft-item-content">
                            <p class="text-gray-700 text-sm font-semibold">${dreamTitle} (${dreamDate})</p>
                            <p class="text-gray-600 text-xs mt-1">${snippet}</p>
                        </div>
                        <button class="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 analyze-single-dream-button" data-index="${index}">View Analysis</button>
                    `;
                    if (perDreamAnalysisList) perDreamAnalysisList.appendChild(dreamItem);
                });
                // Add event listeners for the dynamically created analyze buttons
                document.querySelectorAll('.analyze-single-dream-button').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const index = event.target.dataset.index;
                        const dreamData = dreamsToAnalyze[index];
                        displayIndividualAnalysis(dreamData); // Display pre-existing analysis
                    });
                });
            }
        } else {
            if (dreamsToAnalyze.length === 0) {
                // No message here, as the main analyze button will handle it
            } else {
                // No message here, as the main analyze button will handle it
            }
        }
        const analysisContent = document.getElementById('analysis-content');
        const dreamAnalysisOutput = document.getElementById('dream-analysis-output');
        if (analysisContent) analysisContent.innerHTML = ''; // Clear previous analysis output
        if (dreamAnalysisOutput) dreamAnalysisOutput.classList.add('hidden');
    } catch (error) {
        console.error("Error loading dreams for analysis scope:", error);
        showMessage('error', `Failed to load dreams for analysis: ${error.message}`);
        if (perDreamAnalysisList) perDreamAnalysisList.innerHTML = '<p class="text-red-500">Error loading dreams for analysis.</p>';
    } finally {
        hideLoading();
    }
}

/**
 * Displays individual archived dream analysis based on selected format.
 * @param {object} dreamData - The data of the dream whose analysis is to be displayed.
 */
function displayIndividualAnalysis(dreamData) {
    const analysisContent = document.getElementById('analysis-content');
    const dreamAnalysisOutput = document.getElementById('dream-analysis-output');
    const outputFormatRadios = document.querySelectorAll('input[name="output-format"]');

    if (!analysisContent || !dreamAnalysisOutput || outputFormatRadios.length === 0) {
        console.error("Missing UI elements for individual analysis display.");
        return;
    }

    analysisContent.innerHTML = ''; // Clear previous content
    const selectedFormatForDisplay = document.querySelector('input[name="output-format"]:checked').value;

    try {
        const analysisOutputJsonString = dreamData.analysisText; // Get the raw JSON string
        if (!analysisOutputJsonString) {
            analysisContent.innerHTML = '<p>No detailed analysis available for this dream.</p>';
            dreamAnalysisOutput.classList.remove('hidden');
            return;
        }

        const parsedAnalysis = JSON.parse(analysisOutputJsonString);

        if (selectedFormatForDisplay === 'summary') {
            const summaryText = `Actions: ${parsedAnalysis.actionsPerformed || 'N/A'}. Emotions: ${parsedAnalysis.emotionalContent || 'N/A'}. Location: ${parsedAnalysis.location || 'N/A'}.`;
            const p = document.createElement('p');
            p.textContent = summaryText;
            analysisContent.appendChild(p);
        } else if (selectedFormatForDisplay === 'expanded') {
            const analysisHeadings = {
                "actionsPerformed": "Actions Performed",
                "location": "Location",
                "timeInDream": "Time in Dream",
                "movementsThroughTime": "Movements Through Time",
                "emotionalContent": "Emotional Content",
                "surfacePsychologicalContent": "Surface Psychological Content",
                "workDoneInDream": "Work Done Within the Dream",
                "familiarPersonsSpokenTo": "Familiar Persons Spoken To",
                "relationToPastEvents": "Relation to Past Events",
                "relationToFutureEvents": "Relation to Future Events",
                "messagesReceived": "Messages Given or Received",
                "awarenessOfSpace": "Awareness of Space"
            };

            for (const key in analysisHeadings) {
                if (parsedAnalysis[key]) {
                    const div = document.createElement('div');
                    div.classList.add('analysis-section-item');
                    const h4 = document.createElement('h4');
                    h4.textContent = analysisHeadings[key];
                    const p = document.createElement('p');
                    p.textContent = parsedAnalysis[key];
                    div.appendChild(h4);
                    div.appendChild(p);
                    analysisContent.appendChild(div);
                }
            }
        }
        dreamAnalysisOutput.classList.remove('hidden');
    } catch (jsonError) {
        console.error("Failed to parse JSON for displayIndividualAnalysis:", jsonError);
        const p = document.createElement('p');
        p.textContent = "Error: Could not display detailed analysis. Raw content: " + dreamData.analysisText;
        analysisContent.appendChild(p);
        dreamAnalysisOutput.classList.remove('hidden');
    }
}

/**
 * Performs dream analysis using the Gemini API.
 * @param {string} dreamText - The text content of the dream(s) to analyze.
 * @param {string} dreamTitle - The title of the dream (optional, for single dream analysis).
 * @param {boolean} forArchiving - True if analysis is for archiving, false for display only.
 * @returns {Promise<string|null>} The raw JSON string of the analysis or null if failed.
 */
export async function performDreamAnalysis(dreamText, dreamTitle = '', forArchiving = false) {
    const loadingDreamAnalysis = document.getElementById('loading-dream-analysis');
    const analyzeDreamInAnalysisTabButton = document.getElementById('analyze-dream-in-analysis-tab');
    const analysisContent = document.getElementById('analysis-content');
    const dreamAnalysisOutput = document.getElementById('dream-analysis-output');
    const outputFormatRadios = document.querySelectorAll('input[name="output-format"]');


    if (!userId || !isAuthReady) {
        showMessage('error', 'Please sign in to analyze dreams.');
        return null;
    }

    if (loadingDreamAnalysis) loadingDreamAnalysis.classList.remove('hidden');
    if (analyzeDreamInAnalysisTabButton) analyzeDreamInAnalysisTabButton.disabled = true;

    let prompt;
    let payload;

    const fullDreamText = dreamTitle ? `Title: ${dreamTitle}\nDream: ${dreamText}` : dreamText;

    // ALWAYS request expanded JSON for saving, regardless of user's display preference
    prompt = `Analyze the following dream(s) and provide a structured JSON response with these keys:
    "actionsPerformed": Summarize actions.
    "location": Describe the location.
    "timeInDream": Indicate the time.
    "movementsThroughTime": Describe any time shifts.
    "emotionalContent": Detail emotions felt.
    "surfacePsychologicalContent": Explain surface psychological aspects.
    "workDoneInDream": Describe any "work" or processing.
    "familiarPersonsSpokenTo": List familiar persons spoken to.
    "relationToPastEvents": Relate to past events.
    "relationToFutureEvents": Relate to future events.
    "messagesReceived": Any messages given or received.
    "awarenessOfSpace": Comment on spatial awareness.

    Dream(s): "${fullDreamText}"`;

    payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "actionsPerformed": { "type": "STRING" },
                    "location": { "type": "STRING" },
                    "timeInDream": { "type": "STRING" },
                    "movementsThroughTime": { "type": "STRING" },
                    "emotionalContent": { "type": "STRING" },
                    "surfacePsychologicalContent": { "type": "STRING" },
                    "workDoneInDream": { "type": "STRING" },
                    "familiarPersonsSpokenTo": { "type": "STRING" },
                    "relationToPastEvents": { "type": "STRING" },
                    "relationToFutureEvents": { "type": "STRING" },
                    "messagesReceived": { "type": "STRING" },
                    "awarenessOfSpace": { "type": "STRING" }
                },
                required: [
                    "actionsPerformed", "location", "timeInDream", "movementsThroughTime",
                    "emotionalContent", "surfacePsychologicalContent", "workDoneInDream",
                    "familiarPersonsSpokenTo", "relationToPastEvents", "relationToFutureEvents",
                    "messagesReceived", "awarenessOfSpace"
                ]
            }
        }
    };

    console.log("Sending prompt to Gemini:", prompt);

    const apiKey = ""; // Canvas will provide this
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const analysisOutputJsonString = result.candidates[0].content.parts[0].text; // This is the JSON string

            if (!forArchiving) { // Only display if not for direct archiving
                if (analysisContent) analysisContent.innerHTML = ''; // Clear previous content
                const selectedFormatForDisplay = document.querySelector('input[name="output-format"]:checked').value;
                if (selectedFormatForDisplay === 'summary') {
                    try {
                        const parsedAnalysis = JSON.parse(analysisOutputJsonString);
                        const summaryText = `Actions: ${parsedAnalysis.actionsPerformed || 'N/A'}. Emotions: ${parsedAnalysis.emotionalContent || 'N/A'}. Location: ${parsedAnalysis.location || 'N/A'}.`;
                        const p = document.createElement('p');
                        p.textContent = summaryText;
                        if (analysisContent) analysisContent.appendChild(p);
                    } catch (jsonError) {
                        console.error("Failed to parse JSON for summary display:", jsonError);
                        const p = document.createElement('p');
                        p.textContent = "Error: Could not generate summary. Raw output: " + analysisOutputJsonString;
                        if (analysisContent) analysisContent.appendChild(p);
                    }
                } else if (selectedFormatForDisplay === 'expanded') {
                    try {
                        const parsedAnalysis = JSON.parse(analysisOutputJsonString);
                        const analysisHeadings = {
                            "actionsPerformed": "Actions Performed",
                            "location": "Location",
                            "timeInDream": "Time in Dream",
                            "movementsThroughTime": "Movements Through Time",
                            "emotionalContent": "Emotional Content",
                            "surfacePsychologicalContent": "Surface Psychological Content",
                            "workDoneInDream": "Work Done Within the Dream",
                            "familiarPersonsSpokenTo": "Familiar Persons Spoken To",
                            "relationToPastEvents": "Relation to Past Events",
                            "relationToFutureEvents": "Relation to Future Events",
                            "messagesReceived": "Messages Given or Received",
                            "awarenessOfSpace": "Awareness of Space"
                        };

                        for (const key in analysisHeadings) {
                            if (parsedAnalysis[key]) {
                                const div = document.createElement('div');
                                div.classList.add('analysis-section-item');
                                const h4 = document.createElement('h4');
                                h4.textContent = analysisHeadings[key];
                                const p = document.createElement('p');
                                p.textContent = parsedAnalysis[key];
                                div.appendChild(h4);
                                div.appendChild(p);
                                if (analysisContent) analysisContent.appendChild(div);
                            }
                        }
                    } catch (jsonError) {
                        console.error("Failed to parse JSON analysis for expanded display:", jsonError);
                        const p = document.createElement('p');
                        p.textContent = "Error: Could not parse expanded analysis. Raw output: " + analysisOutputJsonString;
                        if (analysisContent) analysisContent.appendChild(p);
                    }
                }
                if (dreamAnalysisOutput) dreamAnalysisOutput.classList.remove('hidden');
            }
            return analysisOutputJsonString; // Return the full JSON string
        } else {
            showMessage('error', 'Could not analyze dream. Please try again.');
            if (analysisContent) analysisContent.innerHTML = 'Failed to get analysis.';
            if (dreamAnalysisOutput) dreamAnalysisOutput.classList.add('hidden');
            return null;
        }
    } catch (error) {
        console.error("Dream analysis error:", error);
        showMessage('error', `Dream analysis failed: ${error.message}`);
        if (analysisContent) analysisContent.innerHTML = `Error during analysis: ${error.message}`;
        if (dreamAnalysisOutput) dreamAnalysisOutput.classList.add('hidden');
        return null;
    } finally {
        if (loadingDreamAnalysis) loadingDreamAnalysis.classList.add('hidden');
        if (analyzeDreamInAnalysisTabButton) analyzeDreamInAnalysisTabButton.disabled = false;
    }
}

/**
 * Initializes event listeners for the Dreams module.
 * This function should be called once the DOM is loaded and Firebase is ready.
 * UI elements are now fetched within this function to ensure they exist.
 */
export function initializeDreamsModule() {
    const dreamTitleDraft = document.getElementById('dream-title-draft');
    const dreamInputDraft = document.getElementById('dream-input-draft');
    const addDreamButton = document.getElementById('add-dream-button');
    const analyzeDreamInAnalysisTabButton = document.getElementById('analyze-dream-in-analysis-tab');
    const timeScopeSelect = document.getElementById('time-scope-select');
    const saveMatchButton = document.getElementById('save-match-button');
    const cancelMatchButton = document.getElementById('cancel-match-button');
    const closeDreamDetailsButton = document.getElementById('close-dream-details-button');
    const addMatchModal = document.getElementById('add-match-modal');
    const matchedEventInput = document.getElementById('matched-event-input');


    // Event listener for Add Dream button (replaces save-draft-changes-button and adds new manual dreams)
    if (addDreamButton) {
        addDreamButton.addEventListener('click', async () => {
            const dreamText = dreamInputDraft ? dreamInputDraft.value.trim() : '';
            const dreamTitle = dreamTitleDraft ? dreamTitleDraft.value.trim() : '';
            if (!dreamText) {
                showMessage('info', 'Please enter some text for your dream.');
                return;
            }

            try {
                if (currentDraftId) {
                    // If currentDraftId is set, it means we are editing an existing draft
                    // When editing, we should reset isPreAnalyzed to false as content might change
                    await updateDraftDream(currentDraftId, dreamText, dreamTitle, false);
                    currentDraftId = null; // Clear currentDraftId after update
                    showMessage('success', 'Draft dream updated!');
                } else {
                    // If no currentDraftId, save as a new draft
                    await saveDraftDream(dreamText, dreamTitle);
                    showMessage('success', 'New dream added to drafts!');
                }
                if (dreamInputDraft) dreamInputDraft.value = ''; // Clear input after adding/updating
                if (dreamTitleDraft) dreamTitleDraft.value = ''; // Clear title input
                loadDraftDreams(); // Reload drafts to show updated list
            } catch (error) {
                console.error("Error adding/updating dream:", error);
                showMessage('error', `Failed to add/update dream: ${error.message}`);
            }
        });
    }


    // Event listener for Analyze Dream button in Analysis Tab
    if (analyzeDreamInAnalysisTabButton) {
        analyzeDreamInAnalysisTabButton.addEventListener('click', async () => {
            const selectedScope = timeScopeSelect ? timeScopeSelect.value : 'allTime';
            const outputFormatRadios = document.querySelectorAll('input[name="output-format"]');
            const selectedFormat = outputFormatRadios.length > 0 ? document.querySelector('input[name="output-format"]:checked').value : 'summary';


            if (selectedScope === 'lastNight') {
                if (dreamsToAnalyze.length === 0) {
                    showMessage('info', 'No archived dreams found for last night. Please pre-analyse dreams in the \'Drafts\' tab first.');
                } else {
                    showMessage('info', 'For "Last Night" analysis, please click the "View Analysis" button next to each dream in the list above.');
                }
                return;
            }

            // For holistic analysis (last7Days, last30Days, lastYear, allTime)
            if (dreamsToAnalyze.length === 0) {
                showMessage('info', `No archived dreams found for ${selectedScope} to analyze. Please pre-analyse dreams in the 'Drafts' tab first.`);
                return;
            }

            let dreamTextForAnalysis = dreamsToAnalyze.map(d => {
                const titlePart = d.dreamTitle ? `Title: ${d.dreamTitle}\n` : '';
                return `${titlePart}Dream: ${d.dreamText}`;
            }).join('\n\n---\n\n');

            if (!dreamTextForAnalysis) {
                showMessage('info', `No archived dreams found for ${selectedScope} to perform holistic analysis.`);
                return;
            }

            // For holistic analysis, we don't have a single title, so pass empty string
            // The `forArchiving` flag is false as this is just for display.
            await performDreamAnalysis(dreamTextForAnalysis, '', false);
        });
    }

    // Event listener for time scope selection change
    if (timeScopeSelect) {
        timeScopeSelect.addEventListener('change', loadDreamsForAnalysisTab);
    }

    // Event listeners for match modal
    if (saveMatchButton) {
        saveMatchButton.addEventListener('click', async () => {
            if (!currentDreamIdForMatch) {
                showMessage('error', 'No dream selected for matching.');
                return;
            }
            const matchedEventText = matchedEventInput ? matchedEventInput.value.trim() : '';
            if (!matchedEventText) {
                showMessage('info', 'Please describe the matched reality event.');
                return;
            }

            showLoading();
            try {
                const dreamRef = doc(db, `artifacts/${appId}/users/${userId}/archived_dreams`, currentDreamIdForMatch);
                await updateDoc(dreamRef, {
                    matchedRealityEvent: matchedEventText
                });
                showMessage('success', 'Reality match saved!');
                if (addMatchModal) addMatchModal.classList.add('hidden');
                if (matchedEventInput) matchedEventInput.value = ''; // Clear input
                currentDreamIdForMatch = null; // Clear selected dream
                loadMatchedDreams(); // Refresh the list of matched dreams
                // If we are on the search tab, re-run search to update the match status
                // This cross-module call will be handled by app.js later. For now, just a console log.
                console.log("Match saved. If on Search tab, remember to refresh search results.");
            } catch (error) {
                console.error("Error saving reality match:", error);
                showMessage('error', `Failed to save reality match: ${error.message}`);
            } finally {
                hideLoading();
            }
        });
    }

    if (cancelMatchButton) {
        cancelMatchButton.addEventListener('click', () => {
            if (addMatchModal) addMatchModal.classList.add('hidden');
            if (matchedEventInput) matchedEventInput.value = '';
            currentDreamIdForMatch = null;
        });
    }

    if (closeDreamDetailsButton) {
        closeDreamDetailsButton.addEventListener('click', () => {
            const viewDreamDetailsModal = document.getElementById('view-dream-details-modal');
            if (viewDreamDetailsModal) viewDreamDetailsModal.classList.add('hidden');
        });
    }
}

/**
 * Exported function to open the match modal from the search module.
 * @param {string} dreamId - The ID of the dream to match.
 * @param {string} dreamText - The text of the dream to display in the modal.
 * @param {string} [existingMatchText=''] - Existing matched event text if editing.
 */
export function openMatchModalForSearch(dreamId, dreamText, existingMatchText = '') {
    const addMatchModal = document.getElementById('add-match-modal');
    const matchDreamSnippet = document.getElementById('match-dream-snippet');
    const matchedEventInput = document.getElementById('matched-event-input');

    if (!addMatchModal || !matchDreamSnippet || !matchedEventInput) {
        console.error("Missing UI elements for match modal.");
        showMessage('error', 'Could not open match modal due to missing UI elements.');
        return;
    }

    currentDreamIdForMatch = dreamId;
    matchDreamSnippet.textContent = dreamText.substring(0, 200) + (dreamText.length > 200 ? '...' : '');
    matchedEventInput.value = existingMatchText;
    addMatchModal.classList.remove('hidden');
}
