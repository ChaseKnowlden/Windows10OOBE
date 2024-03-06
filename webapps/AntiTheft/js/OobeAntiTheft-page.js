//
// Copyright (C) Microsoft. All rights reserved.
//
(() => {
    let URI = new Windows.Foundation.Uri(window.location.href);
    let readyObject = {
        init: (element, options) => {
            //This configures legacy to reference /js
            require.config(new RequirePathConfig('/webapps/AntiTheft'));
            // Load css per scenario
            let loadCssPromise = requireAsync(['legacy/uiHelpers', 'legacy/bridge']).then((result) => {
                return result.legacy_uiHelpers.LoadCssPromise(document.head, "", result.legacy_bridge);
            });

            let langAndDirPromise = requireAsync(['legacy/uiHelpers', 'legacy/bridge']).then((result) => {
                return result.legacy_uiHelpers.LangAndDirPromise(document.documentElement, result.legacy_bridge);
            });

            let getLocalizedStringsPromise = requireAsync(['legacy/bridge']).then((result) => {
                return result.legacy_bridge.invoke("CloudExperienceHost.StringResources.makeResourceObject", "AntiTheft");
            }).then((result) => {
                this.resourceStrings = JSON.parse(result);
            });

            let isConnectedToNetworkPromise = requireAsync(['legacy/bridge']).then((result) => {
                return result.legacy_bridge.invoke("CloudExperienceHost.Environment.hasInternetAccess");
            }).then((isConnectedToNetwork) => {
                this.isInternetAvailable = isConnectedToNetwork;
            });

            return WinJS.Promise.join({ loadCssPromise: loadCssPromise, langAndDirPromise: langAndDirPromise, getLocalizedStringsPromise: getLocalizedStringsPromise, isConnectedToNetworkPromise: isConnectedToNetworkPromise });
        },
        error: (e) => {
            bridge.fireEvent(constants.Events.done, constants.AppResult.error);
        },
        ready: (element, options) => {
            require(["lib/knockout", "legacy/bridge", "legacy/events", "OobeAntiTheft-vm", "lib/knockout-winjs"], (ko, bridge, constants, AntiTheftViewModel) => {
                ko.applyBindings(new AntiTheftViewModel(this.resourceStrings, this.isInternetAvailable, URI.queryParsed));
                WinJS.Utilities.addClass(document.body, "pageLoaded");
                bridge.fireEvent(constants.Events.visible, true);
            });
        }
    }
    if (URI.queryParsed.size > 0) {
        readyObject.init().then(readyObject.ready, readyObject.error);
    } else {
        WinJS.UI.Pages.define("/webapps/AntiTheft/views/OobeAntiTheft-main.html", readyObject);
    }
})();