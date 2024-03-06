//
// Copyright (C) Microsoft. All rights reserved.
//

"use strict";

(() => {
    WinJS.UI.Pages.define("/webapps/inclusiveOobe/view/autopilot/autopilotespprogress-main.html", {
        init: (element, options) => {
            require.config(new RequirePathConfig('/webapps/inclusiveOobe'));

            // Get the scenario context, then load the css for the scenario
            let getContextAndLoadCssPromise = requireAsync(['legacy/bridge']).then((result) => {
                return result.legacy_bridge.invoke("CloudExperienceHost.getContext");
            }).then((result) => {
                let host = result.host.toLowerCase();

                switch (host) {
                    case "nthaadormdm":
                    case "nthentormdm":
                    case "mosetmdmconnecttoworkprovisioningprogress":
                        this.isInOobe = false;
                        break;

                    default:
                        this.isInOobe = true;
                }
            }).then(() => {
                requireAsync(['legacy/uiHelpers', 'legacy/bridge', 'legacy/core']).then(async (result) => {
                    if (this.isInOobe) {
                        // Device ESP
                        return result.legacy_uiHelpers.LoadCssPromise(document.head, "", result.legacy_bridge);
                    } else {
                        // User ESP should also use the FRXINCLUSIVE (OOBE) stylesheet
                        return result.legacy_uiHelpers.LoadPersonalityCssPromise(document.head, "", CloudExperienceHost.TargetPersonality.InclusiveBlue, result.legacy_bridge);
                    }
                });
            }).then(() => {
                if (!this.isInOobe) {
                    // Set the background as the same color as the inner webapp to match the other webapps in the scenario
                    document.getElementById('_htmlRoot').style.background = '#004275';
                }
            });

            let langAndDirPromise = requireAsync(['legacy/uiHelpers', 'legacy/bridge']).then((result) => {
                return result.legacy_uiHelpers.LangAndDirPromise(document.documentElement, result.legacy_bridge);
            });

            let getLocalizedStringsPromise = requireAsync(['legacy/bridge']).then((result) => {
                return result.legacy_bridge.invoke("CloudExperienceHost.AutoPilot.makeAutopilotResourceObject");
            }).then((result) => {
                this.resourceStrings = JSON.parse(result);
            });

            // Load flag indicating whether PPKG processing should occur.
            this.runProvisioning = false;

            let runProvisioningPromise = requireAsync(['legacy/bridge']).then((result) => {
                return result.legacy_bridge.invoke("CloudExperienceHost.AutoPilot.EnrollmentStatusPage.runProvisioningInStatusPageAsync");
            }).then((result) => {
                this.runProvisioning = (result === 1);
            });

            // Load flag indicating whether MDM session tasks need to be restored.
            this.restoreMdmTasks = false;

            let restoreMdmTasksPromise = requireAsync(['legacy/bridge']).then((result) => {
                return result.legacy_bridge.invoke("CloudExperienceHost.AutoPilot.EnrollmentStatusPage.restoreMDMSyncTasks");
            }).then((result) => {
                this.restoreMdmTasks = (result === 1);
            });

            // SurfaceHub AP Selfdeploy flight feature name
            const feature_AutopilotSurfaceHub22H2 = "AutopilotSurfaceHub22H2";
            if (CloudExperienceHostAPI.FeatureStaging.isOobeFeatureEnabled(feature_AutopilotSurfaceHub22H2)) {
                // Checks if is running on surfacehub
                this.isRunningOnHub = false;

                let isRunningOnHubPromise = requireAsync(['legacy/bridge']).then((result) => {
                    return result.legacy_bridge.invoke("CloudExperienceHost.AutoPilot.EnrollmentStatusPage.getIsRunningOnHubAsync");
                }).then((isHub) => {
                    this.isRunningOnHub = isHub;
                })

                return WinJS.Promise.join({
                    getContextAndLoadCssPromise: getContextAndLoadCssPromise,
                    getLocalizedStringsPromise: getLocalizedStringsPromise,
                    langAndDirPromise: langAndDirPromise,
                    restoreMdmTasksPromise: restoreMdmTasksPromise,
                    runProvisioningPromise: runProvisioningPromise,
                    isRunningOnHubPromise: isRunningOnHubPromise
                });
            }
            else {
                return WinJS.Promise.join({
                    getContextAndLoadCssPromise: getContextAndLoadCssPromise,
                    getLocalizedStringsPromise: getLocalizedStringsPromise,
                    langAndDirPromise: langAndDirPromise,
                    restoreMdmTasksPromise: restoreMdmTasksPromise,
                    runProvisioningPromise: runProvisioningPromise
                });
            }
        },

        error: (e) => {
            require(['legacy/bridge', 'legacy/events'], (bridge, constants) => {
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot enrollment status page failed to load", JSON.stringify({ error: e }));
                bridge.fireEvent(constants.Events.done, constants.AppResult.error);
            });
        },

        ready: (element, options) => {
            require(
                [
                    'lib/knockout',
                    'jsCommon/knockout-helpers',
                    'legacy/bridge',
                    'legacy/events',
                    'autopilot/autopilotespprogress-vm',
                    'autopilot/bootstrapSessionGeneralUtilities',
                    'autopilot/bootstrapStatusCategoryView',
                    'autopilot/devicePreparationCategoryViewModel',
                    'autopilot/deviceSetupCategoryViewModel',
                    'autopilot/accountSetupCategoryViewModel'
                ],
                (
                    ko,
                    koHelpers,
                    bridge,
                    constants,
                    autopilotEspProgressViewModel,
                    bootstrapSessionGeneralUtilities,
                    bootstrapStatusCategoryView,
                    devicePreparationCategoryViewModel,
                    deviceSetupCategoryViewModel,
                    accountSetupCategoryViewModel) => {

                    // Create the global session utilities object used by all classes.
                    // Having a single global object lets classes communication with each other
                    // (e.g., pass data) more easily.
                    this.sessionUtilities = new bootstrapSessionGeneralUtilities(this.isInOobe);

                    // Store state used by other classes.
                    this.sessionUtilities.storeSettingAsync(
                        this.sessionUtilities.STATE_NAME_GLOBAL_RUN_PROVISIONING,
                        this.runProvisioning ? "true" : "false");

                    this.sessionUtilities.storeSettingAsync(
                        this.sessionUtilities.STATE_NAME_GLOBAL_RESTORE_MDM_TASKS,
                        this.restoreMdmTasks ? "true" : "false");

                    this.sessionUtilities.storeSettingAsync(
                        this.sessionUtilities.STATE_NAME_GLOBAL_MDM_ENROLLMENT_STATUS,
                        this.sessionUtilities.MDM_ENROLLMENT_DISPOSITION[EnterpriseDeviceManagement.Service.AutoPilot.EnrollmentDisposition.unknown]);

                    // Register categories to display here.  Categories are displayed in the same order
                    // on the page as listed here.
                    let categoryRegistrations = [
                        devicePreparationCategoryViewModel,
                        deviceSetupCategoryViewModel,
                        accountSetupCategoryViewModel
                    ];

                    // Setup knockout customizations
                    let koPageHelpers = new koHelpers();
                    koPageHelpers.registerCustomComponents();
                    window.KoHelpers = koHelpers;

                    // Instantiate status categories.  Each category dynamically creates the HTML for the category
                    // and appends the HTML to this categoriesTable.
                    let categoriesTable = element.querySelector("#categoriesTable");

                    let categoryViews = [];
                    let categoryViewInitializationPromises = [];

                    const feature_AutopilotSurfaceHub22H2 = "AutopilotSurfaceHub22H2";
                    if (CloudExperienceHostAPI.FeatureStaging.isOobeFeatureEnabled(feature_AutopilotSurfaceHub22H2)) {
                        for (let i = 0; i < categoryRegistrations.length; i++) {
                            let registration = new categoryRegistrations[i](
                                this.resourceStrings,
                                this.sessionUtilities,
                                this.isRunningOnHub)

                            let categoryView = new bootstrapStatusCategoryView(
                                this.resourceStrings,
                                this.sessionUtilities,
                                categoriesTable,
                                registration)

                            categoryViews.push(categoryView);

                            // Save off the current category's promise that performs category-specific initialization.
                            let currentInitializationPromise = categoryViews[i].getInitializationPromise();
                            if (currentInitializationPromise !== null) {
                                categoryViewInitializationPromises.push(currentInitializationPromise);
                            }
                        }
                    }
                    else {
                        for (let i = 0; i < categoryRegistrations.length; i++) {
                            categoryViews.push(new bootstrapStatusCategoryView(
                                this.resourceStrings,
                                this.sessionUtilities,
                                categoriesTable,
                                new categoryRegistrations[i](
                                    this.resourceStrings,
                                    this.sessionUtilities)));

                            // Save off the current category's promise that performs category-specific initialization.
                            let currentInitializationPromise = categoryViews[i].getInitializationPromise();
                            if (currentInitializationPromise !== null) {
                                categoryViewInitializationPromises.push(currentInitializationPromise);
                            }
                        }
                    }

                    // Apply bindings and show the page
                    let vm = new autopilotEspProgressViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        categoryViews,
                        categoryViewInitializationPromises);

                    ko.applyBindings(vm);

                    KoHelpers.waitForInitialComponentLoadAsync().then(() => {
                        WinJS.Utilities.addClass(document.body, "pageLoaded");
                        bridge.fireEvent(constants.Events.visible, true);
                        KoHelpers.setFocusOnAutofocusElement();
                    });
            });
        }
    });
})();
