// app.js

// Import all necessary modules
import { auth, initializeFirebase, userId, isAuthReady, setupAuthUIListeners } from './firebase-init.js';
import { showLoginScreen, showMainAppScreen, showMessage } from './ui-utils.js';
import { initializeRecordModule } from './record-module.js';
import {
    initializeDreamsModule, loadDraftDreams, loadArchivedDreams,
    loadMatchedDreams, loadDreamsForAnalysisTab
} from './dreams-module.js';
import {
    initializeRealityModule, loadDailyEvents, startNewConversation
} from './reality-module.js';
import { initializeSearchModule } from './search-module.js';
import {
    initializeStatsModule, loadStats, loadDetailedDreamStats, loadTopInsights
} from './stats-module.js';

/**
 * Shows a specific main tab and hides all others.
 * Also manages theme switching based on the active tab.
 * @param {string} tabId - The ID of the tab to show ('record', 'dreams', 'reality', 'search', 'stats').
 */
function showTab(tabId) {
    // Get UI Elements - Main Tabs (now fetched when needed)
    const tabRecord = document.getElementById('tab-record');
    const tabDreams = document.getElementById('tab-dreams');
    const tabReality = document.getElementById('tab-reality');
    const tabSearch = document.getElementById('tab-search');
    const tabStats = document.getElementById('tab-stats');

    // Get UI Elements - Sections (now fetched when needed)
    const recordSection = document.getElementById('record-section');
    const dreamsSection = document.getElementById('dreams-section');
    const realitySection = document.getElementById('reality-section');
    const searchSection = document.getElementById('search-section');
    const statsSection = document.getElementById('stats-section');

    // Hide all main sections
    recordSection.classList.add('hidden');
    dreamsSection.classList.add('hidden');
    realitySection.classList.add('hidden');
    searchSection.classList.add('hidden');
    statsSection.classList.add('hidden');

    // Deactivate all main tab buttons
    tabRecord.classList.remove('active-tab');
    tabDreams.classList.remove('active-tab');
    tabReality.classList.remove('active-tab');
    tabSearch.classList.remove('active-tab');
    tabStats.classList.remove('active-tab');

    // Set default theme to bright
    document.getElementById('meta-theme-color').content = '#f0eaff';
    document.body.classList.remove('dark-theme-record');

    // Show the selected section and activate its button
    switch (tabId) {
        case 'record':
            recordSection.classList.remove('hidden');
            tabRecord.classList.add('active-tab');
            document.getElementById('meta-theme-color').content = '#1a202c'; // Dark theme for record
            document.body.classList.add('dark-theme-record');
            break;
        case 'dreams':
            dreamsSection.classList.remove('hidden');
            tabDreams.classList.add('active-tab');
            // Default to Drafts sub-tab if no other sub-tab is active
            showDreamsSubTab('drafts');
            break;
        case 'reality':
            realitySection.classList.remove('hidden');
            tabReality.classList.add('active-tab');
            // Default to Daily Events sub-tab if no other sub-tab is active
            showRealitySubTab('daily-events');
            break;
        case 'search':
            searchSection.classList.remove('hidden');
            tabSearch.classList.add('active-tab');
            break;
        case 'stats':
            statsSection.classList.remove('hidden');
            tabStats.classList.add('active-tab');
            // Default to Totals sub-tab if no other sub-tab is active
            showStatsSubTab('totals');
            break;
    }
}

/**
 * Shows a specific sub-tab within the Dreams section and hides others.
 * @param {string} subTabId - The ID of the Dreams sub-tab to show ('drafts', 'analysis', 'archive', 'matches').
 */
