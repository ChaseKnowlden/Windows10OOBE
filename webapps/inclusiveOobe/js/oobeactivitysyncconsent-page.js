// Copyright (C) Microsoft. All rights reserved.
(() => {
    WinJS.UI.Pages.define("/webapps/inclusiveOobe/view/oobeactivitysyncconsent-main.html", {
        init: (element, options) => {
            require.config(new RequirePathConfig('/webapps/inclusiveOobe'));

            // Load css per scenario
            let loadCssPromise = requireAsync(['legacy/uiHelpers', 'legacy/bridge']).then((result) => {
                return result.legacy_uiHelpers.LoadCssPromise(document.head, "", result.legacy_bridge);
            });

            let langAndDirPromise = requireAsync(['legacy/uiHelpers', 'legacy/bridge']).then((result) => {
                return result.legacy_uiHelpers.LangAndDirPromise(document.documentElement, result.legacy_bridge);
            });

            let getLocalizedStringsPromise = requireAsync(['legacy/bridge']).then((result) => {
                return result.legacy_bridge.invoke("CloudExperienceHost.StringResources.makeResourceObject", "oobeActivitySyncConsent");
            }).then((result) => {
                this.resourceStrings = JSON.parse(result);
                });

            /*let isConnectedToNetworkPromise = requireAsync(['legacy/bridge']).then((result) => {
                return result.legacy_bridge.invoke("CloudExperienceHost.Environment.hasInternetAccess");
            }).then((isConnectedToNetwork) => {
                this.isInternetAvailable = isConnectedToNetwork;
            });*/

            return WinJS.Promise.join({ loadCssPromise: loadCssPromise, langAndDirPromise: langAndDirPromise, getLocalizedStringsPromise: getLocalizedStringsPromise/*, isConnectedToNetworkPromise: isConnectedToNetworkPromise*/ });
        },
        error: (e) => {
            require(['legacy/bridge', 'legacy/events'], (bridge, constants) => {
                bridge.fireEvent(constants.Events.done, constants.AppResult.error);
            });
        },
        ready: (element, options) => {
            require(['lib/knockout', 'jsCommon/knockout-helpers', 'legacy/bridge', 'legacy/events', 'oobeactivitysyncconsent-vm', 'lib/knockout-winjs'], (ko, KoHelpers, bridge, constants, ActivitySyncConsentViewModel) => {
                // Setup knockout customizations
                koHelpers = new KoHelpers();
                koHelpers.registerCustomComponents();
                window.KoHelpers = KoHelpers;
                // Apply bindings and show the page
                let vm = new ActivitySyncConsentViewModel(this.resourceStrings/*, this.isInternetAvailable*/);
                ko.applyBindings(vm);
                KoHelpers.waitForInitialComponentLoadAsync().then(() => {
                    WinJS.Utilities.addClass(document.body, "pageLoaded");
                    bridge.fireEvent(constants.Events.visible, true);
                    vm.startMainVoiceOver();
                    KoHelpers.setFocusOnAutofocusElement();
                });
            });
        }
    });
})();
