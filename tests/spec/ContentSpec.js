describe("Content script", function() {
  var video;

  beforeEach(function() {
    chrome.flush();
    video = document.createElement("video");
  });

  afterEach(function() {
    var svgElements = document.getElementsByTagName("svg");
    while (svgElements.length > 0) {
      svgElements[0].remove();
    }
    var extensionVideos = document.getElementsByTagName("video");
    while (extensionVideos.length > 0) {
      extensionVideos[0].remove();
    }
  });

  describe("Check for videos", function() {
    it("should repeatedly check whether videos have appeared", function(done) {
      spyOn(window, "checkForVideos");

      setTimeout(function() {
        expect(window.checkForVideos).toHaveBeenCalled();
        done();
      }, 2500);
    });

    it("should do nothing if no videos are detected and none previously were", function() {
      videoDetected = false;

      checkForVideos();

      expect(chrome.storage.local.get.notCalled).toBeTruthy();
      expect(videoDetected).toBeFalsy();
      expect(chrome.storage.onChanged.removeListener.notCalled).toBeTruthy();
      expect(chrome.runtime.sendMessage.notCalled).toBeTruthy();
    });

    it("should remove listener and notify background if all previsouly detected videos are gone", function() {
      videoDetected = true;

      checkForVideos();

      expect(chrome.storage.local.get.notCalled).toBeTruthy();
      expect(chrome.storage.onChanged.removeListener.calledOnce).toBeTruthy();
      expect(videoDetected).toBeFalsy();
      expect(chrome.runtime.sendMessage.withArgs({
        active : false
      }).calledOnce).toBeTruthy();
    });

    it("should update unprocessed videos if some videos were previsouly detected", function() {
      document.body.appendChild(video);
      videoDetected = true;
      chrome.storage.local.get.withArgs("state").yields({
        state : "enabled"
      });
      spyOn(window, "updateUnprocessedVideos");

      checkForVideos();

      expect(chrome.storage.local.get.calledOnce).toBeTruthy();
      expect(videoDetected).toBeTruthy();
      expect(chrome.storage.onChanged.addListener.notCalled).toBeTruthy();
      expect(chrome.runtime.sendMessage.notCalled).toBeTruthy();
      expect(window.updateUnprocessedVideos.calls.mostRecent().args[0][0]).toEqual(video);
      expect(window.updateUnprocessedVideos.calls.mostRecent().args[1]).toBeTruthy();
    });

    it("should add listener and update unprocessed videos if videos detected for the first time, but not notify background if extension disabled", function() {
      document.body.appendChild(video);
      videoDetected = false;
      chrome.storage.local.get.withArgs("state").yields({
        state : "disabled"
      });
      spyOn(window, "updateUnprocessedVideos");

      checkForVideos();

      expect(chrome.storage.local.get.calledOnce).toBeTruthy();
      expect(videoDetected).toBeTruthy();
      expect(chrome.storage.onChanged.addListener.calledOnce).toBeTruthy();
      expect(chrome.runtime.sendMessage.notCalled).toBeTruthy();
      expect(window.updateUnprocessedVideos.calls.mostRecent().args[0][0]).toEqual(video);
      expect(window.updateUnprocessedVideos.calls.mostRecent().args[1]).toBeFalsy();
    });

    it("should add listener, update unprocessed videos and notify background if videos detected for the first time and extension enabled", function() {
      document.body.appendChild(video);
      videoDetected = false;
      chrome.storage.local.get.withArgs("state").yields({
        state : "enabled"
      });
      spyOn(window, "updateUnprocessedVideos");

      checkForVideos();

      expect(chrome.storage.local.get.calledOnce).toBeTruthy();
      expect(videoDetected).toBeTruthy();
      expect(chrome.storage.onChanged.addListener.calledOnce).toBeTruthy();
      expect(chrome.runtime.sendMessage.withArgs({
        active : true
      }).calledOnce).toBeTruthy();
      expect(window.updateUnprocessedVideos.calls.mostRecent().args[0][0]).toEqual(video);
      expect(window.updateUnprocessedVideos.calls.mostRecent().args[1]).toBeTruthy();
    });
  });

  describe("Update unprocessed videos", function() {
    beforeEach(function() {
      spyOn(window, "updateAllVideoFilters");
    });

    it("should do nothing if a video has the extension class and style attribute", function() {
      video.classList.add("night_video_tuner");
      video.setAttribute("style", "");

      updateUnprocessedVideos([ video ], true);

      expect(window.updateAllVideoFilters).not.toHaveBeenCalled();
    });

    it("should add missing extension class but not update filters if plugin disabled", function() {
      video.setAttribute("style", "");

      updateUnprocessedVideos([ video ], false);

      expect(video.classList.contains("night_video_tuner")).toBeTruthy();
      expect(window.updateAllVideoFilters).not.toHaveBeenCalled();
    });

    it("should update filters if plugin enabled and style attribute is missing", function() {
      video.classList.add("night_video_tuner");

      updateUnprocessedVideos([ video ], true);

      expect(window.updateAllVideoFilters).toHaveBeenCalled();
    });

    it("should add missing extension class and update filters if plugin enabled", function() {
      video.setAttribute("style", "");

      updateUnprocessedVideos([ video ], true);

      expect(video.classList.contains("night_video_tuner")).toBeTruthy();
      expect(window.updateAllVideoFilters).toHaveBeenCalled();
    });
  });

  describe("Handle state changes", function() {
    it("should disable filters and notify background when extension is disabled", function() {
      video.classList.add("night_video_tuner");
      document.body.appendChild(video);
      spyOn(window, "disableAllVideoFilters");

      handleStorageChanges({
        state : {
          newValue : "disabled"
        }
      });

      expect(window.disableAllVideoFilters.calls.mostRecent().args[0]).toEqual(video);
      expect(chrome.runtime.sendMessage.withArgs({
        active : false
      }).calledOnce).toBeTruthy();
    });

    it("should update filters and notify background when extension is enabled", function() {
      video.classList.add("night_video_tuner");
      document.body.appendChild(video);
      spyOn(window, "updateAllVideoFilters");

      handleStorageChanges({
        state : {
          newValue : "enabled"
        }
      });

      expect(window.updateAllVideoFilters.calls.mostRecent().args[0]).toEqual(video);
      expect(chrome.runtime.sendMessage.withArgs({
        active : true
      }).calledOnce).toBeTruthy();
    });
  });

  describe("Handle filter changes", function() {
    beforeEach(function() {
      video.classList.add("night_video_tuner");
      document.body.appendChild(video);
    });

    it("should do nothing if filter changed but plugin disabled", function() {
      chrome.storage.local.get.withArgs("state").yields({
        state : "disabled"
      });
      spyOn(window, "listExtensionVideos");

      handleStorageChanges({
        temperature : {
          newValue : "1000"
        }
      });

      expect(window.listExtensionVideos).not.toHaveBeenCalled();
    });

    it("should update temperature if plugin enabled", function() {
      chrome.storage.local.get.withArgs("state").yields({
        state : "enabled"
      });
      spyOn(window, "updateVideoTemperature");

      handleStorageChanges({
        temperature : {
          newValue : "1000"
        }
      });

      expect(window.updateVideoTemperature.calls.mostRecent().args[0]).toEqual(video);
      expect(window.updateVideoTemperature.calls.mostRecent().args[1]).toEqual("1000");
    });

    it("should remove temperature filter if changed back to default and plugin enabled", function() {
      chrome.storage.local.get.withArgs("state").yields({
        state : "enabled"
      });
      spyOn(window, "removeVideoFilter");

      handleStorageChanges({
        temperature : {
          newValue : DEFAULT_VALUES["temperature"]
        }
      });

      expect(window.removeVideoFilter.calls.mostRecent().args[0]).toEqual(video);
      expect(window.removeVideoFilter.calls.mostRecent().args[1]).toEqual("url");
    });

    it("should update filter if plugin enabled", function() {
      chrome.storage.local.get.withArgs("state").yields({
        state : "enabled"
      });
      spyOn(window, "updateVideoFilter");

      handleStorageChanges({
        brightness : {
          newValue : "101"
        }
      });

      expect(window.updateVideoFilter.calls.mostRecent().args[0]).toEqual(video);
      expect(window.updateVideoFilter.calls.mostRecent().args[1]).toEqual("brightness");
      expect(window.updateVideoFilter.calls.mostRecent().args[2]).toEqual(101 + FILTERS["brightness"]);
    });

    it("should remove filter if changed back to default and plugin enabled", function() {
      chrome.storage.local.get.withArgs("state").yields({
        state : "enabled"
      });
      spyOn(window, "removeVideoFilter");

      handleStorageChanges({
        brightness : {
          newValue : DEFAULT_VALUES["brightness"]
        }
      });

      expect(window.removeVideoFilter.calls.mostRecent().args[0]).toEqual(video);
      expect(window.removeVideoFilter.calls.mostRecent().args[1]).toEqual("brightness");
    });

  });

  describe("Disable all video filters", function() {
    it("should remove all video filters", function() {
      video.setAttribute("style", "filter: brightness(100%);");
      const svgFilter = document.createElement("svg");
      svgFilter.classList.add("temperature_svg");
      document.body.appendChild(svgFilter);

      disableAllVideoFilters(video);

      expect(document.getElementsByClassName("temperature_svg").length).toEqual(0);
      expect(video.style.filter).toEqual("");
    });
  });

  describe("Update all video filters", function() {
    it("should add missing style attribute and update all filters that have non default value", function() {
      chrome.storage.local.get.yields({
        temperature : "4000",
        contrast : "100"
      });
      spyOn(window, "updateVideoTemperature");
      spyOn(window, "updateVideoFilter");

      updateAllVideoFilters(video);

      expect(video.hasAttribute("style")).toBeTruthy();
      expect(window.updateVideoTemperature.calls.mostRecent().args[0]).toEqual(video);
      expect(window.updateVideoTemperature.calls.mostRecent().args[1]).toEqual("4000");
      expect(window.updateVideoFilter).not.toHaveBeenCalled();
    });
  });

  describe("Update video filter", function() {
    it("should add first filter", function() {
      video.setAttribute("style", "");

      updateVideoFilter(video, "brightness", "90%");

      expect(video.style.filter).toEqual("brightness(90%)");
    });

    it("should append new filter", function() {
      video.setAttribute("style", "filter: brightness(90%)");

      updateVideoFilter(video, "contrast", "80%");

      expect(video.style.filter).toEqual("brightness(90%) contrast(80%)");
    });

    it("should update existing filter", function() {
      video.setAttribute("style", "filter: brightness(90%)");

      updateVideoFilter(video, "brightness", "80%");

      expect(video.style.filter).toEqual("brightness(80%)");
    });
  });

  describe("Remove video filter", function() {
    it("should remove a video filter", function() {
      video.setAttribute("style", "filter: brightness(90%) contrast(80%)");

      removeVideoFilter(video, "brightness");

      expect(video.style.filter).toEqual("contrast(80%)");
    });
  });

  describe("Update video temperature", function() {
    it("should remove previous SVG filter and add new one", function() {
      document.body.appendChild(video);
      const svgFilter = document.createElement("svg");
      svgFilter.classList.add("temperature_svg", "expect_removed");
      document.body.appendChild(svgFilter);
      spyOn(window, "updateVideoFilter");

      updateVideoTemperature(video, "6000");

      expect(window.updateVideoFilter.calls.mostRecent().args[0]).toEqual(video);
      expect(window.updateVideoFilter.calls.mostRecent().args[1]).toEqual("url");
      expect(window.updateVideoFilter.calls.mostRecent().args[2]).toEqual("#temperature_filter");
      expect(document.getElementsByClassName("temperature_svg").length).toEqual(1);
      expect(document.getElementsByTagName("feColorMatrix").length).toEqual(1);
      expect(document.getElementsByClassName("expect_removed").length).toEqual(0);
    });
  });
});