function showDreamsSubTab(subTabId) {
    // Get UI Elements - Dreams Sub-tabs and their sections (now fetched when needed)
    const subtabDrafts = document.getElementById('subtab-drafts');
    const subtabAnalysis = document.getElementById('subtab-analysis');
    const subtabArchive = document.getElementById('subtab-archive');
    const subtabMatches = document.getElementById('subtab-matches');

    const draftsSection = document.getElementById('drafts-section');
    const analysisSection = document.getElementById('analysis-section');
    const archiveSection = document.getElementById('archive-section');
    const matchesSection = document.getElementById('matches-section');

    // Hide all Dreams sub-sections
    draftsSection.classList.add('hidden');
    analysisSection.classList.add('hidden');
    archiveSection.classList.add('hidden');
    matchesSection.classList.add('hidden');

    // Deactivate all Dreams sub-tab buttons
    subtabDrafts.classList.remove('active-tab');
    subtabAnalysis.classList.remove('active-tab');
    subtabArchive.classList.remove('active-tab');
    subtabMatches.classList.remove('active-tab');

    // Show the selected sub-section and activate its button
    switch (subTabId) {
        case 'drafts':
            draftsSection.classList.remove('hidden');
            subtabDrafts.classList.add('active-tab');
            loadDraftDreams(); // Load data for drafts
            break;
        case 'analysis':
            analysisSection.classList.remove('hidden');
            subtabAnalysis.classList.add('active-tab');
            loadDreamsForAnalysisTab(); // Load dreams for analysis
            break;
        case 'archive':
            archiveSection.classList.remove('hidden');
            subtabArchive.classList.add('active-tab');
            loadArchivedDreams(); // Load data for archived dreams
            break;
        case 'matches':
            matchesSection.classList.remove('hidden');
            subtabMatches.classList.add('active-tab');
            loadMatchedDreams(); // Load data for matched dreams
            break;
    }
}

/**
 * Shows a specific sub-tab within the Reality section and hides others.
 * @param {string} subTabId - The ID of the Reality sub-tab to show ('daily-events', 'ai-chat').
 */
function showRealitySubTab(subTabId) {
    // Get UI Elements - Reality Sub-tabs and their sections (now fetched when needed)
    const subtabDailyEvents = document.getElementById('subtab-daily-events');
    const subtabAiChat = document.getElementById('subtab-ai-chat');

    const dailyEventsSubsection = document.getElementById('daily-events-subsection');
    const aiChatSubsection = document.getElementById('ai-chat-subsection');

    // Hide all Reality sub-sections
    dailyEventsSubsection.classList.add('hidden');
    aiChatSubsection.classList.add('hidden');

    // Deactivate all Reality sub-tab buttons
    subtabDailyEvents.classList.remove('active-tab');
    subtabAiChat.classList.remove('active-tab');

    // Show the selected sub-section and activate its button
    switch (subTabId) {
        case 'daily-events':
            dailyEventsSubsection.classList.remove('hidden');
            subtabDailyEvents.classList.add('active-tab');
            loadDailyEvents(); // Load data for daily events
            break;
        case 'ai-chat':
            aiChatSubsection.classList.remove('hidden');
            subtabAiChat.classList.add('active-tab');
            startNewConversation(); // Start/load chat conversation
            break;
    }
}

/**
 * Shows a specific sub-tab within the Stats section and hides others.
 * @param {string} subTabId - The ID of the Stats sub-tab to show ('totals', 'dream-stats', 'top-insights').
 */
function showStatsSubTab(subTabId) {
    // Get UI Elements - Stats Sub-tabs and their sections (now fetched when needed)
    const subtabTotals = document.getElementById('subtab-totals');
    const subtabDreamStats = document.getElementById('subtab-dream-stats');
    const subtabTopInsights = document.getElementById('subtab-top-insights');

    const totalsSubsection = document.getElementById('totals-subsection');
    const dreamStatsSubsection = document.getElementById('dream-stats-subsection');
    const topInsightsSubsection = document.getElementById('top-insights-subsection');

    // Hide all Stats sub-sections
    totalsSubsection.classList.add('hidden');
    dreamStatsSubsection.classList.add('hidden');
    topInsightsSubsection.classList.add('hidden');

    // Deactivate all Stats sub-tab buttons
    subtabTotals.classList.remove('active-tab');
    subtabDreamStats.classList.remove('active-tab');
    subtabTopInsights.classList.remove('active-tab');

    // Show the selected sub-section and activate its button
    switch (subTabId) {
        case 'totals':
            totalsSubsection.classList.remove('hidden');
            subtabTotals.classList.add('active-tab');
            loadStats(); // Load overall stats
            break;
        case 'dream-stats':
            dreamStatsSubsection.classList.remove('hidden');
            subtabDreamStats.classList.add('active-tab');
            loadDetailedDreamStats(); // Load detailed dream stats
            break;
        case 'top-insights':
            topInsightsSubsection.classList.remove('hidden');
            subtabTopInsights.classList.add('active-tab');
            loadTopInsights(); // Load top insights
            break;
    }
}

