// app.js

// Import all necessary modules
// Removed auth, userId, isAuthReady, setupAuthUIListeners as their logic is now centralized in firebase-init.js
import { initializeFirebase } from './firebase-init.js'; // Keep this import, but its call is handled by firebase-init.js
import { showLoginScreen, showMainAppScreen, showMessage } from './ui-utils.js'; // Still needed for screen display functions
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
    if (tabRecord) tabRecord.classList.remove('active-tab');
    if (tabDreams) tabDreams.classList.remove('active-tab');
    if (tabReality) tabReality.classList.remove('active-tab');
    if (tabSearch) tabSearch.classList.remove('active-tab');
    if (tabStats) tabStats.classList.remove('active-tab');

    // Set default theme to bright
    const metaThemeColor = document.getElementById('meta-theme-color');
    if (metaThemeColor) metaThemeColor.content = '#f0eaff';
    document.body.classList.remove('dark-theme-record');

    // Show the selected section and activate its button
    switch (tabId) {
        case 'record':
            if (recordSection) recordSection.classList.remove('hidden');
            if (tabRecord) tabRecord.classList.add('active-tab');
            if (metaThemeColor) metaThemeColor.content = '#1a202c'; // Dark theme for record
            document.body.classList.add('dark-theme-record');
            break;
        case 'dreams':
            if (dreamsSection) dreamsSection.classList.remove('hidden');
            if (tabDreams) tabDreams.classList.add('active-tab');
            // Default to Drafts sub-tab if no other sub-tab is active
            showDreamsSubTab('drafts');
            break;
        case 'reality':
            if (realitySection) realitySection.classList.remove('hidden');
            if (tabReality) tabReality.classList.add('active-tab');
            // Default to Daily Events sub-tab if no other sub-tab is active
            showRealitySubTab('daily-events');
            break;
        case 'search':
            if (searchSection) searchSection.classList.remove('hidden');
            if (tabSearch) tabSearch.classList.add('active-tab');
            break;
        case 'stats':
            if (statsSection) statsSection.classList.remove('hidden');
            if (tabStats) tabStats.classList.add('active-tab');
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
    if (draftsSection) draftsSection.classList.add('hidden');
    if (analysisSection) analysisSection.classList.add('hidden');
    if (archiveSection) archiveSection.classList.add('hidden');
    if (matchesSection) matchesSection.classList.add('hidden');

    // Deactivate all Dreams sub-tab buttons
    if (subtabDrafts) subtabDrafts.classList.remove('active-tab');
    if (subtabAnalysis) subtabAnalysis.classList.remove('active-tab');
    if (subtabArchive) subtabArchive.classList.remove('active-tab');
    if (subtabMatches) subtabMatches.classList.remove('active-tab');

    // Show the selected sub-section and activate its button
    switch (subTabId) {
        case 'drafts':
            if (draftsSection) draftsSection.classList.remove('hidden');
            if (subtabDrafts) subtabDrafts.classList.add('active-tab');
            loadDraftDreams(); // Load data for drafts
            break;
        case 'analysis':
            if (analysisSection) analysisSection.classList.remove('hidden');
            if (subtabAnalysis) subtabAnalysis.classList.add('active-tab');
            loadDreamsForAnalysisTab(); // Load dreams for analysis
            break;
        case 'archive':
            if (archiveSection) archiveSection.classList.remove('hidden');
            if (subtabArchive) subtabArchive.classList.add('active-tab');
            loadArchivedDreams(); // Load data for archived dreams
            break;
        case 'matches':
            if (matchesSection) matchesSection.classList.remove('hidden');
            if (subtabMatches) subtabMatches.classList.add('active-tab');
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
    if (dailyEventsSubsection) dailyEventsSubsection.classList.add('hidden');
    if (aiChatSubsection) aiChatSubsection.classList.add('hidden');

    // Deactivate all Reality sub-tab buttons
    if (subtabDailyEvents) subtabDailyEvents.classList.remove('active-tab');
    if (subtabAiChat) subtabAiChat.classList.remove('active-tab');

    // Show the selected sub-section and activate its button
    switch (subTabId) {
        case 'daily-events':
            if (dailyEventsSubsection) dailyEventsSubsection.classList.remove('hidden');
            if (subtabDailyEvents) subtabDailyEvents.classList.add('active-tab');
            loadDailyEvents(); // Load data for daily events
            break;
        case 'ai-chat':
            if (aiChatSubsection) aiChatSubsection.classList.remove('hidden');
            if (subtabAiChat) subtabAiChat.classList.add('active-tab');
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
    if (totalsSubsection) totalsSubsection.classList.add('hidden');
    if (dreamStatsSubsection) dreamStatsSubsection.classList.add('hidden');
    if (topInsightsSubsection) topInsightsSubsection.classList.add('hidden');

    // Deactivate all Stats sub-tab buttons
    if (subtabTotals) subtabTotals.classList.remove('active-tab');
    if (subtabDreamStats) subtabDreamStats.classList.remove('active-tab');
    if (subtabTopInsights) subtabTopInsights.classList.remove('active-tab');

    // Show the selected sub-section and activate its button
    switch (subTabId) {
        case 'totals':
            if (totalsSubsection) totalsSubsection.classList.remove('hidden');
            if (subtabTotals) subtabTotals.classList.add('active-tab');
            loadStats(); // Load overall stats
            break;
        case 'dream-stats':
            if (dreamStatsSubsection) dreamStatsSubsection.classList.remove('hidden');
            if (subtabDreamStats) subtabDreamStats.classList.add('active-tab');
            loadDetailedDreamStats(); // Load detailed dream stats
            break;
        case 'top-insights':
            if (topInsightsSubsection) topInsightsSubsection.classList.remove('hidden');
            if (subtabTopInsights) subtabTopInsights.classList.add('active-tab');
            loadTopInsights(); // Load top insights
            break;
    }
}

/**
 * Main application content initialization function.
 * Called after Firebase is initialized and authentication state is determined.
 * This function now also sets up event listeners for main tabs and sub-tabs.
 */
export async function initializeAppContent() { // Exported so firebase-init can call it
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

// Initial Firebase initialization. This will trigger onAuthStateChanged in firebase-init.js
// Removed DOMContentLoaded listener from here. initializeFirebase is called directly from firebase-init.js
// document.addEventListener('DOMContentLoaded', () => {
//     initializeFirebase();
// });
