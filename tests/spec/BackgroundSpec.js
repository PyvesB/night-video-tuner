describe("Background script", function() {
  describe("On extension installed", function() {
    beforeEach(function() {
      chrome.notifications.create.flush();
      spyOn(window, "injectScripts");
    });

    it("should inject scripts if not Firefox and notify about update", function() {
      InstallTrigger = undefined;
      chrome.i18n.getMessage.withArgs("update_title").returns("my-title");
      chrome.runtime.getManifest.returns({
        version : "1.0.0"
      });
      chrome.i18n.getMessage.withArgs("update_message", [ "1.0.0" ]).returns("my-message-1.0.0");

      chrome.runtime.onInstalled.dispatch({
        reason : "update"
      });

      expect(window.injectScripts).toHaveBeenCalled();
      expect(chrome.notifications.create.withArgs("update_notification", {
        title : "my-title",
        message : "my-message-1.0.0",
        type : "basic",
        iconUrl : "icons/icon-large.png"
      }).calledOnce).toBeTruthy();
    });

    it("should not inject scripts if Firefox but still notify about update", function() {
      InstallTrigger = "firefox";
      chrome.i18n.getMessage.withArgs("update_title").returns("my-title");
      chrome.runtime.getManifest.returns({
        version : "1.0.0"
      });
      chrome.i18n.getMessage.withArgs("update_message", [ "1.0.0" ]).returns("my-message-1.0.0");

      chrome.runtime.onInstalled.dispatch({
        reason : "update"
      });

      expect(window.injectScripts).not.toHaveBeenCalled();
      expect(chrome.notifications.create.withArgs("update_notification", {
        title : "my-title",
        message : "my-message-1.0.0",
        type : "basic",
        iconUrl : "icons/icon-large.png"
      }).calledOnce).toBeTruthy();
    });

    it("should inject scripts but not notify about other reasons", function() {
      InstallTrigger = undefined;

      chrome.runtime.onInstalled.dispatch({
        reason : "install"
      });

      expect(window.injectScripts).toHaveBeenCalled();
      expect(chrome.notifications.create.notCalled).toBeTruthy();
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
