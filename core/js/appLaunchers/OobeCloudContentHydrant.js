//
// Copyright (C) Microsoft. All rights reserved.
//

define(['legacy/core'], (core) => {
    
    var creativeList = {};

    // Upon successful navigation (defined by the NavigationCompleted event), check to see if the node came from CDM,
    // and if so, fire the corresponding impression beacon pulled from the creative.
    function fireImpressionBeacon(node) {
        if (creativeList[node.cxid] !== undefined) {
            creativeList[node.cxid].reportInteraction(Windows.Services.TargetedContent.TargetedContentInteraction.impression);
        }
    }

    // Upon completion of a web app (defined by the AppResultDetermined event), check to see if the node came from CDM,
    // and if so, fire the corresponding exit impression beacon pulled from the creative.
    function fireNavigationBeacon(navDecision) {
        if (creativeList[navDecision.currentNode.cxid] !== undefined) {
            let interactionType;
            if (navDecision.result == CloudExperienceHost.AppResult.success) {
                interactionType = Windows.Services.TargetedContent.TargetedContentInteraction.accept;
            }
            else if (navDecision.result == CloudExperienceHost.AppResult.abort) {
                interactionType = Windows.Services.TargetedContent.TargetedContentInteraction.defer;
            }
            else if (navDecision.result == CloudExperienceHost.AppResult.cancel) {
                interactionType = Windows.Services.TargetedContent.TargetedContentInteraction.canceled;
            }

            if (interactionType !== undefined) {
                creativeList[navDecision.currentNode.cxid].reportInteraction(interactionType);
            }
        }
    }

    class OobeCloudContentHydrant {
        
        // Ensure that all node fields are correctly filled out
        isValidNode(node) {
            try {
                return !(node.url.uri.absoluteUri == ""
                        || node.successID.string == ""
                        || node.failID.string == ""
                        || node.cancelID.string == ""
                        || node.abortID.string == ""
                        || node.cxid.string == "");
            }
            catch (error) {
                return false;
            }
        }

        duplicateNode(cloudNode) {
            // Only copy validated fields
            let newNode = new Object();
            newNode.cxid = cloudNode.cxid.string;
            newNode.url = cloudNode.url.uri.absoluteUri;
            newNode.successID = cloudNode.successID.string;
            newNode.failID = cloudNode.failID.string;
            newNode.abortID = cloudNode.abortID.string;
            newNode.cancelID = cloudNode.cancelID.string;

            // Any node hydrated from CDM requires the visibility:true event to be fired in order for content to show.
            newNode.visibility = false;
            newNode.disableErrorPageOnFailure = true;
            newNode.ignoreResult = true;

            return newNode;
        }

        hydrateNodesFromCdm() {
            // If the overall dynamic content feature isn't enabled, network is unavailable, 
            // or the MSA identity provider is not supported (ex: Enterprise/EDU skus) skip this work.
            if (!(!AppObjectFactory.getInstance().getObjectFromString("CloudExperienceHost.FeatureStaging").isOobeFeatureEnabled("DisableDynamicContent") &&
                  CloudExperienceHost.Environment.hasInternetAccess() &&
                  (CloudExperienceHost.getAllowedIdentityProviders().indexOf(CloudExperienceHost.SignInIdentityProviders.MSA) != -1))) {
                return WinJS.Promise.as(CloudExperienceHost.AppResult.abort);
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

            var self = this;

            let cdmStartTime = performance.now();

            let cdmPromise = Windows.Services.TargetedContent.TargetedContentSubscription.getAsync(currentSubscriptionId).then(
                function getTargetedContent(subscription) {
                    return subscription.getContentContainerAsync();
                }).then((container) => {
                    let elapsedTime = (performance.now() - cdmStartTime);
                    CloudExperienceHost.Telemetry.AppTelemetry.getInstance().logCriticalEvent2("oobeCloudContentHydrantTargetedContentElapsedTime", elapsedTime);
                    return container;
                }, (err) => {
                    return { error: err };
                });


            // The TargetedContent API doesn't support cancellation by default, so we use our own timer to enforce timeout behavior
            let timeoutPromise = WinJS.Promise.timeout(15000 /*15 second timeout*/).then(() => {
                cdmPromise.cancel();
                return { error: { isTimeout: true } };
            });

            return WinJS.Promise.any({ cdmResult: cdmPromise, timeoutResult: timeoutPromise }).then(function processNodes(wrappedPromise) {
                return wrappedPromise.value.then((result) => {
                    if (result.error) {
                        let errorJson = core.GetJsonFromError(result.error);
                        CloudExperienceHost.Telemetry.logEvent("oobeCloudContentHydrantFailure", errorJson);
                        return CloudExperienceHost.AppResult.fail;
                    }
                    else {
                        if (result.availability !== Windows.Services.TargetedContent.TargetedContentAvailability.none) {
                            let navMesh = CloudExperienceHost.getNavMesh();

                            // Fire an opportunity beacon showing the creative was successfully loaded
                            result.content.reportInteraction(Windows.Services.TargetedContent.TargetedContentInteraction.opportunity);
                            CloudExperienceHost.Telemetry.logEvent("MSAOfferOpportunity");

                            for (let i = 0; i < result.content.items.length; i++) {
                                let cloudNode = result.content.items[i].properties;

                                // For RS2, we only support a defined subset of fields within the node that we can validate properly
                                if (self.isValidNode(cloudNode)) {
                                    let node = self.duplicateNode(cloudNode);
                                    navMesh.addOrUpdateNode(node);

                                    //Add the creative node object to a list to allow beacons to be fired later on
                                    creativeList[node.cxid] = result.content.items[i];
                                }
                            }
                            CloudExperienceHost.getNavManager().addNavigationEventListener("NavigationCompleted", fireImpressionBeacon);
                            CloudExperienceHost.getNavManager().addNavigationEventListener("AppResultDetermined", fireNavigationBeacon);
                        }

                        CloudExperienceHost.Telemetry.logEvent("oobeCloudContentHydrantSucceeded");
                        return CloudExperienceHost.AppResult.success;
                    }
                });
            });
        }

        refreshFeatureConfigurations() {
            // If network is unavailable, or the feature to provide flight data to webapps is not enabled,
            // then skip this work.
            if (!(AppObjectFactory.getInstance().getObjectFromString("CloudExperienceHost.FeatureStaging").isOobeFeatureEnabled("ProvideFlightDataToWebapps") &&
                  CloudExperienceHost.Environment.hasInternetAccess())) {
                return WinJS.Promise.as(CloudExperienceHost.AppResult.abort);
            }

            CloudExperienceHost.Telemetry.logEvent("flightDataRefreshStarted");
            return CloudExperienceHostAPI.UtilStaticsCore.tryRefreshWindowsFlightDataAsync().then((completed) => {
                CloudExperienceHost.Telemetry.logEvent("flightDataRefresh" + (completed ? "Completed" : "Timeout"));
                return CloudExperienceHost.getWindowsFlightDataAsync();
            }).then(() => {
                CloudExperienceHost.Telemetry.logEvent("flightDataRefreshDataRetrieved");
                return CloudExperienceHost.AppResult.success;
            }, (err) => {
                CloudExperienceHost.Telemetry.logEvent("flightDataRefreshFailed", core.GetJsonFromError(err));
                return CloudExperienceHost.AppResult.fail;
            });
        }

        notifyAutopilotProfile() {
            // This will publish a notification from the Autopilot service to let components like Bitlocker know
            // when OOBE has proceeded far enough to make decisions based on expected policy synchronization from AAD or MDM.
            // This must happen before any user credentials are stored on the device if Bitlocker is not deferring encryption
            // due to expected future policies that will override the defaults.
            CloudExperienceHost.Telemetry.logEvent("Autopilot_CloudContentHydrant_notifyAutopilotProfile_start");
            return EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotUtilStatics.setAutopilotDeviceNotManagedAsync(0);
        }

        launchAsync() {
            return WinJS.Promise.join({ cdmResult: this.hydrateNodesFromCdm(), featureConfigResult: this.refreshFeatureConfigurations(), autopilotNotifyResult: this.notifyAutopilotProfile() }).then((results) => {
                return (results.featureConfigResult != CloudExperienceHost.AppResult.abort) ? results.featureConfigResult : results.cdmResult;
            });
        }

    }

    return OobeCloudContentHydrant;
});