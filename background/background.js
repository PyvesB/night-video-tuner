// Notifies tabs when the extension is installed or updated, and displays an
// update notification. All tabs execute their content script and check for
// videos, which avoids having to reload them or restart the browser.
chrome.runtime.onInstalled.addListener(function(details) {
	executeScriptsAndNotifyAllTabs();
	if (details.reason === "update") {
		chrome.notifications.create("update_notification", {
			title : chrome.i18n.getMessage("update_title"),
			message : chrome.i18n.getMessage("update_message", [ chrome.runtime.getManifest().version ]),
			type : "basic",
			iconUrl : "icons/icon-large.png"
		})
	}
	console.log("Extension version " + chrome.runtime.getManifest().version + " successfully installed");
});

// Detects when a tab has finished loading and notifies its content script.
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	if (typeof tab.url !== "undefined" && (changeInfo.status === "complete" || !!changeInfo.audible)) {
		notifyTab(tabId);
	}
});

// Modifies the tab icon when a tab containing a video notifies the background
// that the video tuning has been enabled or disabled.
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.state === "disabled") {
		chrome.browserAction.setIcon({
			path : "icons/icon-pause.png",
			tabId : sender.tab.id
		});
	} else if (request.state === "enabled") {
		chrome.browserAction.setIcon({
			path : "icons/icon-play.png",
			tabId : sender.tab.id
		});
	}
});

function executeScriptsAndNotifyAllTabs() {
	chrome.tabs.query({}, function(tabs) {
		tabs.forEach(function(tab) {
			// Executing a content script on chrome://, ftp:// or file:// URLs
			// is not allowed and would throw exceptions.
			if (!tab.url.startsWith("chrome://") && !tab.url.startsWith("ftp://") && !tab.url.startsWith("file://")) {
				chrome.tabs.executeScript(tab.id, {
					allFrames : true,
					file : "filters/filters.js"
				}, function(result) {
					if (typeof chrome.runtime.lastError !== "undefined") {
						console.log("Could not execute script in tab with url " + tab.url);
					} else {
						chrome.tabs.executeScript(tab.id, {
							allFrames : true,
							file : "content/content.js"
						}, function(result) {
							notifyTab(tab.id);
						});
					}
				});
			}
		});
	});
}

function notifyTab(id) {
	// Notifies a tab that it has finished loading. Modifies its icon depending
	// on whether a video was found or not.
	chrome.tabs.sendMessage(id, {}, function(response) {
		if (typeof response !== "undefined" && response.message === "tab_enabled") {
			chrome.browserAction.setIcon({
				path : "icons/icon-play.png",
				tabId : id
			});
			console.log("Extension enabled in tab " + id);
		} else if (typeof response !== "undefined" && response.message === "no_more_video") {
			chrome.browserAction.setIcon({
				path : "icons/icon-pause.png",
				tabId : id
			});
			console.log("Extension disabled in tab " + id);
		}
	});
}