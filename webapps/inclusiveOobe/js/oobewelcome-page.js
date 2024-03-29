﻿//
// Copyright (C) Microsoft. All rights reserved.
//
(() => {
    WinJS.UI.Pages.define("/webapps/inclusiveOobe/view/oobewelcome-main.html", {
        init: (element, options) => {
            require.config(new RequirePathConfig('/webapps/inclusiveOobe'));

            // Load css per scenario
            let loadCssPromise = requireAsync(['legacy/uiHelpers', 'legacy/bridge']).then((result) => {
                return result.legacy_uiHelpers.LoadCssPromise(document.head, "", result.legacy_bridge);
            });

            let langAndDirPromise = requireAsync(['legacy/uiHelpers', 'legacy/bridge']).then((result) => {
                return result.legacy_uiHelpers.LangAndDirPromise(document.documentElement, result.legacy_bridge);
            });

            // Load resource strings
            let getLocalizedStringsPromise = requireAsync(['legacy/bridge']).then((result) => {
                return result.legacy_bridge.invoke("CloudExperienceHost.StringResources.makeResourceObject", "oobeWelcome");
            }).then((result) => {
                this.resourceStrings = JSON.parse(result);
            });

            return WinJS.Promise.join({ loadCssPromise: loadCssPromise, langAndDirPromise: langAndDirPromise, getLocalizedStringsPromise: getLocalizedStringsPromise });
        },
        error: (e) => {
            require(['legacy/bridge', 'legacy/events'], (bridge, constants) => {
                bridge.fireEvent(constants.Events.done, constants.AppResult.error);
            });
        },
        ready: (element, options) => {
            require(['lib/knockout', 'jsCommon/knockout-helpers', 'jsCommon/oobe-gesture-manager', 'legacy/bridge', 'legacy/core', 'legacy/events', 'oobewelcome-vm', 'lib/knockout-winjs'], (ko, KoHelpers, gestureManager, bridge, core, constants, WelcomeViewModel) => {
                // Setup knockout customizations
                koHelpers = new KoHelpers();
                koHelpers.registerCustomComponents();
                window.KoHelpers = KoHelpers;

                // Apply bindings and show the page
                let vm = new WelcomeViewModel.WelcomeViewModel(this.resourceStrings, gestureManager);
                ko.applyBindings(vm);
                KoHelpers.waitForInitialComponentLoadAsync().then(() => {
                    vm.subscribeToDeviceInsertion(gestureManager);
                    
                    // This can take a while to load on slow devices, so keep the progress ring up until they're loaded
                    // But only wait up to 5 seconds, otherwise we may hit the visibility timeout while loading.
                    let loadPromise = WinJS.Promise.any([vm.waitForAssetLoadAsync(), WinJS.Promise.timeout(5000)]);
                    loadPromise.then(() => {
                        WinJS.Utilities.addClass(document.body, "pageLoaded");
                        bridge.fireEvent(constants.Events.visible, true);
                        //  It looks better if we let the progress ring fade away for half a second before starting
                        WinJS.Promise.timeout(500).then(() => {
                            vm.startAnimation().done(null, (error) => {
                                bridge.fireEvent(constants.Events.done, constants.AppResult.fail);
                            });
                        });
                    });
                });
            });
        }
    });
})();
