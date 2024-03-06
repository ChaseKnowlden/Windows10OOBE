//
// Copyright (C) Microsoft. All rights reserved.
//

define(['lib/knockout', 'legacy/bridge', 'legacy/events'], (ko, bridge, constants) => {
    class AutopilotActivationViewModel {
        constructor(resourceStrings) {
            this.activationText = ko.observable(resourceStrings.ActivationText);
            this.autoPilotSubscriptionManager = new EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotWnfSubscriptionManager();
            this.connectionProfile = Windows.Networking.Connectivity.NetworkInformation.getInternetConnectionProfile();
            this.profileAvailableTimeout = null;

            // Queue an async trigger to acquire the profile now that we have a new network.  This may be a no-op if we already have a profile.
            this.populateZTPPolicyCache();

            this.profileAvailableTimeout = WinJS.Promise.timeout(180000/*3 minutes */).then(function () {
                this.autoPilotSubscriptionManager.removeEventListener("profileavailable", this.onProfileAvailable.bind(this));
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_RetrievingAutopilotProfileTimeout");
                this.activationText(resourceStrings.ActivationErrorText);

                // Wait for 5 seconds after showing the error message, then navigate back to Wireless page
                WinJS.Promise.timeout(5000 /*5 second timeout*/).then(() => {
                    this.connectionProfile.tryDeleteAsync().done(function (result) {
                        bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_DeleteWifiProfileAsyncResult", result);
                    }, function (e) {
                        bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_DeleteWifiProfileAsyncError", JSON.stringify({ number: e && e.number.toString(16), stack: e && e.asyncOpSource && e.asyncOpSource.stack }));
                    })
                    bridge.fireEvent(constants.Events.done, constants.AppResult.fail);
                });

            }.bind(this));

            this.autoPilotSubscriptionManager.addEventListener("profileavailable", this.onProfileAvailable.bind(this));
        }

        populateZTPPolicyCache() {
            bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_populateZTPPolicyCacheStarted");
            let startTime = performance.now();
            // This API will return immediately if a profile already exists or is not applicable on this SKU.  It is also re-entrant so multiple calls
            // are coordinated through the service and shouldn't be a problem.
            let populateAutoPilotPoliciesPromise = EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotUtilStatics.retrieveSettingsAsync().then(() => {
                let details = { timeElapsed: performance.now() - startTime };
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_oobeZTPCacheReturned", JSON.stringify(details));
            }, (error) => {
                let errorJson = core.GetJsonFromError(error);
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_oobeZTPCacheFailure", errorJson);
            });

            setImmediate(() => { populateAutoPilotPoliciesPromise });
        }

        onProfileAvailable(hresult) {
            bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_AutopilotProfileAvailableNotificationReceived");
            if (this.profileAvailableTimeout != null) {
                this.profileAvailableTimeout.cancel();
                this.profileAvailableTimeout = null;
            }
            EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotUtilStatics.getProfileStateAsync().then(function (result) {
                if (EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotProfileState.notProvisioned == result) {
                    EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotUtilStatics.clearNetworkRequiredFlagAsync().then(function (res) {
                        bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_ClearedNetworkRequiredFlagAsync")
                    }, function (e) {
                        bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_ErrorClearingNetworkRequiredFlagAsync", JSON.stringify({ number: e && e.number.toString(16), stack: e && e.asyncOpSource && e.asyncOpSource.stack }));
                    });
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_AutopilotProfileNotExist");
                }
                else if (EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotProfileState.available == result) {
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_AutopilotProfileExist");
                }
                else {
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_AutopilotProfileState", result);
                }
                bridge.fireEvent(constants.Events.done, constants.AppResult.success);
            }, function (e) {
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Autopilot_ActivationPage_ErrorReadingAutopilotProfileState", JSON.stringify({ number: e && e.number.toString(16), stack: e && e.asyncOpSource && e.asyncOpSource.stack }));
            });
        }

    }
    return AutopilotActivationViewModel;
});