/**
 * Main application content initialization function.
 * Called after Firebase is initialized and authentication state is determined.
 * This function now also sets up event listeners for main tabs and sub-tabs.
 */
async function initializeAppContent() {
    // Get UI Elements - Main Tabs (now fetched here)
    const tabRecord = document.getElementById('tab-record');
    const tabDreams = document.getElementById('tab-dreams');
    const tabReality = document.getElementById('tab-reality');
    const tabSearch = document.getElementById('tab-search');
    const tabStats = document.getElementById('tab-stats');

    // Get UI Elements - Dreams Sub-tabs (now fetched here)
    const subtabDrafts = document.getElementById('subtab-drafts');
    const subtabAnalysis = document.getElementById('subtab-analysis');
    const subtabArchive = document.getElementById('subtab-archive');
    const subtabMatches = document.getElementById('subtab-matches');

    // Get UI Elements - Reality Sub-tabs (now fetched here)
    const subtabDailyEvents = document.getElementById('subtab-daily-events');
    const subtabAiChat = document.getElementById('subtab-ai-chat');

    // Get UI Elements - Stats Sub-tabs (now fetched here)
    const subtabTotals = document.getElementById('subtab-totals');
    const subtabDreamStats = document.getElementById('subtab-dream-stats');
    const subtabTopInsights = document.getElementById('subtab-top-insights');

    // Initialize all individual modules
    initializeRecordModule();
    initializeDreamsModule();
    initializeRealityModule();
    initializeSearchModule();
    initializeStatsModule();

    // Set up event listeners for main tabs
    if (tabRecord) tabRecord.addEventListener('click', () => showTab('record'));
    if (tabDreams) tabDreams.addEventListener('click', () => showTab('dreams'));
    if (tabReality) tabReality.addEventListener('click', () => showTab('reality'));
    if (tabSearch) tabSearch.addEventListener('click', () => showTab('search'));
    if (tabStats) tabStats.addEventListener('click', () => showTab('stats'));

    // Set up event listeners for Dreams sub-tabs
    if (subtabDrafts) subtabDrafts.addEventListener('click', () => showDreamsSubTab('drafts'));
    if (subtabAnalysis) subtabAnalysis.addEventListener('click', () => showDreamsSubTab('analysis'));
    if (subtabArchive) subtabArchive.addEventListener('click', () => showDreamsSubTab('archive'));
    if (subtabMatches) subtabMatches.addEventListener('click', () => showDreamsSubTab('matches'));

    // Set up event listeners for Reality sub-tabs
    if (subtabDailyEvents) subtabDailyEvents.addEventListener('click', () => showRealitySubTab('daily-events'));
    if (subtabAiChat) subtabAiChat.addEventListener('click', () => showRealitySubTab('ai-chat'));

    // Set up event listeners for Stats sub-tabs
    if (subtabTotals) subtabTotals.addEventListener('click', () => showStatsSubTab('totals'));
    if (subtabDreamStats) subtabDreamStats.addEventListener('click', () => showStatsSubTab('dream-stats'));
    if (subtabTopInsights) subtabTopInsights.addEventListener('click', () => showStatsSubTab('top-insights'));

    // Initial tab load (default to Record tab)
    showTab('record');
}

// Listen for Firebase authentication state changes
// This listener will be set up by initializeFirebase()
// The setupAuthUIListeners is called here to ensure auth elements are available.
auth.onAuthStateChanged(user => {
    if (user) {
        showMainAppScreen(user.uid);
        // Ensure app elements are available before initializing app content
        initializeAppContent();
    } else {
        showLoginScreen();
    }
    // Setup auth UI listeners after the correct screen is shown
    setupAuthUIListeners();
});

// Initial Firebase initialization. This will trigger onAuthStateChanged.
// This should be called once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
});
