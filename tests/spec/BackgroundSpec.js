describe("Background script", function() {
  describe("On extension installed", function() {
    beforeEach(function() {
      spyOn(window, "injectScripts");
    });

    it("should inject scripts if Chrome", function() {
      InstallTrigger = undefined;

      chrome.runtime.onInstalled.dispatch();

      expect(window.injectScripts).toHaveBeenCalled();
    });

    it("should not inject scripts if Firefox", function() {
      InstallTrigger = "firefox";

      chrome.runtime.onInstalled.dispatch();

      expect(window.injectScripts).not.toHaveBeenCalled();
    });
  });

  describe("On message", function() {
    beforeEach(function() {
      chrome.browserAction.setIcon.flush();
    });

    it("should set icon to play", function() {
      chrome.runtime.onMessage.dispatch({
        active : true
      }, {
        tab : {
          id : "my-id"
        }
      });

      expect(chrome.browserAction.setIcon.withArgs({
        path : "icons/icon-play.png",
        tabId : "my-id"
      }).calledOnce).toBeTruthy();
    });

    it("should set icon to pause", function() {
      chrome.runtime.onMessage.dispatch({
        active : false
      }, {
        tab : {
          id : "my-id"
        }
      });

      expect(chrome.browserAction.setIcon.withArgs({
        path : "icons/icon-pause.png",
        tabId : "my-id"
      }).calledOnce).toBeTruthy();
    });
  });

  describe("Inject scripts", function() {
    beforeEach(function() {
      chrome.tabs.executeScript.flush();
    });

    it("should not inject scripts in non relevant tabs", function() {
      chrome.tabs.query.withArgs({}).yields([ {
        url : "chrome://settings"
      }, {
        url : "ftp://file"
      }, {
        url : "file://doc.txt"
      } ]);

      injectScripts();

      expect(chrome.tabs.executeScript.notCalled).toBeTruthy();
    });

    it("should inject scripts in relevant tabs", function() {
      chrome.tabs.query.withArgs({}).yields([ {
        url : "https://my-video-website.com",
        id : "1"
      } ]);

      injectScripts();

      expect(chrome.tabs.executeScript.called).toBeTruthy();
    });
  });
});
