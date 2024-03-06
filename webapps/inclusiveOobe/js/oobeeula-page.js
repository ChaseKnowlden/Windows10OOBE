//
// Copyright (C) Microsoft. All rights reserved.
//
(() => {
    var pages = [
        { 
            uri: "/webapps/inclusiveOobe/view/oobeeula-main.html",
            titleResourceId: "EulaTitle",
            shouldStartVoiceOver: true
        },
        {
            uri: "/webapps/inclusiveOobe/view/oobeeula-hololens.html",
            titleResourceId: "EulaTitle",
            shouldStartVoiceOver: false
        },
        {
            uri: "/webapps/AOobe/view/oobeeula-a.html",
            titleResourceId: "EulaTitleNonNumbered",
            shouldStartVoiceOver: false
        }
    ];

    pages.forEach((page) => {
        WinJS.UI.Pages.define(page.uri, {
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
                    return result.legacy_bridge.invoke("CloudExperienceHost.StringResources.makeResourceObject", "oobeEula");
                }).then((result) => {
                    this.resourceStrings = JSON.parse(result);
                });

                let getEulaDataPromise = requireAsync(['oobeeula-data']).then((result) => {
                    return result.oobeeula_data.getEulaData();
                }).then((result) => {
                    this.eulaData = result;
                });

                return WinJS.Promise.join({ loadCssPromise: loadCssPromise, langAndDirPromise: langAndDirPromise, getLocalizedStringsPromise: getLocalizedStringsPromise, getEulaDataPromise: getEulaDataPromise });
            },
            error: (e) => {
                require(['legacy/bridge', 'legacy/events'], (bridge, constants) => {
                    bridge.fireEvent(constants.Events.done, constants.AppResult.error);
                });
            },
            ready: (element, options) => {
                require(['lib/knockout', 'jsCommon/knockout-helpers', 'jsCommon/oobe-gesture-manager', 'legacy/bridge', 'legacy/core', 'legacy/events', 'oobeeula-vm', 'lib/knockout-winjs'], (ko, KoHelpers, gestureManager, bridge, core, constants, EulaViewModel) => {
                    // Setup knockout customizations
                    koHelpers = new KoHelpers();
                    koHelpers.registerCustomComponents();

                    // Apply bindings and show the page
                    let vm = new EulaViewModel(this.resourceStrings, page.titleResourceId, this.eulaData, gestureManager);
                    ko.applyBindings(vm);
                    KoHelpers.waitForInitialComponentLoadAsync().then(() => {
                        WinJS.Utilities.addClass(document.body, "pageLoaded");
                        bridge.fireEvent(constants.Events.visible, true);
                        KoHelpers.setFocusOnAutofocusElement();
                        if (page.shouldStartVoiceOver)
                        {
                            vm.startVoiceOver();
                        }
                        vm.subscribeToDeviceInsertion(gestureManager);
                    });
                });
            }
        });
    });
})();
