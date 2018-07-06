// Disable logging when used in production.
console.log = function() {};

// Add listeners to the different buttons in the popup.
document.getElementById("reset_all").addEventListener("click", resetAll);
document.getElementById("enable_disable").addEventListener("click", enableDisable);
document.getElementById("website").addEventListener("click", visitWebsite);
document.getElementById("reviews").addEventListener("click", visitReviews);
Object.keys(FILTERS).forEach(function(filter) {
  const rangeInput = document.getElementById(filter);
  // Add listener to the filter range input.
  rangeInput.addEventListener("input", updateFilterValue);
  // Add listener to the filter reset button.
  document.getElementById(`reset_${filter}`).addEventListener("click", function(e) {
    // Remove "reset_" prefix.
    resetFilter(e.target.id.substring(6));
  });
  // Set text corresponding to the name of the filter.
  let messageName = filter;
  if (filter === "hue-rotate") {
    // i18n message names don't support hyphens.
    messageName = "hue_rotate";
  }
  document.getElementById(`${filter}_text`).appendChild(document.createTextNode(chrome.i18n.getMessage(messageName)));
  // Initialise the displayed value.
  chrome.storage.local.get(filter, function(value) {
    const storageValue = value[filter];
    if (typeof storageValue !== "undefined") {
      rangeInput.value = storageValue;
      const filterVal = document.getElementById(`${filter}_val`);
      while (filterVal.firstChild) {
        filterVal.removeChild(filterVal.firstChild);
      }
      filterVal.appendChild(document.createTextNode(`${storageValue}${FILTERS[filter]}`));
    }
  });
});
// Get current state of the extension to update the enable/disable button.
chrome.storage.local.get("state", function(value) {
  const buttonText = document.getElementById("enable_disable_text");
  while (buttonText.firstChild) {
    buttonText.removeChild(buttonText.firstChild);
  }
  if (value["state"] === "disabled") {
    buttonText.appendChild(document.createTextNode(chrome.i18n.getMessage("enable")));
  } else {
    buttonText.appendChild(document.createTextNode(chrome.i18n.getMessage("disable")));
  }
});
// Set names of the other buttons.
document.getElementById("reset_all_text").appendChild(document.createTextNode(chrome.i18n.getMessage("reset_all")));
document.getElementById("website_text").appendChild(document.createTextNode(chrome.i18n.getMessage("website")));
document.getElementById("reviews_text").appendChild(document.createTextNode(chrome.i18n.getMessage("reviews")));
// Display version number.
document.getElementById("version").appendChild(document.createTextNode(`v${chrome.runtime.getManifest().version}`));

function updateFilterValue() {
  const filter = this.id;
  const newValue = this.value;
  const filterVal = document.getElementById(`${filter}_val`);
  while (filterVal.firstChild) {
    filterVal.removeChild(filterVal.firstChild);
  }
  // Update the displayed value.
  filterVal.appendChild(document.createTextNode(`${newValue}${FILTERS[filter]}`));
  const storageObj = {};
  storageObj[filter] = newValue;
  // Persist the new value to the storage so it is picked up by a tab's
  // content script.
  chrome.storage.local.set(storageObj, function() {
    console.log(`Set value of ${filter} to ${newValue}${FILTERS[filter]}`);
  });
}

function resetAll() {
  Object.keys(FILTERS).forEach(function(filter) {
    resetFilter(filter);
  });
}

function resetFilter(filter) {
  const defaultValue = DEFAULT_VALUES[filter];
  // Update position of the range thumb.
  document.getElementById(filter).value = defaultValue;
  const filterVal = document.getElementById(`${filter}_val`);
  while (filterVal.firstChild) {
    filterVal.removeChild(filterVal.firstChild);
  }
  // Update the displayed value.
  filterVal.appendChild(document.createTextNode(`${defaultValue}${FILTERS[filter]}`));
  const storageObj = {};
  storageObj[filter] = defaultValue;
  // Persist the default value to the storage so it is picked up by a tab's
  // content script.
  chrome.storage.local.set(storageObj, function() {
    console.log(`Reset ${filter} to its default value (${defaultValue}${FILTERS[filter]})`);
  });
}

function enableDisable() {
  chrome.storage.local.get("state", function(value) {
    const storageObj = {};
    const buttonText = document.getElementById("enable_disable_text");
    while (buttonText.firstChild) {
      buttonText.removeChild(buttonText.firstChild);
    }
    if (value["state"] === "disabled") {
      storageObj["state"] = "enabled";
      buttonText.appendChild(document.createTextNode(chrome.i18n.getMessage("disable")));
    } else {
      // If no value in storage, treat as previously enabled.
      storageObj["state"] = "disabled";
      buttonText.appendChild(document.createTextNode(chrome.i18n.getMessage("enable")));
    }
    chrome.storage.local.set(storageObj, function() {
      console.log(`Set global state of extension to ${storageObj["state"]}`);
    });
  });
}

function visitWebsite() {
  window.open("https://github.com/PyvesB/night-video-tuner");
}

function visitReviews() {
  if (!!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) {
    window.open("https://addons.opera.com/extensions/details/night-video-tuner");
  } else if (typeof InstallTrigger !== 'undefined') {
    window.open("https://addons.mozilla.org/firefox/addon/night-video-tuner");
  } else {
    window.open("https://chrome.google.com/webstore/detail/night-video-tuner/ogffaloegjglncjfehdfplabnoondfjo");
  }
}
