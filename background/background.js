// All tabs execute the content scripts and check for videos. This avoids having
// to reload them or restart the browser.
chrome.runtime.onInstalled.addListener(function() {
  // Firefox automatically injects scripts on install, Chrome doesn't.
  if (typeof InstallTrigger === 'undefined') {
    injectScripts();
  }
});

// Modifies the tab icon when a tab containing a video notifies the background
// whether video tuning is active or not.
chrome.runtime.onMessage.addListener(function(request, sender) {
  const iconName = request.active ? "play" : "pause";
  chrome.browserAction.setIcon({
    path : `icons/icon-${iconName}.png`,
    tabId : sender.tab.id
  });
});

function injectScripts() {
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(function(tab) {
      // Executing a content script on chrome://, ftp:// or file:// URLs
      // is not allowed and would throw an exception.
      if (!tab.url.startsWith("chrome://") && !tab.url.startsWith("ftp://") && !tab.url.startsWith("file://")) {
        chrome.tabs.executeScript(tab.id, {
          allFrames : true,
          file : "filters/filters.js"
        }, function() {
          if (typeof chrome.runtime.lastError !== "undefined") {
            console.warn(`Could not execute Night Video Tuner script in tab with url ${tab.url}`);
          } else {
            chrome.tabs.executeScript(tab.id, {
              allFrames : true,
              file : "content/content.js"
            });
          }
        });
      }
    });
  });
}
