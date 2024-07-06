let urlQueue = [];
let keywords = [];
let isProcessing = false;
let isPaused = false;
let summary = { processed: 0, total: 0, likesSent: 0, friendRequestsSent: 0, errors: 0 };
let errorLog = [];
let actionLog = [];

function saveState() {
    chrome.storage.local.set({
        urlQueue,
        keywords,
        isProcessing,
        isPaused,
        summary,
        errorLog,
        actionLog
    });
}

function loadState(callback) {
    chrome.storage.local.get([
        'urlQueue',
        'keywords',
        'isProcessing',
        'isPaused',
        'summary',
        'errorLog',
        'actionLog'
    ], function(result) {
        urlQueue = result.urlQueue || [];
        keywords = result.keywords || [];
        isProcessing = result.isProcessing || false;
        isPaused = result.isPaused || false;
        summary = result.summary || { processed: 0, total: 0, likesSent: 0, friendRequestsSent: 0, errors: 0 };
        errorLog = result.errorLog || [];
        actionLog = result.actionLog || [];
        if (callback) callback();
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_automation") {
        urlQueue = request.urls;
        keywords = request.keywords;
        summary = { processed: 0, total: urlQueue.length, likesSent: 0, friendRequestsSent: 0, errors: 0 };
        errorLog = [];
        actionLog = [];
        isPaused = false;
        isProcessing = false;
        saveState();
        processNextUrl();
        sendResponse({ success: true });
    } else if (request.action === "get_error_log") {
        sendResponse({ errorLog: errorLog });
    } else if (request.action === "get_action_log") {
        sendResponse({ actionLog: actionLog });
    } else if (request.action === "pause_automation") {
        isPaused = true;
        saveState();
        sendResponse({ success: true });
    } else if (request.action === "resume_automation") {
        isPaused = false;
        saveState();
        if (!isProcessing) {
            processNextUrl();
        }
        sendResponse({ success: true });
    } else if (request.action === "get_state") {
        sendResponse({
            urlQueue,
            keywords,
            isProcessing,
            isPaused,
            summary,
            errorLog,
            actionLog
        });
    }
    return true;
});

function processNextUrl() {
    if (urlQueue.length === 0 || isPaused) {
        isProcessing = false;
        saveState();
        return;
    }

    isProcessing = true;
    const url = urlQueue.shift();
    saveState();

    chrome.tabs.create({ url: url, active: false }, (tab) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: performActions,
                    args: [keywords, url]
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        handleError(url, "Script injection error: " + chrome.runtime.lastError.message);
                    } else if (results && results[0] && results[0].result) {
                        const result = results[0].result;
                        summary.likesSent += result.liked ? 1 : 0;
                        summary.friendRequestsSent += result.friendRequestSent ? 1 : 0;
                        if (result.error) {
                            summary.errors += 1;
                            errorLog.push({
                                url: url,
                                error: result.errorMessage,
                                conditionsMet: result.conditionsMet
                            });
                        }
                        actionLog.push({
                            url: url,
                            liked: result.liked,
                            friendRequestSent: result.friendRequestSent,
                            conditionsMet: result.conditionsMet
                        });
                    } else {
                        handleError(url, "Unknown error occurred");
                    }
                    summary.processed += 1;
                    saveState();
                    updatePopup();

                    setTimeout(() => {
                        chrome.tabs.remove(tab.id, () => {
                            processNextUrl();
                        });
                    }, 10000);
                });
            }
        });
    });
}

function handleError(url, errorMessage) {
    summary.errors += 1;
    errorLog.push({
        url: url,
        error: errorMessage,
        conditionsMet: []
    });
    actionLog.push({
        url: url,
        liked: false,
        friendRequestSent: false,
        error: errorMessage
    });
    console.error(`Error processing ${url}: ${errorMessage}`);
    saveState();
}

function updatePopup() {
    chrome.runtime.sendMessage({
        action: "update_summary",
        ...summary,
        errorLog: errorLog[errorLog.length - 1],
        actionLog: actionLog[actionLog.length - 1]
    });
}

function performActions(keywords, url) {
    console.log("Content script injected and running for URL:", url);

    function scanForKeywords() {
        const pageText = document.body.innerText.toLowerCase();
        return keywords.map(keyword => {
            const found = pageText.includes(keyword.toLowerCase());
            console.log(`Keyword "${keyword}" found:`, found);
            return { keyword, found };
        });
    }

    function clickLikeButton() {
        console.log("Searching for Like button...");
        const likeButton = Array.from(document.querySelectorAll('div[aria-label="Like"], div[aria-label="Like this"], span[aria-label="Like"]'))
            .find(el => el.offsetParent !== null);
        
        if (likeButton) {
            console.log("Like button found. Attempting to click...");
            likeButton.click();
            return true;
        }
        console.log("Like button not found.");
        return false;
    }

    function sendFriendRequest() {
        console.log("Searching for Add Friend button...");
        const addFriendButton = document.querySelector('div[aria-label="Add friend"]');
        if (addFriendButton) {
            console.log("Add Friend button found. Attempting to click...");
            addFriendButton.click();
            return true;
        }
        console.log("Add Friend button not found.");
        return false;
    }

    let result = { liked: false, friendRequestSent: false, error: false, errorMessage: '', conditionsMet: [] };

    try {
        console.log("Scanning for keywords...");
        const keywordResults = scanForKeywords();
        result.conditionsMet = keywordResults.filter(kr => kr.found).map(kr => kr.keyword);
        console.log("Conditions met:", result.conditionsMet);
        
        if (keywords.length === 0 || result.conditionsMet.length > 0) {
            console.log("Attempting to like and send friend request...");
            result.liked = clickLikeButton();
            result.friendRequestSent = sendFriendRequest();
        } else {
            console.log("No keywords matched or no keywords provided. Skipping actions.");
        }
    } catch (error) {
        console.error('Error during automation:', error);
        result.error = true;
        result.errorMessage = error.message;
    }

    console.log("Action results:", result);
    return result;
}

// Load state when the background script starts
loadState(() => {
    if (isProcessing && !isPaused) {
        processNextUrl();
    }
});