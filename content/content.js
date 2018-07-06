var videoChecker;

function checkForVideos() {
  const videos = document.getElementsByTagName("video");
  if (videos.length > 0) {
    chrome.storage.local.get("state", function(value) {
      const enabled = (value["state"] !== "disabled");
      // Check whether video previously detected (i.e. already listening to
      // storage changes).
      if (!chrome.storage.onChanged.hasListener(handleStorageChanges)) {
        // Listen to changes to the storage made by the popup.
        chrome.storage.onChanged.addListener(handleStorageChanges);
        if (enabled) {
          // Notify background so that tab icon is changed to play.
          chrome.runtime.sendMessage({
            active : true
          });
        }
      }
      updateUnprocessedVideos(videos, enabled);
    });
  } else if (chrome.storage.onChanged.hasListener(handleStorageChanges)) {
    // No more video: do not react to subsequent storage changes.
    chrome.storage.onChanged.removeListener(handleStorageChanges);
    // Notify background so that tab icon is changed to pause.
    chrome.runtime.sendMessage({
      active : false
    });
  }
  // Recursively check for videos in case the page later changes on the fly.
  videoChecker = setTimeout(checkForVideos, 1000);
}
// Execute first check for videos.
checkForVideos();

function updateUnprocessedVideos(videos, enabled) {
  Array.prototype.slice.call(videos).forEach(function(video) {
    // Add class and set filters if video found for the first time or if style
    // removed (players such as Netflix do this).
    if (!video.classList.contains("night_video_tuner") || !video.hasAttribute("style")) {
      video.classList.add("night_video_tuner");
      if (enabled) {
        updateAllVideoFilters(video);
      }
    }
  });
}

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
  const enabled = (newState !== "disabled");
  if (enabled) {
    listExtensionVideos().forEach(function(video) {
      updateAllVideoFilters(video);
    });
  } else {
    listExtensionVideos().forEach(function(video) {
      disableAllVideoFilters(video);
    });
  }
  // Notify background so that tab icon is changed.
  chrome.runtime.sendMessage({
    active : enabled
  });
}

function handleFilterChange(key, newValue) {
  chrome.storage.local.get("state", function(value) {
    if (value["state"] !== "disabled") {
      if (DEFAULT_VALUES[key] === newValue) {
        listExtensionVideos().forEach(function(video) {
          // Filter has default value: remove it from HTML.
          removeVideoFilter(video, key);
        });
      } else if (key === "temperature") {
        listExtensionVideos().forEach(function(video) {
          updateVideoTemperature(video, newValue);
        });
      } else if (key === "gamma") {
        listExtensionVideos().forEach(function(video) {
          updateVideoGamma(video, newValue);
        });
      } else {
        listExtensionVideos().forEach(function(video) {
          updateVideoFilter(video, key, `${newValue}${FILTERS[key]}`);
        });
      }
    }
  });
}

function disableAllVideoFilters(video) {
  removeSVGElements("temperature_svg");
  removeSVGElements("gamma_svg");
  // Remove filter properties in HTML video element.
  if (typeof video.style !== "undefined") {
    video.style.setProperty("filter", "", "");
  }
}

function removeSVGElements(name) {
  const svgFilters = document.getElementsByClassName(name);
  // Remove HTML svg element. At most one element expected.
  while (svgFilters[0]) {
    svgFilters[0].parentNode.removeChild(svgFilters[0]);
  }
}

function updateAllVideoFilters(video) {
  if (!video.hasAttribute("style")) {
    // Prepare style atribute for upcoming population.
    video.setAttribute("style", "");
  }
  // Get all storage elements and match relevant ones with our video filters.
  chrome.storage.local.get(null, function(value) {
    Object.keys(FILTERS).forEach(function(filter) {
      const filterValue = value[filter];
      // Do not add filter if default value.
      if (typeof filterValue !== "undefined" && filterValue !== DEFAULT_VALUES[filter]) {
        if (filter === "temperature") {
          updateVideoTemperature(video, filterValue);
        } else if (filter === "gamma") {
            updateVideoGamma(video, filterValue);
        } else {
          updateVideoFilter(video, filter, `${filterValue}${FILTERS[filter]}`);
        }
      }
    });
  });
}

function updateVideoFilter(video, cssName, value) {
  let newFilters;
  if (typeof video.style.filter !== "undefined") {
    const currentFilters = video.style.filter;
    const regex = RegExp(`${cssName}\\(([0-9]*${FILTERS[cssName]}|"${value}")\\)`);
    if (regex.test(currentFilters)) {
      // Filter already exists: replace with new value.
      newFilters = currentFilters.replace(regex, `${cssName}(${value})`);
    } else {
      // Filter doesn't exist: append it to existing ones.
      newFilters = `${currentFilters} ${cssName}(${value})`;
    }
  } else {
    // No current filters.
    newFilters = `${cssName}(${value})`;
  }
  video.style.setProperty("filter", newFilters, "");
}

function removeVideoFilter(video, name) {
  if (typeof video.style !== "undefined" && typeof video.style.filter !== "undefined") {
    const currentFilters = video.style.filter;
    const regex = RegExp(`${name}\\([0-9]*${FILTERS[name]}\\)|url\\("#${name}_filter"\\)`);
    if (regex.test(currentFilters)) {
      // Filter previously existed: remove it.
      video.style.setProperty("filter", currentFilters.replace(regex, ""), "");
    }
  }
}

function updateVideoTemperature(video, value) {
  const temperature = value / 100;
  const feColorMatrix = document.createElementNS("http://www.w3.org/2000/svg", "feColorMatrix");
  feColorMatrix.setAttribute("type", "matrix");
  // Functions to compute RGB components from a given temperature written
  // using: www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code
  feColorMatrix.setAttribute("values",
      `${computeRed(temperature)} 0 0 0 0 0 ${computeGreen(temperature)} 0 0 0 0 0 ${computeBlue(temperature)} 0 0 0 0 0 1 0`);
  updateSVGFilter(video, feColorMatrix, "temperature");
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

function updateVideoGamma(video, value) {
  const feComponentTransfer = document.createElementNS("http://www.w3.org/2000/svg", "feComponentTransfer");
  feComponentTransfer.appendChild(buildGammaComponent(value, "feFuncR"));
  feComponentTransfer.appendChild(buildGammaComponent(value, "feFuncG"));
  feComponentTransfer.appendChild(buildGammaComponent(value, "feFuncB"));
  updateSVGFilter(video, feComponentTransfer, "gamma");
}

function buildGammaComponent(value, name) {
  const component = document.createElementNS("http://www.w3.org/2000/svg", name);
  component.setAttribute("type", "gamma");
  component.setAttribute("offset", "0");
  component.setAttribute("amplitude", "1");
  component.setAttribute("exponent", value);
  return component;
}

function updateSVGFilter(video, child, name) {
  removeSVGElements(`${name}_svg`);
  const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.setAttribute("id", `${name}_filter`);
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.appendChild(child);
  const newSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  newSVG.classList.add(`${name}_svg`);
  // Workaround to prevent the SVG from interfering with the layout.
  newSVG.setAttribute("width", "0");
  newSVG.setAttribute("height", "0");
  newSVG.setAttribute("style", "position: absolute; left: -999");
  newSVG.appendChild(filter);
  // Append HTML temperature element as a child of the video.
  video.parentNode.appendChild(newSVG);
  // Update filters so it uses the temperature svg.
  updateVideoFilter(video, "url", `#${name}_filter`);
}
