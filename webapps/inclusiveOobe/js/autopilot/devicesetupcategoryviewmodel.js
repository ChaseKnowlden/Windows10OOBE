//
// Copyright (C) Microsoft. All rights reserved.
//

"use strict";

define([
    'legacy/bridge',
    'legacy/events',
    'legacy/core',
    'autopilot/bootstrapStatusSubcategoryViewModel',
    'autopilot/mdmBootstrapSessionUtilities',
    'autopilot/commercialDiagnosticsUtilities'], (
        bridge,
        core,
        constants,
        bootstrapStatusSubcategoryViewModel,
        mdmBootstrapSessionUtilities,
        commercialDiagnosticsUtilities) => {

    class deviceSetupCategoryViewModel {
        constructor(resourceStrings, sessionUtilities, isRunningOnHub) {
            // Constants
            this.rebootRequiredToCommitSettingsSettingName = "ESP.Device.rebootRequiredToCommitSettings";
            this.defaultWaitToInitiateSyncSessionsInMilliseconds = 1000; // 1 second

            // Private member variables
            this.resourceStrings = resourceStrings;
            this.sessionUtilities = sessionUtilities;
            this.mdmBootstrapSessionUtilities = new mdmBootstrapSessionUtilities(
                resourceStrings,
                this.sessionUtilities.runningInOobe(),
                sessionUtilities);
            this.securityPoliciesProvisioningSucceeded = true;
            this.certificatesProvisioningSucceeded = true;
            this.networkProfilesProvisioningSucceeded = true;
            this.appsProvisioningSucceeded = true;
            this.isRunningOnHub = isRunningOnHub;

            // Error constants
            this.E_AUTOPILOT_SURFACE_HUB_CSP_GENERIC_FAILURE = 0x8103A000; // defined in AutopilotErrors.mc
            this.FEATURE_AUTOPILOTSURFACEHUB22H2 = "AutopilotSurfaceHub22H2";

            if (CloudExperienceHostAPI.FeatureStaging.isOobeFeatureEnabled(this.FEATURE_AUTOPILOTSURFACEHUB22H2)) {
                this.commercialDiagnosticsUtilities = new commercialDiagnosticsUtilities();
            }

            // The background sync sessions need to be initiated only once for all the MDM-monitored
            // subcategories in this category.  Creating a single promise will ensure that singleton.
            // Syncs are reinitiated after every reboot, and so sync lifetime should match
            // with this category's lifetime.
            this.syncSyncSessionsShouldStart = false;
            this.waitForSyncSessionsInitiationPromise = this.waitForSyncSessionsInitiationAsync();

            this.initializationPromise = this.sessionUtilities.autopilotApis.getDeviceAutopilotModeAsync().then((mode) => {
                this.whiteGloveMode = mode;
            });
        }

        waitForSyncSessionsInitiationAsync() {
            if (this.syncSyncSessionsShouldStart) {
                this.sessionUtilities.logInfoEvent("BootstrapStatus: Start background sync sessions for Device Setup.");

                // This is a fire and forget operation because sendResultsToMdmServerAsync sets the IsSyncDone node to actually break out of this wait
                this.mdmBootstrapSessionUtilities.initiateSyncSessionsAsync(ModernDeployment.Autopilot.Core.SyncSessionExitCondition.deviceSetupComplete);

                return WinJS.Promise.as(true);
            } else {
                // Keep polling for the signal to initiate background sync sessions.
                return WinJS.Promise.timeout(this.defaultWaitToInitiateSyncSessionsInMilliseconds).then(() => {
                    return this.waitForSyncSessionsInitiationAsync();
                });
            }
        }

        coalesceRebootsAsync() {
            return this.sessionUtilities.getSettingAsync(this.rebootRequiredToCommitSettingsSettingName).then((isRebootRequired) => {
                // Should only reboot in OOBE.  This makes sure the web app doesn't "Fall off" before pin.
                if (isRebootRequired === "true") {
                    this.sessionUtilities.logInfoEvent("BootstrapStatus: Coalesced reboot required.");

                    // Returning this state will tell the framework to do the actual reboot and resume this subcategory post-reboot.
                    return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                        this.sessionUtilities.SUBCATEGORY_STATE_REBOOT_REQUIRED_AND_TRY_AGAIN,
                        null));
                }

                return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                    this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                    null));
            });
        }

        sendResultsToMdmServerAsync() {
            // Best effort
            try {
                this.sessionUtilities.logInfoEvent("BootstrapStatus: Device setup category sending success results to MDM server.");

                this.sessionUtilities.enrollmentApis.updateServerWithResult(true, this.sessionUtilities.runningInOobe());

                this.sessionUtilities.logInfoEvent("BootstrapStatus: Device setup category sent success results to MDM server.");
            } catch (e) {
                this.sessionUtilities.logErrorEvent("Failed to send results to MDM server, likely due to setting an already-failed provisioning status.", e);
            }

            return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                null));
        }

        saveWhiteGloveSuccessResultAsync() {
            // Since this is the last action in this category, if it gets invoked, that implies all actions succeeded,
            // which itself implies White Glove succeeded.
            if ((this.whiteGloveMode === EnterpriseDeviceManagement.Service.AutoPilot.AutopilotMode.whiteGloveCanonical) ||
                (this.whiteGloveMode === EnterpriseDeviceManagement.Service.AutoPilot.AutopilotMode.whiteGloveDJPP)) {
                return bridge.invoke("CloudExperienceHost.Storage.SharableData.addValue", this.sessionUtilities.WHITE_GLOVE_SUCCESS_VALUE_NAME, true).then(() => {
                    return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                        this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                        null));
                });
            }

            return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                null));
        }

        waitForHubDeviceAccountApplyAsync() {
            bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "waitForHubDeviceAccountApplyAsync start");

            return this.sessionUtilities.surfaceHubHelper.applyPropertiesAsync().then(() => {
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "waitForHubDeviceAccountApplyAsync succeeded");

                return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                    this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                    null));
            }, (error) => {
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "waitForHubDeviceAccountApplyAsync failed");
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "error", JSON.stringify({ number: error.number.toString(16), description: error.description }));

                let errorJson = core.GetJsonFromError(error);
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "waitForHubDeviceAccountApplyAsync", errorJson);

                let errorCode = error.number ? error.number : this.E_AUTOPILOT_SURFACE_HUB_CSP_GENERIC_FAILURE;

                this.hubDeviceAccountApplyErrorString = this.commercialDiagnosticsUtilities.formatNumberAsHexString(errorCode, 8);

                return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                    this.sessionUtilities.SUBCATEGORY_STATE_FAILED,
                    this.hubDeviceAccountApplyErrorString));
            });
        }

        // Category interface methods

        getId() {
            return "DeviceSetupCategory";
        }

        getTitle() {
            return this.resourceStrings["BootstrapPageDeviceSetupCategoryTitle"];
        }

        getIconClass() {
            return "icon-devices";
        }

        getDisposition() {
            return (this.sessionUtilities.runningInOobe() ? this.sessionUtilities.CATEGORY_DISPOSITION_VISIBLE : this.sessionUtilities.CATEGORY_DISPOSITION_IGNORED);
        }

        runsInOobe() {
            return true;
        }

        getInitializationPromise() {
            return this.initializationPromise;
        }

        getSubcategories() {
            if (CloudExperienceHostAPI.FeatureStaging.isOobeFeatureEnabled(this.FEATURE_AUTOPILOTSURFACEHUB22H2)) {
                return [
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.SecurityPoliciesSubcategory",
                        this.resourceStrings["BootstrapPageSecurityPoliciesSubcategoryTitle"],
                        true,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                        },
                        (progressCallbackAsync) => {
                            // Ensure the background sync sessions are initiated first.
                            this.syncSyncSessionsShouldStart = true;

                            return this.waitForSyncSessionsInitiationPromise.then(() => {
                                return this.mdmBootstrapSessionUtilities.monitorPoliciesApplicationAsync(progressCallbackAsync);
                            }).then((actionResult) => {
                                this.securityPoliciesProvisioningSucceeded = this.sessionUtilities.subcategorySucceeded(actionResult.actionResultState);

                                return actionResult;
                            });
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.CertificatesSubcategory",
                        this.resourceStrings["BootstrapPageCertificatesSubcategoryTitle"],
                        true,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                        },
                        (progressCallbackAsync) => {
                            // Ensure the background sync sessions are initiated first.
                            this.syncSyncSessionsShouldStart = true;

                            return this.waitForSyncSessionsInitiationPromise.then(() => {
                                return this.mdmBootstrapSessionUtilities.monitorCertsInstallationAsync(progressCallbackAsync);
                            }).then((actionResult) => {
                                this.certificatesProvisioningSucceeded = this.sessionUtilities.subcategorySucceeded(actionResult.actionResultState);

                                return actionResult;
                            });
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.NetworkConnectionsSubcategory",
                        this.resourceStrings["BootstrapPageNetworkConnectionsSubcategoryTitle"],
                        true,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                        },
                        (progressCallbackAsync) => {
                            // Ensure the background sync sessions are initiated first.
                            this.syncSyncSessionsShouldStart = true;

                            return this.waitForSyncSessionsInitiationPromise.then(() => {
                                return this.mdmBootstrapSessionUtilities.monitorNetworkProfilesConfigAsync(progressCallbackAsync);
                            }).then((actionResult) => {
                                this.networkProfilesProvisioningSucceeded = this.sessionUtilities.subcategorySucceeded(actionResult.actionResultState);

                                return actionResult;
                            });
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.AppsSubcategory",
                        this.resourceStrings["BootstrapPageAppsSubcategoryTitle"],
                        true,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                        },
                        (progressCallbackAsync) => {
                            // Ensure the background sync sessions are initiated first.
                            this.syncSyncSessionsShouldStart = true;

                            return this.waitForSyncSessionsInitiationPromise.then(() => {
                                return this.mdmBootstrapSessionUtilities.monitorAppsInstallAsync(progressCallbackAsync);
                            }).then((actionResult) => {
                                this.appsProvisioningSucceeded = this.sessionUtilities.subcategorySucceeded(actionResult.actionResultState);

                                return actionResult;
                            });
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.HubDeviceAccountApply",
                        this.resourceStrings["BootstrapPageHubDeviceAccountApplyTitle"],
                        true,
                        () => {
                            // Determine if this is running on SurfaceHub or not
                            if (this.isRunningOnHub) {
                                return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                            } else {
                                return this.sessionUtilities.SUBCATEGORY_DISPOSITION_IGNORED;
                            }
                        },
                        (progressCallbackAsync) => {
                            // Surface Hub Device Account CSP data should have come down as a policy so ensure policies are complete.
                            // We do not want to break parallelization of the other subcategories and can't chain this otherwise.
                            this.syncSyncSessionsShouldStart = true;
                            return this.waitForSyncSessionsInitiationPromise.then(() => {
                                return this.mdmBootstrapSessionUtilities.monitorPoliciesApplicationAsync(progressCallbackAsync);
                            }).then((actionResult) => {
                                if (actionResult.actionResultState === this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED) {
                                    return this.waitForHubDeviceAccountApplyAsync();
                                } else {
                                    return actionResult;
                                }
                            });
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.RebootCoalescing",
                        "DeviceSetup.RebootCoalescing", // Title is mandatory, even for silent subcategories.
                        false,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_SILENT;
                        },
                        (progressCallbackAsync) => {
                            return this.coalesceRebootsAsync();
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.SendResultsToMdmServer",
                        "DeviceSetup.SendResultsToMdmServer", // Title is mandatory, even for silent subcategories.
                        false,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_SILENT;
                        },
                        (progressCallbackAsync) => {
                            return this.sendResultsToMdmServerAsync();
                        }
                    ),

                    // This MUST be last in the list of actions.
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.SaveWhiteGloveSuccessResult",
                        "DeviceSetup.SaveWhiteGloveSuccessResult", // Title is mandatory, even for silent subcategories.
                        false,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_SILENT;
                        },
                        (progressCallbackAsync) => {
                            return this.saveWhiteGloveSuccessResultAsync();
                        }
                    )];
            }
            else {
                return [
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.SecurityPoliciesSubcategory",
                        this.resourceStrings["BootstrapPageSecurityPoliciesSubcategoryTitle"],
                        true,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                        },
                        (progressCallbackAsync) => {
                            // Ensure the background sync sessions are initiated first.
                            this.syncSyncSessionsShouldStart = true;

                            return this.waitForSyncSessionsInitiationPromise.then(() => {
                                return this.mdmBootstrapSessionUtilities.monitorPoliciesApplicationAsync(progressCallbackAsync);
                            }).then((actionResult) => {
                                this.securityPoliciesProvisioningSucceeded = this.sessionUtilities.subcategorySucceeded(actionResult.actionResultState);

                                return actionResult;
                            });
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.CertificatesSubcategory",
                        this.resourceStrings["BootstrapPageCertificatesSubcategoryTitle"],
                        true,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                        },
                        (progressCallbackAsync) => {
                            // Ensure the background sync sessions are initiated first.
                            this.syncSyncSessionsShouldStart = true;

                            return this.waitForSyncSessionsInitiationPromise.then(() => {
                                return this.mdmBootstrapSessionUtilities.monitorCertsInstallationAsync(progressCallbackAsync);
                            }).then((actionResult) => {
                                this.certificatesProvisioningSucceeded = this.sessionUtilities.subcategorySucceeded(actionResult.actionResultState);

                                return actionResult;
                            });
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.NetworkConnectionsSubcategory",
                        this.resourceStrings["BootstrapPageNetworkConnectionsSubcategoryTitle"],
                        true,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                        },
                        (progressCallbackAsync) => {
                            // Ensure the background sync sessions are initiated first.
                            this.syncSyncSessionsShouldStart = true;

                            return this.waitForSyncSessionsInitiationPromise.then(() => {
                                return this.mdmBootstrapSessionUtilities.monitorNetworkProfilesConfigAsync(progressCallbackAsync);
                            }).then((actionResult) => {
                                this.networkProfilesProvisioningSucceeded = this.sessionUtilities.subcategorySucceeded(actionResult.actionResultState);

                                return actionResult;
                            });
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.AppsSubcategory",
                        this.resourceStrings["BootstrapPageAppsSubcategoryTitle"],
                        true,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                        },
                        (progressCallbackAsync) => {
                            // Ensure the background sync sessions are initiated first.
                            this.syncSyncSessionsShouldStart = true;

                            return this.waitForSyncSessionsInitiationPromise.then(() => {
                                return this.mdmBootstrapSessionUtilities.monitorAppsInstallAsync(progressCallbackAsync);
                            }).then((actionResult) => {
                                this.appsProvisioningSucceeded = this.sessionUtilities.subcategorySucceeded(actionResult.actionResultState);

                                return actionResult;
                            });
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.RebootCoalescing",
                        "DeviceSetup.RebootCoalescing", // Title is mandatory, even for silent subcategories.
                        false,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_SILENT;
                        },
                        (progressCallbackAsync) => {
                            return this.coalesceRebootsAsync();
                        }
                    ),
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.SendResultsToMdmServer",
                        "DeviceSetup.SendResultsToMdmServer", // Title is mandatory, even for silent subcategories.
                        false,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_SILENT;
                        },
                        (progressCallbackAsync) => {
                            return this.sendResultsToMdmServerAsync();
                        }
                    ),

                    // This MUST be last in the list of actions.
                    new bootstrapStatusSubcategoryViewModel(
                        this.resourceStrings,
                        this.sessionUtilities,
                        "DeviceSetup.SaveWhiteGloveSuccessResult",
                        "DeviceSetup.SaveWhiteGloveSuccessResult", // Title is mandatory, even for silent subcategories.
                        false,
                        () => {
                            return this.sessionUtilities.SUBCATEGORY_DISPOSITION_SILENT;
                        },
                        (progressCallbackAsync) => {
                            return this.saveWhiteGloveSuccessResultAsync();
                        }
                    )];
            }
        }

        getClickHandler() {
            return (handlerParameters) => {
                switch (handlerParameters.clickedItemId) {
                    case this.sessionUtilities.CLICKABLE_ITEM_ID_CONTINUE_ANYWAY_BUTTON:
                        return new WinJS.Promise(
                            // Promise initialization
                            (completeDispatch, errorDispatch, progressDispatch) => {
                                if (!this.securityPoliciesProvisioningSucceeded ||
                                    !this.certificatesProvisioningSucceeded ||
                                    !this.networkProfilesProvisioningSucceeded ||
                                    !this.appsProvisioningSucceeded) {
                                    try {
                                        this.sessionUtilities.logInfoEvent("One of the provisioning subcategories failed, so kicking off MDM polling tasks.");
                                        this.sessionUtilities.enrollmentApis.startPollingTask();
                                    } catch (e) {
                                        this.sessionUtilities.logErrorEvent("Error starting the MDM polling tasks.", e);
                                    }
                                }

                                // True means that this handler succeeded.
                                completeDispatch(true);
                            },

                            // Cancellation event handler
                            () => {
                            });

                    case this.sessionUtilities.CLICKABLE_ITEM_ID_TRY_AGAIN_BUTTON:
                        return new WinJS.Promise(
                            // Promise initialization
                            (completeDispatch, errorDispatch, progressDispatch) => {
                                // Restart the sync sessions on a retry.  It's OK to start another set of sessions even
                                // if one set is already running, since the underlying session-running API serializes sessions
                                // across all sets. Starting another set on retry also ensures that the retry's sessions
                                // time out on the full timeout period.
                                this.syncSyncSessionsShouldStart = false;
                                this.waitForSyncSessionsInitiationPromise = this.waitForSyncSessionsInitiationAsync();

                                // True means that this handler succeeded.
                                completeDispatch(true);
                            },

                            // Cancellation event handler
                            () => {
                            });

                    default:
                        this.sessionUtilities.logErrorEvent("Unhandled click handler item");
                }

                // True means that this handler succeeded.
                return WinJS.Promise.as(true);
            };
        }
    }

    return deviceSetupCategoryViewModel;
});
