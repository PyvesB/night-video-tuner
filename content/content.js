var videoDetected = false;

// Listens for messages sent by the background indicating that the tab has
// finished loading. Checks whether a video is detected or no longer existent.
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if (!videoDetected && document.getElementsByTagName("video").length > 0) {
		videoDetected = true;
		chrome.storage.local.get("state", function(value) {
			if (value["state"] !== "disabled") {
				updateAllVideoFilters();
				sendResponse({
					message : "tab_enabled"
				});
			}
		});
		// Listen to changes to the storage made by the popup.
		chrome.storage.onChanged.addListener(handleStorageChanges);
		// Indicate to the background that the message response will be sent
		// asynchronously.
		return true;
	} else if (videoDetected && document.getElementsByTagName("video").length === 0) {
		videoDetected = false;
		// No more video: do not react to subsequent storage changes.
		chrome.storage.onChanged.removeListener(handleStorageChanges);
		sendResponse({
			message : "no_more_video"
		});
	}
});

function handleStorageChanges(changes) {
	Object.keys(changes).forEach(function(key) {
		if (key === "state") {
			handleStateChange(changes[key].newValue);
		} else {
			handleFilterChange(key, changes[key].newValue);
		}
	});
}

function handleStateChange(newState) {
	if (newState === "disabled") {
		disableAllVideoFilters();
		// Notify background so that tab icon is changed to pause.
		chrome.runtime.sendMessage({
			state : "disabled"
		});
	} else {
		updateAllVideoFilters();
		// Notify background so that tab icon is changed to play.
		chrome.runtime.sendMessage({
			state : "enabled"
		});
	}
}

function handleFilterChange(key, newValue) {
	chrome.storage.local.get("state", function(value) {
		if (value["state"] !== "disabled") {
			if (key === "temperature") {
				if (DEFAULT_VALUES[key] !== newValue) {
					updateVideoTemperature(newValue);
				} else {
					// Temperature has default value: remove url filter
					// from HTML.
					removeVideoFilter("url");
				}
			} else if (DEFAULT_VALUES[key] !== newValue) {
				updateVideoFilter(key, newValue + FILTERS[key]);
			} else {
				// Filter has default value: remove it from HTML.
				removeVideoFilter(key);
			}
		}
	});
}

function disableAllVideoFilters() {
	var svgFilter = document.getElementById("temperature_svg");
	if (svgFilter) {
		// Remove HTML temperature element.
		svgFilter.parentNode.removeChild(svgFilter);
	}
	// Remove filter properties in HTML video element.
	var video = document.getElementsByTagName("video")[0];
	if (typeof video.style !== "undefined") {
		video.style.setProperty("filter", "", "");
	}
}

function updateAllVideoFilters() {
	// Get all storage elements and match the relevant ones with our video
	// filters.
	chrome.storage.local.get(null, function(value) {
		Object.keys(FILTERS).forEach(function(filter) {
			var filterValue = value[filter];
			// Do not add filter if default value.
			if (typeof filterValue !== "undefined" && filterValue !== DEFAULT_VALUES[filter]) {
				if (filter === "temperature") {
					updateVideoTemperature(filterValue);
				} else {
					updateVideoFilter(filter, filterValue + FILTERS[filter]);
				}
			}
		});
	});
}

function updateVideoFilter(filter, value) {
	var newFilters;
	var video = document.getElementsByTagName("video")[0];
	if (typeof video.style !== "undefined" && typeof video.style.filter !== "undefined") {
		var currentFilters = video.style.filter;
		var regex = RegExp(filter + "\\(([0-9]*" + FILTERS[filter] + "|\"#temperature_filter\")\\)");
		if (regex.test(currentFilters)) {
			// Filter already exists: replace with new value.
			newFilters = currentFilters.replace(regex, filter + "(" + value + ")");
		} else {
			// Filter doesn't exist: append it to existing ones.
			newFilters = currentFilters + " " + filter + "(" + value + ")";
		}
	} else {
		// No current filters.
		newFilters = filter + "(" + value + ")";
		if (typeof video.style === "undefined") {
			video.setProperty("style", "", "");
		}
	}
	video.style.setProperty("filter", newFilters, "");
}

function removeVideoFilter(filter) {
	var video = document.getElementsByTagName("video")[0];
	if (typeof video.style !== "undefined" && typeof video.style.filter !== "undefined") {
		var currentFilters = video.style.filter;
		var regex = RegExp(filter + "\\(([0-9]*" + FILTERS[filter] + "|\"#temperature_filter\")\\)");
		if (regex.test(currentFilters)) {
			// Filter previously existed: remove it.
			video.style.setProperty("filter", currentFilters.replace(regex, ""), "");
		}
	}
}

function updateVideoTemperature(value) {
	var temperature = value / 100;
	var previousFilter = document.getElementById("temperature_svg");
	if (previousFilter) {
		// Remove previous HTML temperature element.
		previousFilter.parentNode.removeChild(previousFilter);
	}
	var newFilter = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	newFilter.id = "temperature_svg";
	// Functions to compute RGB components from a given temperature written
	// using: www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code
	newFilter.innerHTML = "<filter id=\"temperature_filter\" style=\"display: none;\"><feColorMatrix type=\"matrix\" "
			+ "values=\"" + computeRed(temperature) + " 0 0 0 0 0 " + computeGreen(temperature) + " 0 0 0 0 0 "
			+ computeBlue(temperature) + " 0 0 0 0 0 1 0\"/></filter>";
	// Append HTML temperature element as a child of the video.
	document.getElementsByTagName("video")[0].appendChild(newFilter);
	// Update filters so it uses the temperature svg.
	updateVideoFilter("url", "#temperature_filter");
}

function computeRed(temperature) {
	if (temperature <= 66) {
		return 1;
	}
	return normalise(329.698727446 * Math.pow(temperature - 60, -0.1332047592));
}

function computeGreen(temperature) {
	if (temperature <= 66) {
		return normalise(99.4708025861 * Math.log(temperature) - 161.1195681661);
	}
	return normalise(288.1221695283 * Math.pow(temperature - 60, -0.0755148492));
}

function computeBlue(temperature) {
	if (temperature >= 66) {
		return 1;
	}
	if (temperature <= 19) {
		return 0;
	}
	return normalise(138.5177312231 * Math.log(temperature - 10) - 305.0447927307);
}

function normalise(temperature) {
	if (temperature < 0) {
		return 0;
	}
	if (temperature > 255) {
		return 1;
	}
	return temperature / 255;
}