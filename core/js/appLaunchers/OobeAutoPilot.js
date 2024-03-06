//
// Copyright (C) Microsoft. All rights reserved.
//

define(['legacy/core'], (core) => {
    class OOBEAutoPilot {
        launchAsync(currentNode) {
            return new WinJS.Promise(async function (completeDispatch) {
                try {
                    const OS_DEFAULT = "os-default";
                    let autoPilot = new EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotServer();
                    switch (currentNode.policyName) {
                        // Set language
                        case "CloudAssignedLanguage":
                            try {
                                let policyValue = await autoPilot.getStringPolicyAsync(currentNode.policyName);

                                if (policyValue) {
                                    let languageManager = AppObjectFactory.getInstance().getObjectFromString("CloudExperienceHostAPI.OobeDisplayLanguageManagerCore");
                                    let languages = CloudExperienceHostAPI.OobeDisplayLanguagesCore.getDisplayLanguages();
                                    let policyLanguage = languages.find((language) => language.tag.localeCompare(policyValue, undefined, { sensitivity: 'base' }) === 0); // String-insensitive compare, allows accent marks to be treated the same if the same base

                                    // If no match on installed languages or policy value is "os-default", set to the first (defaulted) language in the list
                                    if ((!policyLanguage) ||
                                        (policyValue === OS_DEFAULT)) {
                                        policyLanguage = languages[0];
                                    }
                                    languageManager.commitDisplayLanguageAsync(policyLanguage).action.done(() => {
                                        CloudExperienceHost.Telemetry.logEvent("Language set by AutoPilot policy");

                                        completeDispatch(CloudExperienceHost.AppResult.success);
                                    });
                                } else {
                                    completeDispatch(CloudExperienceHost.AppResult.success);
                                }
                            } catch (e) {
                                CloudExperienceHost.Telemetry.logEvent(`"Error getting Autopilot string policy '${currentNode.policyName}'"`);
                                completeDispatch(CloudExperienceHost.AppResult.fail);
                            }
                            break;

                        // Set region
                        case "CloudAssignedRegion":
                            try {
                                let policyValue = await autoPilot.getStringPolicyAsync(currentNode.policyName);

                                if (policyValue) {
                                    let regionCode = policyValue;

                                    if (policyValue === OS_DEFAULT) {
                                        regionCode = CloudExperienceHost.Globalization.GeographicRegion.getCode().toLowerCase();
                                    }

                                    let regionManager = AppObjectFactory.getInstance().getObjectFromString("CloudExperienceHostAPI.OobeRegionManagerStaticsCore");
                                    let commitRegion = regionManager.commitRegionAsync(regionCode);
                                    commitRegion.action.done(() => {
                                        CloudExperienceHost.Telemetry.logEvent("Region set by AutoPilot policy");
                                        if (commitRegion.effects.rebootRequired) {
                                            CloudExperienceHost.Telemetry.logEvent("CommitRegionRebootRequired");
                                        }

                                        // Additionally, set the keyboard since language and region have already been established.
                                        // This avoids the necessity of creating another appLauncher node after OobeKeyboard
                                        // when we've already determined the keyboard(s) at this point.
                                        let keyboardManager = AppObjectFactory.getInstance().getObjectFromString("CloudExperienceHostAPI.OobeKeyboardManagerStaticsCore");
                                        let keyboards = CloudExperienceHostAPI.OobeKeyboardStaticsCore.getKeyboardsForDefaultInputLanguage();
                                        let defaultKeyboard = [keyboards[0]]; // Set to the first default keyboard in the list
                                        keyboardManager.commitKeyboardsAsync(defaultKeyboard).done(() => {
                                            CloudExperienceHost.Telemetry.logEvent("Keyboard set by AutoPilot policy");

                                            // Notify the chrome footer to update the input switch button
                                            CloudExperienceHost.setShowInputSwitchButton();

                                            completeDispatch(CloudExperienceHost.AppResult.success);
                                        });
                                    });
                                } else {
                                    completeDispatch(CloudExperienceHost.AppResult.success);
                                }
                            } catch (e) {
                                CloudExperienceHost.Telemetry.logEvent(`"Error getting Autopilot string policy '${currentNode.policyName}'"`);
                                completeDispatch(CloudExperienceHost.AppResult.fail);
                            }
                            break;

                        case "offlineCheck":
                            autoPilot.getStringPolicyAsync("CloudAssignedTenantId").then(function (policyValue) {
                                if ((policyValue === null) || (policyValue === "")) {
                                    // No valid autopilot profile since there is no valid Tenant ID in Autopilot profile.
                                    // success as "no autopilot profile"
                                    completeDispatch(CloudExperienceHost.AppResult.success);
                                } else {
                                    // Take action1, since there is a valid autopilot profile.
                                    completeDispatch(CloudExperienceHost.AppResult.action1);
                                }
                            }, function (err) {
                                completeDispatch(CloudExperienceHost.AppResult.abort);
                            });
                            break;

                        case "postReset":
                            let pluginManager = new CloudExperienceHostAPI.Provisioning.PluginManager();
                            let isAutopilotReset = pluginManager.isPostPowerwash();

                            // This tells the AAD sign in service to enable navigation to the Enterprise Provisioning page
                            CloudExperienceHost.Storage.SharableData.addValue("AADProvisioningPage", "OobeEnterpriseProvisioning");

                            if (isAutopilotReset === true) {
                                CloudExperienceHost.Telemetry.logEvent("Device is in a post Autopilot reset flow.");

                                let isHybridDomainJoinEnabled = (await EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotUtilStatics.getDwordPolicyAsync("CloudAssignedDomainJoinMethod") === 1);

                                if (isHybridDomainJoinEnabled) {
                                    // Skip Hybrid DJ
                                    CloudExperienceHost.Telemetry.logEvent("Skipping domain join flow due to Autopilot reset.");
                                    completeDispatch(CloudExperienceHost.AppResult.action2);
                                } else {
                                    // Skip AAD registration
                                    CloudExperienceHost.Telemetry.logEvent("Skipping AAD registration flow due to Autopilot reset.");
                                    completeDispatch(CloudExperienceHost.AppResult.action1);
                                }
                            }
                            else {
                                let profileState = await EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotUtilStatics.getProfileStateAsync();

                                // If the device is Autopilot-registered, skip to the AAD sign-in page. Otherwise, navigate to the normal OOBE flow
                                if (EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotProfileState.available === profileState) {
                                    CloudExperienceHost.Telemetry.logEvent("Autopilot profile is available.");

                                    let enrollmentStaticApis = new EnterpriseDeviceManagement.Enrollment.ReflectedEnrollmentStatics();

                                    if (enrollmentStaticApis.ShouldSkip() === 1) {
                                        CloudExperienceHost.Telemetry.logEvent("No Hybrid AADJ specified in the Autopilot profile. Move to AADJ sign-in.");

                                        completeDispatch(CloudExperienceHost.AppResult.action3);
                                    } else {
                                        CloudExperienceHost.Telemetry.logEvent("Hybrid AADJ is specified in the Autopilot profile. Move to Hybrid AADJ sign-in.");

                                        completeDispatch(CloudExperienceHost.AppResult.success);
                                    }
                                } else {
                                    CloudExperienceHost.Telemetry.logEvent("No Autopilot profile available.");
                                    completeDispatch(CloudExperienceHost.AppResult.success);
                                }
                            }

                            break;

                        case "networkWait":
                            if (CloudExperienceHostAPI.FeatureStaging.isOobeFeatureEnabled("AutopilotSurfaceHub22H2")) {
                                CloudExperienceHost.Telemetry.logEvent("Autopilot network wait started");
                                let startTimeNetwork = performance.now();

                                const TimeoutMaxWaitSeconds = 30;
                                var internetConnected = CloudExperienceHost.Environment.hasInternetAccess();
                                var i = 0;
                                while ((i < TimeoutMaxWaitSeconds) && !internetConnected) {
                                    await new Promise(r => setTimeout(r, 1000));
                                    internetConnected = CloudExperienceHost.Environment.hasInternetAccess();
                                    i += 1;
                                }

                                if (internetConnected) {
                                    CloudExperienceHost.Telemetry.logEvent("Autopilot found Internet");
                                }
                                else {
                                    CloudExperienceHost.Telemetry.logEvent("Autopilot did not find Internet");
                                }
                                let details = { timeElapsedMs: performance.now() - startTimeNetwork };
                                CloudExperienceHost.Telemetry.logEvent("Autopilot network wait completed", JSON.stringify(details));
                                completeDispatch(CloudExperienceHost.AppResult.success);
                                break;
                            }
                            else {
                                // Default case
                                completeDispatch(CloudExperienceHost.AppResult.success);
                            }

                        case "prefetch":
                            CloudExperienceHost.Telemetry.logEvent("AutoPilot prefetch ZTP policy cache started");
                            let startTime = performance.now();
                            let cxidOrResult = CloudExperienceHost.AppResult.success;
                            let clearAndPopulateZTPCachePromise = EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotUtilStatics.clearDdsCacheAsync().then(() => {
                                CloudExperienceHost.Telemetry.logEvent("AutoPilot policy cache cleared");
                            }).then(() => {
                                return EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotUtilStatics.retrieveSettingsAsync();
                            }).then(() => {
                                let details = { timeElapsed: performance.now() - startTime };
                                CloudExperienceHost.Telemetry.logEvent("AutoPilot prefetch ZTP policy cache returned", JSON.stringify(details));
                            }, (error) => {
                                CloudExperienceHost.Telemetry.logEvent("AutoPilot prefetch ZTP policy cache failed");
                            }).then(() => {
                                return EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotUtilStatics.getCXIDPostRebootAsync();
                            }).then((cxidToJumpTo) => {
                                const UpdateRebootCXIDKey = "UpdateRebootCXID";
                                if ((cxidToJumpTo !== null) && (cxidToJumpTo !== "")) {
                                    let lastResetWasFromAutopilotUpdate = CloudExperienceHost.Storage.SharableData.getValue("resetFromAutopilotUpdate");
                                    if (lastResetWasFromAutopilotUpdate) {
                                        cxidOrResult = cxidToJumpTo;
                                        CloudExperienceHost.Storage.SharableData.addValue("resetFromAutopilotUpdate", false);
                                        // Reset the UpdateRebootCXID node after it is used.
                                        return autoPilot.storeSettingAsync(UpdateRebootCXIDKey, "");
                                    }
                                }
                            });

                            // The ZTP call doesn't actually support cancellation and is basically fire-and-forget,
                            // but we wait up to 36 seconds for it to finish before moving on to give it adequate time to complete.
                            let timedOut = false;
                            let timeoutPromise = WinJS.Promise.timeout(36000 /*36 second timeout*/).then(() => { timedOut = true; });
                            WinJS.Promise.any([clearAndPopulateZTPCachePromise, timeoutPromise]).then((result) => {
                                if (timedOut) {
                                    CloudExperienceHost.Telemetry.logEvent("AutoPilot prefetch ZTP policy cache timed out");
                                } else {
                                    CloudExperienceHost.Telemetry.logEvent("AutoPilot prefetch ZTP policy cache done");
                                }

                                completeDispatch(cxidOrResult);
                            }, function (err) {
                                completeDispatch(CloudExperienceHost.AppResult.fail);
                            });
                            break;

                        default:
                            completeDispatch(CloudExperienceHost.AppResult.success);
                            break;
                    }
                } catch (err) {
                    CloudExperienceHost.Telemetry.logEvent(`Failed to run app launcher Autopilot policy '${currentNode.policyName}' for node '${currentNode.cxid}'`);
                    completeDispatch(CloudExperienceHost.AppResult.fail);
                }
            });
        }
    }
    return OOBEAutoPilot;
});
