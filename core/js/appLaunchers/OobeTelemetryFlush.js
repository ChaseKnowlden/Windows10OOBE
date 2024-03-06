//
// Copyright (C) Microsoft. All rights reserved.
//

define(['legacy/core'], (core) => {
    class OobeTelemetryFlush {
        launchAsync() {
            try
            {
                // Skip if there is no internet access.
                if (!CloudExperienceHost.Environment.hasInternetAccess()) {
                    return this.setNetworkStateAndReturnAppResultAsync(CloudExperienceHost.AppResult.abort);
                }

                // These are hardcoded here as OOBE runs before any of the other mechanisms we would use to determine
                // what placement id to use for internal vs external. 
                // Please reference onecoreuap\shell\contentdeliverymanager\utils\inc\TargetedContentConfiguration.h
                let internalSubscriptionId = "314566";
                let externalSubscriptionId = "314567";
                let currentSubscriptionId;

                // Internal content should only ever be enabled on internal branches, so we use FeatureStaging/Velocity to enforce that
                if (AppObjectFactory.getInstance().getObjectFromString("CloudExperienceHost.FeatureStaging").isOobeFeatureEnabled("OobeInternalContent")) {
                    currentSubscriptionId = internalSubscriptionId;
                }
                else {
                    currentSubscriptionId = externalSubscriptionId;
                }

                let self = this;
                return CloudExperienceHostAPI.ContentDeliveryManagerHelpers.flushReportedInteractionsAsync(currentSubscriptionId).then(function () {
                    CloudExperienceHost.Telemetry.logEvent("oobeTelemetryFlushSucceeded");
                    return self.setNetworkStateAndReturnAppResultAsync(CloudExperienceHost.AppResult.success);
                }, function (err) {
                    CloudExperienceHost.Telemetry.logEvent("oobeTelemetryFlushAsyncOperationFailure", core.GetJsonFromError(err));
                    return self.setNetworkStateAndReturnAppResultAsync(CloudExperienceHost.AppResult.fail);
                });
            }
            catch (err) {
                CloudExperienceHost.Telemetry.logEvent("oobeTelemetryFlushFailure", core.GetJsonFromError(err));
                return WinJS.Promise.as(CloudExperienceHost.AppResult.fail);
            }
        }

        setNetworkStateAndReturnAppResultAsync(result) {
            let networkState = CloudExperienceHost.Environment.hasInternetAccess() ? 1 : 0;
            let setNetworkStatePromise = CloudExperienceHostAPI.UserIntentRecordCore.setIntentPropertyDWORDAsync("Wireless", "NetworkState", networkState);
            let setStatePromise = setNetworkStatePromise;
            if (CloudExperienceHostAPI.FeatureStaging.isOobeFeatureEnabled("LaunchScoobeWhenInternetFirstAvailable") && (networkState === 0)) {
                // If network was disconnected during OOBE and the SCOOBE on first connect feature is enabled, write the corresponding state.
                // Note: Due to constraints around the servicing ship vehicle and the fact that the SCOOBE on First Connect feature cannot be cloud-configured, the only
                // way that OEMs can turn it off is by setting "ScoobeCheckCompleted" registry state in the default user profile.  Therefore, we
                // need to version registry state for this feature, keeping it in sync with %SDXROOT%\net\config\shell\pnidui\maindlg.cpp.
                let setScoobeOnFirstConnectPromise = CloudExperienceHostAPI.UserIntentRecordCore.setIntentPropertyDWORDAsync("Wireless", "ScoobeOnFirstConnectV2", 1);
                setStatePromise = WinJS.Promise.join({ setNetworkStatePromise: setNetworkStatePromise, setScoobeOnFirstConnectPromise: setScoobeOnFirstConnectPromise });
            }

            return setStatePromise.then(function () {
                CloudExperienceHost.Telemetry.logEvent("NetworkStateRecordedSuccess");
                return result;
            }, function (err) {
                CloudExperienceHost.Telemetry.logEvent("NetworkStateRecordedFailure", core.GetJsonFromError(err));
                return result;
            });
        }
    }
    return OobeTelemetryFlush;
});
