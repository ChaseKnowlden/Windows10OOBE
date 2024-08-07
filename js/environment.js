//
// Copyright (C) Microsoft. All rights reserved.
//
/// <disable>JS2085.EnableStrictMode</disable>
"use strict";
var CloudExperienceHost;
(function (CloudExperienceHost) {
    class Environment {
        static getTarget() {
            var retValue;
            var regValue = CloudExperienceHostAPI.Environment.target;
            switch (regValue) {
                case 0:
                    retValue = CloudExperienceHost.TargetEnvironment.PROD;
                    break;
                case 1:
                    retValue = CloudExperienceHost.TargetEnvironment.INT;
                    break;
                default:
                    retValue = CloudExperienceHost.TargetEnvironment.PROD;
                    break;
            }
            return retValue;
        }
        static hasInternetAccess() {
            let hasInternetAccess = false;
            let connectionProfile = Windows.Networking.Connectivity.NetworkInformation.getInternetConnectionProfile();
            if (connectionProfile && (connectionProfile.getNetworkConnectivityLevel() === Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess)) {
                if (connectionProfile.isWwanConnectionProfile && Environment._isOobeScenario() && !Environment.hasDataMartBeenChecked) {
                    Environment.wwanConnectionIsDataMartSim = Environment.isDataMartSim();
                    Environment.hasDataMartBeenChecked = true;
                }
                hasInternetAccess = !Environment.wwanConnectionIsDataMartSim;
            }
            return hasInternetAccess;
        }
        static hasNetworkConnectivity() {
            let hasNetworkConnectivity = false;
            let ConnectionProfiles = Windows.Networking.Connectivity.NetworkInformation.getConnectionProfiles();
            if (ConnectionProfiles.length !== 0) {
                for (var i = 0; i < ConnectionProfiles.length; i++) {
                    if (ConnectionProfiles[i].getNetworkConnectivityLevel() > Windows.Networking.Connectivity.NetworkConnectivityLevel.none) {
                        hasNetworkConnectivity = true;
                        break;
                    }
                }
            }
            return hasNetworkConnectivity;
        }
        static isDataMartSim() {
            let isDmSim = false;
            try {
                let modem = Windows.Networking.NetworkOperators.MobileBroadbandModem.getDefault();
                if (modem) {
                    let iccid = modem.deviceInformation.simIccId;
                    isDmSim = CloudExperienceHostAPI.UtilStaticsCore.isDataMartSim(iccid);
                }
            }
            catch (exception) {
            }
            return isDmSim;
        }
        static getLicensingPoliciesAsync(namesJson) {
            return new WinJS.Promise(function (completeDispatch, errorDispatch, progressDispatch) {
                let names = JSON.parse(namesJson);
                let results = new Array(names.length);
                for (let i = 0; i < names.length; i++) {
                    results[i] = CloudExperienceHostAPI.UtilStaticsCore.getLicensingPolicyValue(names[i]);
                }
                completeDispatch(JSON.stringify(results));
            });
        }
        static getAnalyticsInfoSystemPropertiesAsync(itemsJson) {
            let items = JSON.parse(itemsJson);
            return Windows.System.Profile.AnalyticsInfo.getSystemPropertiesAsync(items).then((result) => {
                return JSON.stringify(result);
            });
        }
        static isNetworkRequiredAsync() {
            return new WinJS.Promise(function (completeDispatch, errorDispatch, progressDispatch) {
                let result = CloudExperienceHostAPI.UtilStaticsCore.isNetworkRequired;
                completeDispatch(result);
            });
        }
        static GetWiFiHostedApplicationArguments() {
            let propertySet = new Windows.Foundation.Collections.PropertySet();
            if (CloudExperienceHost.FeatureStaging.isOobeFeatureEnabled("Servicing_RequiredNetworkWin10OOBE")) {
                if (CloudExperienceHost.Storage.SharableData.getValue("retailDemoEnabled")) {
                    propertySet.insert("IsNetworkRequired", false);
                }
                else {
                    try {
                        // Wrap new DisabledSkipNetwork call in try/catch in case updated common proxy stub binary isn't present,
                        // which could be the case in an OOBE ZDP scenario
                        propertySet.insert("IsNetworkRequired", CloudExperienceHostAPI.UtilStaticsCore.disabledSkipNetwork);
                    }
                    catch (e) {
                        // If DisabledSkipNetwork API can't be called, fall back to existing IsNetworkRequired call
                        CloudExperienceHost.Telemetry.logEvent("DisabledSkipNetworkApiFailure", CloudExperienceHost.GetJsonFromError(e));
                        propertySet.insert("IsNetworkRequired", CloudExperienceHostAPI.UtilStaticsCore.isNetworkRequired);
                    }
                }
            }
            else {
                propertySet.insert("IsNetworkRequired", CloudExperienceHostAPI.UtilStaticsCore.isNetworkRequired);
            }
            return propertySet;
        }
        static GetWiFiHostedApplicationArgumentsWcosDefaults() {
            let propertySet = new Windows.Foundation.Collections.PropertySet();
            propertySet.insert("NetworkUXMode", "Windows.Core");
            propertySet.insert("IsNetworkRequired", true);
            return propertySet;
        }
        static GetWiFiHostedApplicationArgumentsHub() {
            let propertySet = new Windows.Foundation.Collections.PropertySet();
            propertySet.insert("IsNetworkRequired", true);
            // Reference to NetworkUXMode enum defined in NetworkUX xaml app
            propertySet.insert("NetworkUXMode", "Desktop");
            return propertySet;
        }
        static GetWiFiHostedApplicationArgumentsWcosReconnect() {
            let propertySet = this.GetWiFiHostedApplicationArgumentsWcosDefaults();
            // Insert isReconnect to inform wifi app when coming back to the page for a second time
            propertySet.insert("IsReconnect", true);
            return propertySet;
        }
        static getMachineModel() {
            return CloudExperienceHostAPI.Environment.machineModel;
        }
        static getManufacturer() {
            return CloudExperienceHostAPI.Environment.manufacturer;
        }
        static getPlatform() {
            var retValue;
            var regValue = CloudExperienceHostAPI.Environment.platform;
            switch (regValue) {
                case 3:
                    retValue = CloudExperienceHost.TargetPlatform.DESKTOP;
                    break;
                case 5:
                    retValue = CloudExperienceHost.TargetPlatform.XBOX;
                    break;
                case 6:
                    retValue = CloudExperienceHost.TargetPlatform.SURFACEHUB;
                    break;
                case 10:
                    retValue = CloudExperienceHost.TargetPlatform.HOLOGRAPHIC;
                    break;
                default:
                    // For non-legacy TargetPlatform values (any nturtl > 10)
                    // getPlatform() should reflect the CloudExperienceHostAPI.Environment.platform value directly
                    // Instead of looping back to a predefined CloudExperienceHost.TargetPlatform friendly name.
                    // (core.ts may define a friendly name for an nturtl value if required for CXH app code)
                    retValue = "CloudExperienceHost.Platform." + regValue;
                    break;
            }
            return retValue;
        }
        static getWindowsProductId() {
            return CloudExperienceHostAPI.Environment.windowsProductId.toString();
        }
        static getEdition() {
            return CloudExperienceHostAPI.Environment.edition;
        }
        static isRemoteDesktopSession() {
            var isRemoteDesktopSession = false;
            var interactiveSession = Windows.System.RemoteDesktop.InteractiveSession;
            if (interactiveSession && interactiveSession.isRemote) {
                isRemoteDesktopSession = true;
            }
            return isRemoteDesktopSession;
        }
        static isSpeechDisabled() {
            let navMesh = CloudExperienceHost.getNavMesh();
            return navMesh && navMesh.getSpeechDisabled();
        }
        static _isOobeScenario() {
            let isOobe = false;
            try {
                if (Environment.getPlatform() == CloudExperienceHost.TargetPlatform.XBOX) {
                    isOobe = !Windows.Xbox.System.Internal.XConfig.XConfigProperties.isOobeCompleted;
                }
                else {
                    isOobe = CloudExperienceHost.getContext &&
                        CloudExperienceHost.getContext() &&
                        (CloudExperienceHost.getContext().host.toLowerCase() === "frx");
                }
            }
            catch (e) {
            }
            return isOobe;
        }
        static getTelemetryLevel() {
            return CloudExperienceHostAPI.OobeSettingsManagerStaticsCore.getTelemetryLevel();
        }
    }
    Environment.hasDataMartBeenChecked = false;
    Environment.wwanConnectionIsDataMartSim = false;
    CloudExperienceHost.Environment = Environment;
    class ScoobeContextHelper {
        // Retrieve the current SCOOBE launch instance from SharableData storage.
        // Note that this state is written and managed by the Welcome page, so it's expected to be used only by webapps after Welcome.
        // If called before Welcome, this method will return the launch instance of the previous SCOOBE session.
        static tryGetScoobeLaunchInstance() {
            let scoobeLaunchInstanceObj = { scoobeLaunchInstance: 0, succeeded: false };
            scoobeLaunchInstanceObj.scoobeLaunchInstance = CloudExperienceHost.Storage.SharableData.getValue("ScoobeLaunchInstance");
            scoobeLaunchInstanceObj.succeeded = (scoobeLaunchInstanceObj.scoobeLaunchInstance != null) ? true : false;
            return scoobeLaunchInstanceObj;
        }
    }
    CloudExperienceHost.ScoobeContextHelper = ScoobeContextHelper;
    class OobeExperimentationPages {
        static getShouldSkipAsync() {
            // Always skip these pages for scenarios in which the MSA identity provider is not supported (e.g. Enterprise SKU)
            let msaDisallowed = (CloudExperienceHost.getAllowedIdentityProviders().indexOf(CloudExperienceHost.SignInIdentityProviders.MSA) == -1);
            return WinJS.Promise.wrap(msaDisallowed);
        }
    }
    CloudExperienceHost.OobeExperimentationPages = OobeExperimentationPages;
    class PersonalizedWelcome {
        static getShouldSkipAsync() {
            return CloudExperienceHost.Policy.getAutoPilotPolicyDwordAsync("PersonalShowPersonalizedWelcome").then(showPolicy => {
                const skipPersonalizedWelcome = (showPolicy !== 1);
                if (skipPersonalizedWelcome) {
                    CloudExperienceHost.Telemetry.logEvent("PersonalizedWelcome_Skip");
                }
                return skipPersonalizedWelcome;
            });
        }
    }
    CloudExperienceHost.PersonalizedWelcome = PersonalizedWelcome;
    class Wireless {
        static getShouldSkipAsync() {
            let skipNetworkConnectPage = CloudExperienceHostAPI.UtilStaticsCore.hideWireless;
            if (!skipNetworkConnectPage) {
                let connectionProfile = Windows.Networking.Connectivity.NetworkInformation.getInternetConnectionProfile();
                if (connectionProfile) {
                    skipNetworkConnectPage = (connectionProfile.getNetworkConnectivityLevel() === Windows.Networking.Connectivity.NetworkConnectivityLevel.internetAccess) &&
                        !connectionProfile.isWwanConnectionProfile;
                }
            }
            return WinJS.Promise.wrap(skipNetworkConnectPage);
        }
    }
    CloudExperienceHost.Wireless = Wireless;
    class WirelessCommercial {
        static getShouldSkipAsync() {
            let oobeResumeEnabled = CloudExperienceHost.Storage.SharableData.getValue("OOBEResumeEnabled");
            // if device did not reboot and resume, then skip the page
            if (!oobeResumeEnabled) {
                return WinJS.Promise.wrap(true);
            }
            let skipNetworkConnectPage = CloudExperienceHostAPI.UtilStaticsCore.hideWirelessCommercial;
            CloudExperienceHost.Telemetry.logEvent("WirelessCommercial_HideWirelessCommercial", skipNetworkConnectPage);
            if (!skipNetworkConnectPage) {
                skipNetworkConnectPage = Environment.hasInternetAccess();
                CloudExperienceHost.Telemetry.logEvent("WirelessCommercial_SkipNetworkConnectPage", skipNetworkConnectPage);
            }
            return WinJS.Promise.wrap(skipNetworkConnectPage);
        }
    }
    CloudExperienceHost.WirelessCommercial = WirelessCommercial;
    class Bookends {
        static getShouldSkipAsync() {
            let localAccountManager = new CloudExperienceHostBroker.Account.LocalAccountManager();
            let isSpeechAllowedByPolicy = true;
            try {
                let speechController = AppObjectFactory.getInstance().getObjectFromString("CloudExperienceHostAPI.Speech.SpeechRecognitionController");
                isSpeechAllowedByPolicy = speechController.isSpeechAllowedByPolicy();
            }
            catch (exception) {
                CloudExperienceHost.Telemetry.logEvent("IsSpeechAllowedByPolicyError", CloudExperienceHost.GetJsonFromError(exception));
            }
            let skipIntro = localAccountManager.unattendCreatedUser ||
                !CloudExperienceHost.Cortana.isCortanaSupported() ||
                !isSpeechAllowedByPolicy ||
                CloudExperienceHost.Storage.SharableData.getValue("retailDemoEnabled");
            if (!skipIntro) {
                // Check for Microphone access. Assumption is if there is a Microphone then there are speakers.
                try {
                    let captureSettings = new Windows.Media.Capture.MediaCaptureInitializationSettings();
                    captureSettings.streamingCaptureMode = Windows.Media.Capture.StreamingCaptureMode.audio;
                    captureSettings.mediaCategory = Windows.Media.Capture.MediaCategory.speech;
                    let capture = new Windows.Media.Capture.MediaCapture();
                    let capturePromise = capture.initializeAsync(captureSettings).then(() => {
                        // Successfully accessed the microphone, don't skip
                        return WinJS.Promise.wrap(false);
                    }, (error) => {
                        // Failed to access microphone, skip bookends
                        return WinJS.Promise.wrap(true);
                    });
                    return capturePromise;
                }
                catch (exception) {
                    // Return true to skip page if media capture initialization fails
                    return WinJS.Promise.wrap(true);
                }
            }
            return WinJS.Promise.wrap(skipIntro);
        }
    }
    CloudExperienceHost.Bookends = Bookends;
    class AccountDisambiguation {
        static getShouldSkipAsync() {
            let allowedProviders = CloudExperienceHost.getAllowedIdentityProviders();
            let onlineProviderAllowed = ((allowedProviders.indexOf(CloudExperienceHost.SignInIdentityProviders.MSA) != -1) || (allowedProviders.indexOf(CloudExperienceHost.SignInIdentityProviders.AAD) != -1));
            // Skip (return success) if no online providers are allowed
            return WinJS.Promise.wrap(!onlineProviderAllowed);
        }
    }
    CloudExperienceHost.AccountDisambiguation = AccountDisambiguation;
    class AccountAndServices {
        // Unattend settings related to account creation and autologon are checked, and can cause us to skip most of
        // the Account and Services sections in CXH hosted OOBE.
        static shouldSkipAccountAndServices() {
            let localAccountManager = new CloudExperienceHostBroker.Account.LocalAccountManager();
            return localAccountManager.unattendCreatedUser;
        }
        // Wraps the check above. Needed for the preload checks specified in the navigation JSON.
        static getShouldSkipAsync() {
            return WinJS.Promise.wrap(CloudExperienceHost.AccountAndServices.shouldSkipAccountAndServices());
        }
        static getUserProfileEngagementAsync(items) {
            let promises = items.map((item) => {
                let itemStatus = "Ineligible";
                let timeout = false;
                let userProfileEngagementPromise = CloudExperienceHostAPI.UserProfileEngagementCore.checkEngagementAsync(item).then((result) => {
                    itemStatus = result;
                });
                let timeoutPromise = WinJS.Promise.timeout(10000).then(() => { timeout = true; });
                return WinJS.Promise.any([userProfileEngagementPromise, timeoutPromise]).then(() => {
                    if (timeout) {
                        CloudExperienceHost.Telemetry.logEvent("UserProfileEngagementItemTimeout", JSON.stringify({ item: item }));
                    }
                    else {
                        CloudExperienceHost.Telemetry.logEvent("UserProfileEngagementItem", JSON.stringify({ item: item, result: itemStatus }));
                    }
                    return itemStatus;
                });
            });
            return WinJS.Promise.join(promises);
        }
        static isDomainAccount() {
            // Although we are calling into a ContentDeliveryManager specific WinRT object, note
            // that this is just a standard domain account check via LsaLookupUserAccountType().
            return CloudExperienceHostAPI.ContentDeliveryManagerHelpers.isDomainAccount;
        }
    }
    CloudExperienceHost.AccountAndServices = AccountAndServices;
    class BrowserSettings {
        static pinAndSetDefaultMicrosoftBrowserAsync() {
            return CloudExperienceHostAPI.BrowserEngagementCore.pinAndSetDefaultMicrosoftBrowserAsync();
        }
        static resetBrowserSearchEngineAsync(partnerCode) {
            return CloudExperienceHostAPI.BrowserEngagementCore.resetBrowserSearchEngineAsync(partnerCode);
        }
    }
    CloudExperienceHost.BrowserSettings = BrowserSettings;
    class FeatureStaging {
        static isOobeFeatureEnabled(featureName) {
            let featureEnabledObj = CloudExperienceHostAPI.FeatureStaging.tryGetIsFeatureEnabled(featureName);
            return featureEnabledObj.result ? featureEnabledObj.value : false;
        }
        static tryGetIsFeatureEnabled(featureName) {
            return CloudExperienceHostAPI.FeatureStaging.tryGetIsFeatureEnabled(featureName);
        }
        static tryGetFeatureVariant(featureName) {
            return CloudExperienceHostAPI.FeatureStaging.tryGetFeatureVariant(featureName);
        }
        static tryGetFeatureVariantData(featureName) {
            return CloudExperienceHostAPI.FeatureStaging.tryGetFeatureVariantData(featureName);
        }
    }
    CloudExperienceHost.FeatureStaging = FeatureStaging;
    class ScheduledTasks {
        static registerTimeTriggeredTaskForUserScenarioAsync(scenarioId, triggerTimeDeltaInMinutes) {
            return CloudExperienceHostAPI.ScheduledTasksRegistrationManagerCore.registerTimeTriggeredTaskForUserScenarioAsync(scenarioId, triggerTimeDeltaInMinutes);
        }
        static deleteRegisteredTaskIfPresentAsync(scenarioId) {
            return CloudExperienceHostAPI.ScheduledTasksRegistrationManagerCore.deleteRegisteredTaskIfPresentAsync(scenarioId);
        }
    }
    CloudExperienceHost.ScheduledTasks = ScheduledTasks;
    class CloudStore {
        static GetSyncSetting(policyName) {
            let policyValue = "unknown";
            try {
                if (WindowsUdk.Storage.CloudStore !== undefined) {
                    policyValue = WindowsUdk.Storage.CloudStore.getDefault().getSyncSetting(policyName).toString();
                }
            }
            catch (error) {
                CloudExperienceHost.Telemetry.logEvent("GetSyncSettingError", CloudExperienceHost.GetJsonFromError(error));
            }
            return policyValue;
        }
        static SetSyncSetting(policyName, policyValue) {
            try {
                if (WindowsUdk.Storage.CloudStore !== undefined) {
                    WindowsUdk.Storage.CloudStore.getDefault().setSyncSetting(policyName, policyValue);
                }
            }
            catch (error) {
                CloudExperienceHost.Telemetry.logEvent("SetSyncSettingError", CloudExperienceHost.GetJsonFromError(error));
            }
        }
    }
    CloudExperienceHost.CloudStore = CloudStore;
    class Launcher {
        static launchUriAsync(uri) {
            if (CloudExperienceHost.FeatureStaging.isOobeFeatureEnabled("LaunchUriAsyncInCloudExperienceHost")) {
                try {
                    let uriFoundation = new Windows.Foundation.Uri(uri);
                    Windows.System.Launcher.launchUriAsync(uriFoundation);
                }
                catch (exception) {
                    CloudExperienceHost.Telemetry.logEvent("launchUriAsync", CloudExperienceHost.GetJsonFromError(exception));
                }
            }
        }
    }
    CloudExperienceHost.Launcher = Launcher;
    class DeviceIntegrationPolicy {
        static tryGetGeographicRegionPolicy(policy) {
            if (CloudExperienceHost.FeatureStaging.isOobeFeatureEnabled("DeviceIntegrationPolicy")) {
                try {
                    if (WindowsUdk.System.Profile.IntegratedServicesGeographicRegionPolicies !== undefined) {
                        let geographicRegionPolicy = WindowsUdk.System.Profile.IntegratedServicesGeographicRegionPolicies[policy];
                        if (geographicRegionPolicy !== undefined) {
                            return JSON.stringify(geographicRegionPolicy);
                        }
                    }
                    else {
                        CloudExperienceHost.Telemetry.logEvent("ApiNonexistentOnClient", "DeviceIntegrationPolicy");
                        throw "ApiNonexistentOnClient"; // Throw a string error instead of an Error object to avoid truncation in the callback layer
                    }
                }
                catch (exception) {
                    CloudExperienceHost.Telemetry.logEvent("tryGetGeographicRegionPolicyError", CloudExperienceHost.GetJsonFromError(exception));
                }
            }
            return JSON.stringify({});
        }
    }
    CloudExperienceHost.DeviceIntegrationPolicy = DeviceIntegrationPolicy;
    class WindowsAccountSyncConsent {
        static throwIfFeatureIsDisabled() {
            if (!CloudExperienceHost.FeatureStaging.isOobeFeatureEnabled("WindowsAccountSyncConsent")) {
                throw "ApiNonexistentOnClient";
            }
        }
        static throwIfApiNotAvailable() {
            // Align to behavior for bridge.invoke() of throwing "ApiNonexistentOnClient" when the underlying UDK runtime class is not available in this image.
            // This accounts for the case where CXH ships the wrapper as part of an OOBE ZDP payload without the UDK updates.
            // We treat this scenario as "UDK Windows Account Sync Consent APIs are not present" and let the caller(s) know that we cannot enforce the corresponding
            // consent policies in this image as opposed to defaulting to "no consent" in the case where the APIs are present and an error occurs during the API call.
            if (!(WindowsUdk && WindowsUdk.Services && WindowsUdk.Services.UnifiedConsent && WindowsUdk.Services.UnifiedConsent.WindowsAccountSyncConsentCoordinator)) {
                throw "ApiNonexistentOnClient";
            }
            if (!CloudExperienceHostAPI.WindowsAccountSyncConsentCoordinator) {
                throw "ApiNonexistentOnClient";
            }
        }
        static getConsentStateAsync(categoryName) {
            WindowsAccountSyncConsent.throwIfFeatureIsDisabled();
            WindowsAccountSyncConsent.throwIfApiNotAvailable();
            return new WinJS.Promise(function (completeDispatch, errorDispatch) {
                try {
                    CloudExperienceHostAPI.WindowsAccountSyncConsentCoordinator.getConsentStateFromUserProfileAsync(categoryName).then((consentStateJson) => {
                        completeDispatch(consentStateJson);
                    }, (ex) => {
                        CloudExperienceHost.Telemetry.logEvent("getConsentStateFromUserProfileAsyncError", CloudExperienceHost.GetJsonFromError(ex));
                        errorDispatch(ex);
                    });
                }
                catch (ex) {
                    CloudExperienceHost.Telemetry.logEvent("getConsentStateAsyncError", CloudExperienceHost.GetJsonFromError(ex));
                    errorDispatch(ex);
                }
            });
        }
        static setConsentStateAsync(consentResponseJson) {
            WindowsAccountSyncConsent.throwIfFeatureIsDisabled();
            WindowsAccountSyncConsent.throwIfApiNotAvailable();
            return new WinJS.Promise(function (completeDispatch, errorDispatch) {
                try {
                    CloudExperienceHostAPI.WindowsAccountSyncConsentCoordinator.setConsentStateToUserProfileAsync(consentResponseJson).then(() => {
                        completeDispatch();
                    }, (ex) => {
                        CloudExperienceHost.Telemetry.logEvent("setConsentStateToUserProfileAsyncError", CloudExperienceHost.GetJsonFromError(ex));
                        errorDispatch(ex);
                    });
                }
                catch (ex) {
                    CloudExperienceHost.Telemetry.logEvent("setConsentStateAsyncError", CloudExperienceHost.GetJsonFromError(ex));
                    errorDispatch(ex);
                }
            });
        }
    }
    CloudExperienceHost.WindowsAccountSyncConsent = WindowsAccountSyncConsent;
})(CloudExperienceHost || (CloudExperienceHost = {}));
//# sourceMappingURL=environment.js.map