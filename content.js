function likePost() {
    const likeButton = document.querySelector('div[aria-label="Like"]');
    if (likeButton) {
        likeButton.click();
        console.log('Liked post');
    } else {
        console.log('Like button not found');
    }
}

function sendFriendRequest() {
    const addFriendButton = document.querySelector('div[aria-label="Add friend"]');
    if (addFriendButton) {
        addFriendButton.click();
        console.log('Sent friend request');
    } else {
        console.log('Add friend button not found');
    }
}

function performAutomation() {
    likePost();
    setTimeout(sendFriendRequest, 2000); // Wait 2 seconds before sending friend request
}

function processNextUrl() {
    chrome.runtime.sendMessage({action: "get_next_url"}, function(response) {
        if (response.url) {
            window.location.href = response.url;
        } else {
            console.log("Automation complete");
        }
    });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "start_automation") {
        performAutomation();
        setTimeout(processNextUrl, 5000); // Wait 5 seconds before moving to the next URL
    }
});

// Check if we're on a Facebook profile page
if (window.location.href.includes('facebook.com') && document.querySelector('div[aria-label="Like"]')) {
    console.log('Ready for automation on this page');
}