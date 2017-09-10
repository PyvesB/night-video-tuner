var videoDetected = false;

function checkForVideos() {
	var videos = document.getElementsByTagName("video");
	if (videos.length > 0) {
		chrome.storage.local.get("state", function(value) {
			var enabled = (value["state"] !== "disabled");
			if (!videoDetected) {
				// A video was detected, previously none were.
				videoDetected = true;
				// Listen to changes to the storage made by the popup.
				chrome.storage.onChanged.addListener(handleStorageChanges);
				if (enabled) {
					// Notify background so that tab icon is changed to play.
					chrome.runtime.sendMessage({
						active : true
					});
				}
			}
			Array.prototype.slice.call(videos).forEach(function(video) {
				// Add class and set filters if video found for the first time.
				if (!video.classList.contains("night_video_tuner")) {
					video.classList.add("night_video_tuner");
					if (enabled) {
						updateAllVideoFilters(video);
					}
				}
			});
		});
	} else if (videoDetected) {
		// A video was previously detected, but there aren't any now.
		videoDetected = false;
		// No more video: do not react to subsequent storage changes.
		chrome.storage.onChanged.removeListener(handleStorageChanges);
		// Notify background so that tab icon is changed to pause.
		chrome.runtime.sendMessage({
			active : false
		});
	}
	// Recursively check for videos in case the page later changes on the fly.
	setTimeout(checkForVideos, 1000);
}
// Execute first check for videos.
checkForVideos();

function listExtensionVideos() {
	return Array.prototype.slice.call(document.getElementsByClassName("night_video_tuner"));
}

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
		listExtensionVideos().forEach(function(video) {
			disableAllVideoFilters(video);
		});
		// Notify background so that tab icon is changed to pause.
		chrome.runtime.sendMessage({
			active : false
		});
	} else {
		listExtensionVideos().forEach(function(video) {
			updateAllVideoFilters(video);
		});
		// Notify background so that tab icon is changed to play.
		chrome.runtime.sendMessage({
			active : true
		});
	}
}

function handleFilterChange(key, newValue) {
	chrome.storage.local.get("state", function(value) {
		if (value["state"] !== "disabled") {
			if (key === "temperature") {
				if (DEFAULT_VALUES[key] !== newValue) {
					listExtensionVideos().forEach(function(video) {
						updateVideoTemperature(video, newValue);
					});
				} else {
					listExtensionVideos().forEach(function(video) {
						// Temperature has default value: remove url filter from
						// HTML.
						removeVideoFilter(video, "url");
					});
				}
			} else if (DEFAULT_VALUES[key] !== newValue) {
				listExtensionVideos().forEach(function(video) {
					updateVideoFilter(video, key, newValue + FILTERS[key]);
				});

			} else {
				listExtensionVideos().forEach(function(video) {
					// Filter has default value: remove it from HTML.
					removeVideoFilter(video, key);
				});
			}
		}
	});
}

function disableAllVideoFilters(video) {
	var svgFilters = document.getElementsByClassName("temperature_svg");
	// Remove HTML temperature element. At most one element expected.
	while (svgFilters[0]) {
		svgFilters[0].parentNode.removeChild(svgFilters[0]);
	}
	// Remove filter properties in HTML video element.
	if (typeof video.style !== "undefined") {
		video.style.setProperty("filter", "", "");
	}
}

function updateAllVideoFilters(video) {
	// Get all storage elements and match the relevant ones with our video
	// filters.
	chrome.storage.local.get(null, function(value) {
		Object.keys(FILTERS).forEach(function(filter) {
			var filterValue = value[filter];
			// Do not add filter if default value.
			if (typeof filterValue !== "undefined" && filterValue !== DEFAULT_VALUES[filter]) {
				if (filter === "temperature") {
					updateVideoTemperature(video, filterValue);
				} else {
					updateVideoFilter(video, filter, filterValue + FILTERS[filter]);
				}
			}
		});
	});
}

function updateVideoFilter(video, filter, value) {
	var newFilters;
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
			video.setAttribute("style", "");
		}
	}
	video.style.setProperty("filter", newFilters, "");
}

function removeVideoFilter(video, filter) {
	if (typeof video.style !== "undefined" && typeof video.style.filter !== "undefined") {
		var currentFilters = video.style.filter;
		var regex = RegExp(filter + "\\(([0-9]*" + FILTERS[filter] + "|\"#temperature_filter\")\\)");
		if (regex.test(currentFilters)) {
			// Filter previously existed: remove it.
			video.style.setProperty("filter", currentFilters.replace(regex, ""), "");
		}
	}
}

function updateVideoTemperature(video, value) {
	var temperature = value / 100;
	var previousFilters = document.getElementsByClassName("temperature_svg");
	// Remove previous HTML temperature element. At most one element expected.
	while (previousFilters[0]) {
		previousFilters[0].parentNode.removeChild(previousFilters[0]);
	}
	var newFilter = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	newFilter.classList.add("temperature_svg");
	var filterStyle = "";
	if (typeof InstallTrigger !== 'undefined') {
		// Workaround for Firefox bug 376027.
		newFilter.setAttribute("width", "0");
		newFilter.setAttribute("height", "0");
	} else {
		filterStyle = " style=\"display: none;\"";
	}
	// Functions to compute RGB components from a given temperature written
	// using: www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code
	newFilter.innerHTML = "<filter id=\"temperature_filter\"" + filterStyle + "><feColorMatrix type=\"matrix\" "
			+ "values=\"" + computeRed(temperature) + " 0 0 0 0 0 " + computeGreen(temperature) + " 0 0 0 0 0 "
			+ computeBlue(temperature) + " 0 0 0 0 0 1 0\"/></filter>";
	// Append HTML temperature element as a child of the video.
	video.parentNode.appendChild(newFilter);
	// Update filters so it uses the temperature svg.
	updateVideoFilter(video, "url", "#temperature_filter");
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