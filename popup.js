document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('startAutomation');
    const pauseResumeButton = document.getElementById('pauseResumeButton');
    const urlListTextarea = document.getElementById('urlList');
    const keywordsInput = document.getElementById('keywords');
    const summaryDiv = document.getElementById('summary');
    const showErrorLogButton = document.getElementById('showErrorLog');
    const errorLogDiv = document.getElementById('errorLog');
    const errorLogContent = document.getElementById('errorLogContent');
    const exportErrorLogButton = document.getElementById('exportErrorLog');
    const summaryTabButton = document.getElementById('summaryTabButton');
    const summaryContent = document.getElementById('summaryContent');

    let errorLog = [];
    let actionLog = [];

    // Load state when popup opens
    chrome.runtime.sendMessage({ action: "get_state" }, function(state) {
        if (state) {
            urlListTextarea.value = state.urlQueue.join('\n');
            keywordsInput.value = state.keywords.join(', ');
            errorLog = state.errorLog;
            actionLog = state.actionLog;
            updateSummary(state.summary);
            updatePauseResumeButton(state.isPaused);
            updateErrorLogContent();
            updateSummaryContent();
        }
    });

    startButton.addEventListener('click', function() {
        const urls = urlListTextarea.value.split('\n').filter(url => url.trim() !== '');
        const keywords = keywordsInput.value.split(',').map(keyword => keyword.trim()).filter(keyword => keyword !== '');
        
        if (urls.length > 0) {
            chrome.runtime.sendMessage({
                action: "start_automation",
                urls: urls,
                keywords: keywords
            }, function(response) {
                if (response && response.success) {
                    startButton.disabled = true;
                    pauseResumeButton.disabled = false;
                }
            });
        } else {
            alert('Please enter at least one URL.');
        }
    });

    pauseResumeButton.addEventListener('click', function() {
        const action = pauseResumeButton.textContent === "Pause" ? "pause_automation" : "resume_automation";
        chrome.runtime.sendMessage({ action: action }, function(response) {
            if (response && response.success) {
                updatePauseResumeButton(action === "pause_automation");
            }
        });
    });

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "update_summary") {
            updateSummary(request);
            if (request.errorLog) {
                errorLog.push(request.errorLog);
            }
            if (request.actionLog) {
                actionLog.push(request.actionLog);
            }
            updateErrorLogContent();
            updateSummaryContent();

            if (request.processed === request.total) {
                startButton.disabled = false;
                pauseResumeButton.disabled = true;
            }
        }
    });

    showErrorLogButton.addEventListener('click', function() {
        errorLogDiv.style.display = errorLogDiv.style.display === 'none' ? 'block' : 'none';
        summaryContent.style.display = 'none';
    });

    summaryTabButton.addEventListener('click', function() {
        summaryContent.style.display = summaryContent.style.display === 'none' ? 'block' : 'none';
        errorLogDiv.style.display = 'none';
    });

    exportErrorLogButton.addEventListener('click', function() {
        const csvContent = "data:text/csv;charset=utf-8," 
            + "URL,Action,Error,Conditions Met\n"
            + actionLog.map(e => `"${e.url}","${e.liked ? 'Liked' : ''}${e.friendRequestSent ? ' Friend Request Sent' : ''}","${e.error || ''}","${e.conditionsMet.join('; ')}"`).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "automation_log.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    function updateSummary(summary) {
        summaryDiv.innerHTML = `
            <p>Processed: ${summary.processed}/${summary.total}</p>
            <p>Likes sent: ${summary.likesSent}</p>
            <p>Friend requests sent: ${summary.friendRequestsSent}</p>
            <p>Errors: ${summary.errors}</p>
        `;
    }

    function updatePauseResumeButton(isPaused) {
        pauseResumeButton.textContent = isPaused ? "Resume" : "Pause";
    }

    function updateErrorLogContent() {
        errorLogContent.value = actionLog.map(e => 
            `URL: ${e.url}\nAction: ${e.liked ? 'Liked' : ''}${e.friendRequestSent ? ' Friend Request Sent' : ''}\nError: ${e.error || 'None'}\nConditions Met: ${e.conditionsMet.join(', ')}\n`
        ).join("\n");
    }

    function updateSummaryContent() {
        summaryContent.innerHTML = actionLog.map(e => `
            <div class="summary-item">
                <strong>URL:</strong> ${e.url}<br>
                <strong>Actions:</strong> ${e.liked ? 'Liked' : 'Not Liked'}, ${e.friendRequestSent ? 'Friend Request Sent' : 'No Friend Request'}<br>
                <strong>Conditions Met:</strong> ${e.conditionsMet.length > 0 ? e.conditionsMet.join(', ') : 'None'}<br>
                ${e.error ? `<strong>Error:</strong> ${e.error}<br>` : ''}
            </div>
        `).join('');
    }
});