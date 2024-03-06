//
// Copyright (C) Microsoft. All rights reserved.
//
(() => {
    WinJS.UI.Pages.define("/webapps/inclusiveOobe/view/oobezdp-main.html", {
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
                return result.legacy_bridge.invoke("CloudExperienceHost.StringResources.makeResourceObject", "oobeZdp");
            }).then((result) => {
                this.resourceStrings = JSON.parse(result);
            });

            return WinJS.Promise.join({ loadCssPromise: loadCssPromise, langAndDirPromise: langAndDirPromise, getLocalizedStringsPromise: getLocalizedStringsPromise });
        },
        error: (e) => {
            require(['legacy/bridge', 'legacy/events', 'legacy/appObjectFactory', 'optional!sample/CloudExperienceHost.Telemetry.WebAppTelemetry'],
            (bridge, constants, appObjectFactory) => {
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "ZDPFailure", JSON.stringify({ objectType: e && e.toString(), status: e.status && e.status.toString() }));
                bridge.fireEvent(constants.Events.done, constants.AppResult.error);
            });
        },
        ready: (element, options) => {
            require(['lib/knockout', 'jsCommon/knockout-helpers', 'oobezdp-vm'], (ko, KoHelpers, ZdpModel) => {
                // Setup knockout customizations
                koHelpers = new KoHelpers();
                koHelpers.registerCustomComponents();

                // Apply bindings. The page will show up when zdp status becomes scanning
                ko.applyBindings(new ZdpModel(this.resourceStrings));
            });
        }
    });
})();
