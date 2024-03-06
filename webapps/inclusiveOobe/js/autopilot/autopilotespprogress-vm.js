//
// Copyright (C) Microsoft. All rights reserved.
//

"use strict";

define([
    'lib/knockout',
    'legacy/bridge',
    'autopilot/commercialDiagnosticsUtilities'], (
    ko,
    bridge,
    commercialDiagnosticsUtilities) => {
    class autopilotEspProgressViewModel {
        constructor(
            resourceStrings,
            sessionUtilities,
            categoryUiContainers,
            categoryUiContainerInitializationPromises) {

            // Constants
            // Button visibility bitmasks
            this.BUTTON_FLAG_NONE = 0;
            this.BUTTON_FLAG_CONTINUE_ANYWAY = 1;
            this.BUTTON_FLAG_RESET_DEVICE = 2;
            this.BUTTON_FLAG_TRY_AGAIN = 4;
            this.BUTTON_FLAG_SIGN_OUT = 8;

            // Hyperlink Visibility bitmasks
            this.HYPERLINK_FLAG_NONE = 0;
            this.HYPERLINK_FLAG_CONTINUE_ANYWAY = 1;
            this.HYPERLINK_FLAG_COLLECT_LOGS = 2;
            this.HYPERLINK_FLAG_SIGN_OUT = 4;

            this.ACTION_INITIATION_DELAY_IN_MILLISECONDS = 5000;

            this.PAGE_TRANSITION_POST_ESP_SUCCESS_PAGE = CloudExperienceHost.AppResult.success;
            this.PAGE_TRANSITION_WHITE_GLOVE_RESULTS_PAGE = CloudExperienceHost.AppResult.action2;

            this.RETURNED_FROM_DIAGNOSTICS_PAGE_FLAG_NAME = "ReturnedFromDiagnosticsPageFlag";
            this.RETURNED_FROM_DIAGNOSTICS_PAGE_FLAG_VALUE = "true";

            this.FEATURE_AUTOPILOTSURFACEHUB22H2 = "AutopilotSurfaceHub22H2";

            // Private member variables
            this.categoryUiContainers = categoryUiContainers;
            this.currentCategoryIndex = 0;
            this.resourceStrings = resourceStrings;
            this.sessionUtilities = sessionUtilities;
            this.showCollectLogsButton = false;
            this.provisioningCompleted = false;
            this.errorButtonsVisibility = 0;
            this.isWhiteGloveFlow = false;
            this.showSignOutButton = false;
            this.firstPostOobeCategoryIndex = -1;

            if (CloudExperienceHostAPI.FeatureStaging.isOobeFeatureEnabled(this.FEATURE_AUTOPILOTSURFACEHUB22H2)) {
                this.commercialDiagnosticsUtilities = new commercialDiagnosticsUtilities();
            }
            
            // Default global timeout is 60 minutes. Subcategories dictate their own timeouts. This timeout
            // is a second line of defense to prevent infinite hanging if anything goes wrong.
            this.syncFailTimeoutInMilliseconds = 60 * 60 * 1000;

            for (let i = 0; i < this.categoryUiContainers.length; i++) {
                if (!this.categoryUiContainers[i].runsInOobe()) {
                    this.firstPostOobeCategoryIndex = i;
                    break;
                }
            }

            // Initialize data-bound web controls' values.
            this.EnrollmentProgressNotifyOfNotificationText = ko.observable("");
            this.pageTitle = this.resourceStrings["BootstrapPageTitle"];
            this.pageLeadText = this.resourceStrings["BootstrapPageRebootWarning"];

            this.buttonVisibility = ko.observable(0);
            this.hyperlinkVisibility = ko.observable(0);
            this.isResetButtonDisabled = ko.observable(false);
            this.isSignOutButtonDisabled = ko.observable(false);
            this.errorMessage = ko.observable(this.resourceStrings[""]);
            this.infoMessage = ko.observable(this.resourceStrings[""]);

            // Initialize button sets
            this.continueAnywayButton = {
                buttonText: this.resourceStrings["BootstrapPageContinueAnywayButton"],
                buttonType: "button",
                isPrimaryButton: true,
                autoFocus: true,
                isVisible: true,
                buttonClickHandler: () => {
                    this.continueAnywayButtonClick();
                }
            };

            this.resetDeviceButton = {
                buttonText: this.resourceStrings["BootstrapPageResetDeviceButton"],
                buttonType: "button",
                isPrimaryButton: false,
                autoFocus: false,
                isVisible: true,
                disableControl: ko.pureComputed(() => {
                    return this.isResetButtonDisabled();
                }),
                buttonClickHandler: () => {
                    this.resetDeviceButtonClick();
                }
            };

            this.tryAgainButton = {
                buttonText: this.resourceStrings["BootstrapPageTryAgainButton"],
                buttonType: "button",
                isPrimaryButton: true,
                autoFocus: true,
                isVisible: true,
                buttonClickHandler: () => {
                    this.tryAgainButtonClick();
                }
            };

            this.signOutButton = {
                buttonText: this.resourceStrings["BootstrapPageSignOutButton"],
                buttonType: "button",
                isPrimaryButton: true,
                autoFocus: true,
                isVisible: true,
                disableControl: ko.pureComputed(() => {
                    return this.isSignOutButtonDisabled();
                }),
                buttonClickHandler: () => {
                    this.signOutButtonClick();
                }
            };

            const flexEndButtonSets = {};
            flexEndButtonSets[this.BUTTON_FLAG_NONE] = [];
            flexEndButtonSets[this.BUTTON_FLAG_CONTINUE_ANYWAY] = [this.continueAnywayButton];
            flexEndButtonSets[this.BUTTON_FLAG_RESET_DEVICE] = [this.resetDeviceButton];
            flexEndButtonSets[this.BUTTON_FLAG_TRY_AGAIN] = [this.tryAgainButton];
            flexEndButtonSets[this.BUTTON_FLAG_SIGN_OUT] = [this.signOutButton];
            flexEndButtonSets[this.BUTTON_FLAG_RESET_DEVICE | this.BUTTON_FLAG_TRY_AGAIN] = [this.resetDeviceButton, this.tryAgainButton];

            this.flexEndButtons = ko.pureComputed(() => {
                return flexEndButtonSets[this.buttonVisibility()];
            });
            
            // Update the page to which we resume after reboot to ESP
            this.sessionUtilities.logInfoEvent("CommercialOOBE_ESP_RebootResumption_Set");
            bridge.invoke("CloudExperienceHost.AutoPilot.EnrollmentStatusPage.setStatusPageReboot");

            // Initalize hyperlink sets
            this.continueAnywayLink = {
                hyperlinkText: this.resourceStrings["BootstrapPageContinueAnywayButton"],
                handler: () => {
                    this.continueAnywayButtonClick();
                }
            };

            this.collectLogsLink = {
                hyperlinkText: this.resourceStrings["BootstrapPageCollectLogsButton"],
                handler: () => {
                    this.collectLogsButtonClick();
                }
            };

            this.signOutLink = {
                hyperlinkText: this.resourceStrings["BootstrapPageSignOutButton"],
                handler: () => {
                    this.signOutButtonClick();
                }
            };

            const flexStartHyperlinksSets = {};
            flexStartHyperlinksSets[this.HYPERLINK_FLAG_NONE] = [];
            flexStartHyperlinksSets[this.HYPERLINK_FLAG_CONTINUE_ANYWAY] = [this.continueAnywayLink];
            flexStartHyperlinksSets[this.HYPERLINK_FLAG_COLLECT_LOGS] = [this.collectLogsLink];
            flexStartHyperlinksSets[this.HYPERLINK_FLAG_SIGN_OUT] = [this.signOutLink];
            flexStartHyperlinksSets[this.HYPERLINK_FLAG_CONTINUE_ANYWAY | this.HYPERLINK_FLAG_COLLECT_LOGS] = [this.continueAnywayLink, this.collectLogsLink];
            flexStartHyperlinksSets[this.HYPERLINK_FLAG_SIGN_OUT | this.HYPERLINK_FLAG_COLLECT_LOGS] = [this.signOutLink, this.collectLogsLink];

            this.flexStartHyperLinks = ko.pureComputed(() => {
                return flexStartHyperlinksSets[this.hyperlinkVisibility()];
            });

            this.sessionUtilities.storeTransientState(this.sessionUtilities.stateNameGlobalErrorButtonsVisibility, 0);
            this.sessionUtilities.storeTransientState(this.sessionUtilities.stateNameGlobalShowCollectLogsButton, true);

            let currentMdmProgressMode = this.sessionUtilities.MDM_PROGRESS_MODE_DEVICE_AND_USER;
            if (this.sessionUtilities.runningInOobe()) {
                currentMdmProgressMode = this.sessionUtilities.MDM_PROGRESS_MODE_DEVICE;
            }

            this.sessionUtilities.storeTransientState(
                this.sessionUtilities.STATE_NAME_GLOBAL_MDM_PROGRESS_MODE, 
                currentMdmProgressMode);

            bridge.fireEvent(CloudExperienceHost.Events.visible, true);

            // Collection of click handlers from categories that only have been processed.
            this.clickHandlers = [];

            // Start main processing only after all the UI containers are initialized.
            WinJS.Promise.join(categoryUiContainerInitializationPromises).then(() => {
                return this.waitForDebuggerAttachment();
            }).then(() => {
                return bridge.invoke("CloudExperienceHost.Storage.SharableData.getValue", this.RETURNED_FROM_DIAGNOSTICS_PAGE_FLAG_NAME);
            }).then((flag) => {
                // Log the fact that the device rebooted during the ESP, but only if the ESP is NOT transitioning from the diagnostics page.
                // The only case this logging won't catch is if there is an unexpected reboot during the diagnostics page, but that
                // should be rare.
                if (this.RETURNED_FROM_DIAGNOSTICS_PAGE_FLAG_VALUE !== flag) {
                    this.sessionUtilities.logInfoEvent("BootstrapStatus: The page is resuming after a reboot.");
                }

                // Clear the return-from-diagnostics-page hint flag.
                return bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", this.RETURNED_FROM_DIAGNOSTICS_PAGE_FLAG_NAME);
            }).then(() => {
                return this.checkBlockingValueAsync();
            }).then(() => {
                return this.checkShowLogsSettingAsync();
            }).then(() => {
                return this.checkForWhiteGloveModeAsync();
            }).then(() => {
                return this.shouldShowSignOutButtonAsync();
            }).then(() => {
                return this.getsyncFailTimeoutInMillisecondsAsync();
            }).then(() => {
                return this.runAllCategories(false);
            }).done(
                () => { },
                (e) => {
                    this.sessionUtilities.logErrorEvent("BootstrapStatus: Failed progress page view model initialization", e);
                });
        }

        waitForDebuggerAttachment() {
            return this.sessionUtilities.getSettingAsync(this.sessionUtilities.STATE_NAME_GLOBAL_SHOULD_WAIT_FOR_DEBUGGER_ATTACH).then((debuggerFlagValue) => {
                if ((null === debuggerFlagValue) || (debuggerFlagValue.length === 0)) {
                    this.sessionUtilities.logInfoEvent(`BootstrapStatus: Done waiting for debugger to attach (value == ${debuggerFlagValue}).`);

                    return WinJS.Promise.as(true);
                }

                this.sessionUtilities.logInfoEvent("BootstrapStatus: Waiting 5 seconds for debugger to attach.");

                // Loop every 5 seconds waiting for debugger attachment.
                return WinJS.Promise.timeout(5000).then(() => {
                    return this.waitForDebuggerAttachment();
                });
            });
        }

        runOneClickHandlerAsync(clickedItemId, clickHandlerIndex) {
            if (clickHandlerIndex >= this.clickHandlers.length) {
                this.sessionUtilities.logInfoEvent(`BootstrapStatus: Reached end of click handler invocations for ${this.clickHandlers.length} handler(s).`);

                // True indicates success.
                return WinJS.Promise.as(true);
            }

            return this.clickHandlers[clickHandlerIndex]({
                clickedItemId: clickedItemId
            }).then((handlerSucceeded) => {
                this.sessionUtilities.logInfoEvent(`BootstrapStatus: Click handler at index ${clickHandlerIndex} for click ID '${clickedItemId}' ${handlerSucceeded ? "succeeded" : "failed"}`);

                return this.runOneClickHandlerAsync(clickedItemId, clickHandlerIndex + 1);
            });
        }

        runAllRegisteredClickHandlersAsync(clickedItemId) {
            return this.runOneClickHandlerAsync(clickedItemId, 0);
        }

        continueAnywayButtonClick() {
            this.sessionUtilities.logInfoEvent("BootstrapStatus: Continue button selected");

            this.runAllRegisteredClickHandlersAsync(this.sessionUtilities.CLICKABLE_ITEM_ID_CONTINUE_ANYWAY_BUTTON).then(() => {
                try {
                    // Update category states for continue anyway.
                    for (let i = 0; i < this.categoryUiContainers.length; i++) {
                        this.categoryUiContainers[i].prepareForContinueAnywayAsync();
                    }

                    this.sessionUtilities.enrollmentApis.setWasContinuedAnyway(this.sessionUtilities.runningInOobe());
                } catch (e) {
                    this.sessionUtilities.logErrorEvent("BootstrapStatus: setWasContinuedAnyway failed", e);
                }

                this.handleFullyExitingEsp();

                return this.transitionToSuccessPageAsync(CloudExperienceHost.Events.done, this.PAGE_TRANSITION_POST_ESP_SUCCESS_PAGE);
            });
        }

        tryAgainButtonClick() {
            this.sessionUtilities.logInfoEvent("BootstrapStatus: Try Again button selected");
            this.runAllRegisteredClickHandlersAsync(this.sessionUtilities.CLICKABLE_ITEM_ID_TRY_AGAIN_BUTTON).then(() => {
                try {
                    // Reset all categories' states.
                    for (let i = 0; i < this.categoryUiContainers.length; i++) {
                        this.categoryUiContainers[i].resetForTryAgainAsync();
                    }

                    let mdmProgressMode = this.sessionUtilities.getTransientState(this.sessionUtilities.STATE_NAME_GLOBAL_MDM_PROGRESS_MODE);

                    this.sessionUtilities.enrollmentApis.resetProgressTimeout(mdmProgressMode);

                    // Hide all the buttons and hyperlinks at the bottom.
                    this.buttonVisibility(0);
                    this.hyperlinkVisibility(0);
                    this.errorMessage("");
                    this.infoMessage("");

                    // There are no per-category click handlers for the try again button.  In this case,
                    // all categories are rerun.
                    this.runAllCategories(true);
                } catch (e) {
                    this.sessionUtilities.logErrorEvent("BootstrapStatus: Try again failed", e);
                }
            });
        }

        resetDeviceButtonClick() {

            this.sessionUtilities.logInfoEvent("BootstrapStatus: Reset button selected");

            this.runAllRegisteredClickHandlersAsync(this.sessionUtilities.CLICKABLE_ITEM_ID_RESET_BUTTON).then(() => {
                // Disable button so it can't be pressed repeatedly
                this.isResetButtonDisabled(true);

                let pluginManager = new CloudExperienceHostAPI.Provisioning.PluginManager();
                pluginManager.initiateSystemResetAsync().then(() => {
                    this.sessionUtilities.logInfoEvent("BootstrapStatus: Device reset initiated successfully");
                },
                (e) => {
                    // Error happened, re-enable the button
                    this.isResetButtonDisabled(false);

                    this.sessionUtilities.logErrorEvent("BootstrapStatus: Device reset initiation failed", e);
                });
            });
        }

        collectLogsButtonClick() {
            this.sessionUtilities.logInfoEvent("BootstrapStatus: Collect Logs button selected.");
            this.runAllRegisteredClickHandlersAsync(this.sessionUtilities.CLICKABLE_ITEM_ID_COLLECT_LOGS_BUTTON).then(() => {
                if (CloudExperienceHostAPI.FeatureStaging.isOobeFeatureEnabled(this.FEATURE_AUTOPILOTSURFACEHUB22H2)) {
                    this.commercialDiagnosticsUtilities.getExportLogsFolderPath().then((folderPath) => {
                        this.sessionUtilities.enrollmentApis.collectLogs(folderPath);
                    }, (e) => {
                        this.sessionUtilities.logErrorEvent("BootstrapStatus: collectLogsButtonClick failed", e);
                    });
                } else {
                    bridge.invoke("CloudExperienceHost.showFolderPicker").then((folderPath) => {
                        this.sessionUtilities.enrollmentApis.collectLogs(folderPath);
                    }, (e) => {
                        this.sessionUtilities.logErrorEvent("BootstrapStatus: collectLogsButtonClick failed", e);
                    });
                }
            });
        }

        // Sign out is required for scenarios where user is expected to be admin, but due to a race condition
        // at initial login adding user to the administrators group, the user must log out and log back in for
        // admin group membership to take affect.
        signOutButtonClick() {
            this.sessionUtilities.logInfoEvent("BootstrapStatus: Sign out button selected");

            this.runAllRegisteredClickHandlersAsync(this.sessionUtilities.CLICKABLE_ITEM_ID_SIGN_OUT_BUTTON).then(() => {
                // Disable button so it can't be pressed repeatedly
                this.isSignOutButtonDisabled(true);

                // Handle if signing out to continue on failure/timeout
                try {
                    if (!this.provisioningCompleted) {
                        this.sessionUtilities.logInfoEvent("BootstrapStatus: Setting WasContinuedAnyway on sign out");
                        this.sessionUtilities.enrollmentApis.setWasContinuedAnyway(this.sessionUtilities.runningInOobe());
                        this.runAllRegisteredClickHandlersAsync(this.sessionUtilities.CLICKABLE_ITEM_ID_CONTINUE_ANYWAY_BUTTON);
                    }
                } catch (e) {
                    this.sessionUtilities.logErrorEvent("BootstrapStatus: setWasContinuedAnyway failed", e);
                }
                this.handleFullyExitingEsp();

                // Log out the interactive user
                const windowsSessionHelper = new ModernDeployment.Autopilot.Core.AutopilotWindowsSessionHelpers();
                windowsSessionHelper.logoffInteractiveUserAsync().then(() => {
                    return this.transitionToSuccessPageAsync(CloudExperienceHost.Events.done, this.PAGE_TRANSITION_POST_ESP_SUCCESS_PAGE);
                }, (e) => {
                    this.sessionUtilities.logErrorEvent("BootstrapStatus: signOutButton failed", e);

                    // If the sign out button fails for any reason, exit the ESP so the user isn't blocked/stuck.
                    return this.transitionToSuccessPageAsync(CloudExperienceHost.Events.done, this.PAGE_TRANSITION_POST_ESP_SUCCESS_PAGE);
                });
            });
        }

        displayErrorAsync() {
            // Update post OOBE categories' statuses, which don't get updated automatically if we failed in OOBE
            if (this.firstPostOobeCategoryIndex !== -1) {
                for (let i = this.firstPostOobeCategoryIndex; i < this.categoryUiContainers.length; i++) {
                    this.categoryUiContainers[i].showPreviousStepFailedStatusTextIfApplicableAsync();
                }
            }

            return this.checkBlockingValueAsync().then(() => {
                return this.sessionUtilities.enrollmentApis.retrieveCustomErrorText(this.sessionUtilities.runningInOobe());
            }).then((results) => {
                this.errorMessage(results);
                this.displayErrorButtons();
            }).then(() => {
                return WinJS.Promise.as(true);
            }, (e) => {
                this.errorMessage(this.resourceStrings["BootstrapPageDefaultErrorMessage"]);
                this.displayErrorButtons();
            });
        }

        displayErrorButtons() {
            this.sessionUtilities.logInfoEvent(`BootstrapStatus: Show error buttons and hyperlinks with visibility bitmask   = ${this.sessionUtilities.formatNumberAsHexString(this.errorButtonsVisibility, 8)}).`);

            let buttonSetToDisplay = 0;

            this.sessionUtilities.logInfoEvent(`BootstrapStatus: ${((this.errorButtonsVisibility & 1) !== 0) ? "Show" : "Hide"} the reset button.`);

            if ((this.errorButtonsVisibility & 1) !== 0) {
                buttonSetToDisplay |= this.BUTTON_FLAG_RESET_DEVICE;
            }

            this.sessionUtilities.logInfoEvent(`BootstrapStatus: ${((this.errorButtonsVisibility & 2) !== 0) ? "Show" : "Hide"} the try again button.`);

            if ((this.errorButtonsVisibility & 2) !== 0) {
                buttonSetToDisplay |= this.BUTTON_FLAG_TRY_AGAIN;
            }

            if (buttonSetToDisplay !== 0) {
                this.buttonVisibility(buttonSetToDisplay);
            }

            let hyperlinkSetToDisplay = 0;

            this.sessionUtilities.logInfoEvent(`BootstrapStatus: ${((this.errorButtonsVisibility & 4) !== 0) ? "Show" : "Hide"} the continue anyway hyperlink.`);
            if ((this.errorButtonsVisibility & 4) !== 0) {

                if (this.showSignOutButton) {
                    this.sessionUtilities.logInfoEvent("BootstrapStatus: Showing sign out hyperlink instead of continue anyway due to admin policy.");
                    hyperlinkSetToDisplay |= this.HYPERLINK_FLAG_SIGN_OUT;
                } else {
                    this.sessionUtilities.logInfoEvent("BootstrapStatus: Showing continue anyway hyperlink due to admin policy.");
                    hyperlinkSetToDisplay |= this.HYPERLINK_FLAG_CONTINUE_ANYWAY;
                }
            }

            this.sessionUtilities.logInfoEvent(`BootstrapStatus: ${this.showCollectLogsButton ? "Show" : "Hide"} the collect logs hyperlink.`);
            if (this.showCollectLogsButton) {
                hyperlinkSetToDisplay |= this.HYPERLINK_FLAG_COLLECT_LOGS;
            }

            this.hyperlinkVisibility(hyperlinkSetToDisplay);
        }

        async shouldShowContinueAnywayButtonAsync() {
            // Return if continue anyway button can be enabled
            return this.sessionUtilities.getSettingAsync(this.sessionUtilities.STATE_NAME_GLOBAL_SHOW_CONTINUE_ANYWAY_BUTTON).then(
                (result) => {
                    let enableContinueAnyway = false;

                    if (result === "true") {
                        enableContinueAnyway = true;
                    }

                    this.sessionUtilities.logInfoEvent(`BootstrapStatus: shouldShowContinueAnywayButtonAsync = ${enableContinueAnyway}`);
                    return enableContinueAnyway;
                });
        }

        async shouldShowSignOutButtonAsync() {
            try {
                if (!this.sessionUtilities.runningInOobe()) {
                    this.showSignOutButton = false;

                    const shouldBeStandardUser = await this.sessionUtilities.autopilotApis.getOobeSettingsOverrideAsync(EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotOobeSetting.disallowUserAsLocalAdmin);
                    if (!shouldBeStandardUser) {
                        const pluginManager = new CloudExperienceHostAPI.Provisioning.PluginManager();
                        const isAutopilotReset = pluginManager.isPostPowerwash();
                        const isHybrid = (await this.sessionUtilities.autopilotApis.getDwordPolicyAsync("CloudAssignedDomainJoinMethod") === 1);

                        this.sessionUtilities.logInfoEvent(`BootstrapStatus: shouldShowSignOutButton => isAutopilotReset = ${isAutopilotReset} or isHybrid = ${isHybrid}`);

                        if (isAutopilotReset || isHybrid) {
                            this.showSignOutButton = true;
                        }
                    } else {
                        this.sessionUtilities.logInfoEvent("BootstrapStatus: User should not be a member of the admin group.");
                    }
                }
            } catch (e) {
                this.sessionUtilities.logErrorEvent("BootstrapStatus: shouldShowSignOutButton failed", e);
            }
        }

        async checkBlockingValueAsync() {
            try {
                this.errorButtonsVisibility = await this.sessionUtilities.enrollmentApis.checkBlockingValueAsync();
                this.sessionUtilities.logInfoEvent(`BootstrapStatus: Blocking value bitmask = ${this.sessionUtilities.formatNumberAsHexString(this.errorButtonsVisibility, 8)}).`);
            } catch (e) {
                this.sessionUtilities.logErrorEvent("BootstrapStatus: checkBlockingValueAsync failed", e);
            }
        }

        async checkForWhiteGloveModeAsync() {
            try {
                this.isWhiteGloveFlow = false;

                const autopilotMode = await this.sessionUtilities.autopilotApis.getDeviceAutopilotModeAsync();

                if ((autopilotMode === EnterpriseDeviceManagement.Service.AutoPilot.AutopilotMode.whiteGloveCanonical) ||
                    (autopilotMode === EnterpriseDeviceManagement.Service.AutoPilot.AutopilotMode.whiteGloveDJPP)) {
                    this.isWhiteGloveFlow = true;
                }

                this.sessionUtilities.logInfoEvent(`BootstrapStatus: White Glove flow = ${this.isWhiteGloveFlow}).`);
            } catch (e) {
                this.sessionUtilities.logErrorEvent("BootstrapStatus: checkForWhiteGloveModeAsync failed", e);
            }
        }

        async checkShowLogsSettingAsync() {
            try {
                this.showCollectLogsButton = await this.sessionUtilities.enrollmentApis.shouldShowCollectLogsAsync(this.sessionUtilities.runningInOobe());
                this.sessionUtilities.logInfoEvent(`BootstrapStatus: Show collect logs policy = ${this.showCollectLogsButton}`);
            } catch (e) {
                this.sessionUtilities.logErrorEvent("BootstrapStatus: Error thrown trying to get the collect logs policy", e);
            }
        }

       async getsyncFailTimeoutInMillisecondsAsync() {
            let isUsingDeviceTicket = await this.sessionUtilities.autopilotApis.getOobeSettingsOverrideAsync(EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotOobeSetting.aadAuthUsingDeviceTicket)
            if (!isUsingDeviceTicket ||
                    this.sessionUtilities.getSettingAsync(this.sessionUtilities.STATE_NAME_GLOBAL_MDM_ENROLLMENT_STATUS) === this.sessionUtilities.MDM_ENROLLMENT_DISPOSITION[EnterpriseDeviceManagement.Service.AutoPilot.EnrollmentDisposition.completed]) {
                try {
                        this.sessionUtilities.logInfoEvent("BootstrapStatus: Retrieving the ESP Timeout value.");
                        this.syncFailTimeoutInMilliseconds = await sessionUtilities.enrollmentApis.getSyncFailureTimeout()
                        this.sessionUtilities.logInfoEvent(`BootstrapStatus: ESP Timeout successfully retrieved: ${this.syncFailTimeoutInMilliseconds/(1000 * 60)} minutes.`);
                } catch (e) {
                    this.sessionUtilities.logErrorEvent(`BootstrapStatus: Error occurred while retrieving ESP Timeout, falling back to default: ${this.syncFailTimeoutInMilliseconds/(1000 * 60)} minutes.`, e);
                }
            } else {
                this.sessionUtilities.logInfoEvent(`BootstrapStatus: ESP Timeout cannot be retrieved because enrollment hasn't occured yet, falling back to default: ${this.syncFailTimeoutInMilliseconds/(1000 * 60)} minutes.`);
            }
        }

        handleFullyExitingEsp() {
            // This method is invoked only when the ESP is fully exiting (as opposed to going to the diagnostics page transiently).

            // Disable resuming to the ESP after a reboot, since the user chooses to navigate past the ESP.
            this.sessionUtilities.logInfoEvent("CommercialOOBE_ESP_RebootResumption_Unset");

            // Clear the reboot resume value.
            bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", "resumeCXHId");

            // Disable resuming OOBE at a certain node.
            bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", "OOBEResumeEnabled");
        }

        transitionToSuccessPageAsync(
            resultId,
            idOfPageToTransitionTo) {

            return bridge.fireEvent(resultId, idOfPageToTransitionTo);
        }

        exitPage() {
            this.handleFullyExitingEsp();
            if (this.isWhiteGloveFlow) {
                bridge.invoke("CloudExperienceHost.Storage.SharableData.addValue", this.sessionUtilities.WHITE_GLOVE_RESULT_NAME, this.sessionUtilities.WHITE_GLOVE_RESULT_VALUE_SUCCESS);
                bridge.invoke("CloudExperienceHost.Storage.SharableData.addValue", this.sessionUtilities.WHITE_GLOVE_END_TIME_VALUE, Date.now());
                setTimeout(
                    () => {
                        this.sessionUtilities.logInfoEvent("BootstrapStatus: Exiting page due to White Glove success.");
                        return this.transitionToSuccessPageAsync(CloudExperienceHost.Events.done, this.PAGE_TRANSITION_WHITE_GLOVE_RESULTS_PAGE);
                    },
                    this.ACTION_INITIATION_DELAY_IN_MILLISECONDS);
            } else {
                setTimeout(
                    () => {
                        if (this.showSignOutButton) {
                            this.sessionUtilities.logInfoEvent("BootstrapStatus: Displaying sign out to exit page.");
                            this.infoMessage(this.resourceStrings["BootstrapPageAutopilotResetSignOutMessage"]);
                            this.buttonVisibility(this.BUTTON_FLAG_SIGN_OUT);
                        } else {
                            this.sessionUtilities.logInfoEvent("BootstrapStatus: Exiting page normally.");
                            return this.transitionToSuccessPageAsync(CloudExperienceHost.Events.done, this.PAGE_TRANSITION_POST_ESP_SUCCESS_PAGE);
                        }
                    },
                    this.ACTION_INITIATION_DELAY_IN_MILLISECONDS);
            }
        }

        runOneCategory(previousCategorySucceeded, tryingAgain) {
            // Find next visible category to invoke.
            while (this.currentCategoryIndex < this.categoryUiContainers.length) {
                let currentCategory = this.categoryUiContainers[this.currentCategoryIndex];

                if (this.sessionUtilities.runningInOobe() && !currentCategory.runsInOobe()) {
                    // If the OOBE/post-OOBE boundary is hit, exit the page.  I.e., If running in OOBE and there are no more 
                    // in-OOBE categories to run, exit the page.
                    return WinJS.Promise.as(previousCategorySucceeded);
                } else if (!currentCategory.isCategoryInTerminalState() && (currentCategory.getDisposition() === this.sessionUtilities.CATEGORY_DISPOSITION_IGNORED)) {
                    // Still within OOBE or within post-OOBE phase and category hasn't been run yet.  However, the category is supposed to be ignored, and so skip it.
                    this.currentCategoryIndex++;
                } else {
                    break;
                }
            }

            // Return if there aren't any more categories to invoke.
            if (this.currentCategoryIndex >= this.categoryUiContainers.length) {
                return WinJS.Promise.as(previousCategorySucceeded);
            }

            this.clickHandlers.push(this.categoryUiContainers[this.currentCategoryIndex].getClickHandler());

            this.sessionUtilities.logInfoEvent(`BootstrapStatus: Starting category ${this.categoryUiContainers[this.currentCategoryIndex].getId()}...`);

            // Since account set up is a post-OOBE category, it should not use the previousCategorySucceeded value of previous in-OOBE categories
            // Instead, it should use the default previousCategorySucceeded value (true)
            if (this.currentCategoryIndex === this.firstPostOobeCategoryIndex) {
                previousCategorySucceeded = true;
            }

            // Check if Continue Anyway or Sign Out button should be shown
            let shouldShowContinueAnywayPromise = WinJS.Promise.as(false);

            return this.checkBlockingValueAsync().then(() => {
                if ((this.isWhiteGloveFlow === false) && (this.errorButtonsVisibility === 0)) {
                    shouldShowContinueAnywayPromise = this.shouldShowContinueAnywayButtonAsync();
                }
            }).then(() => {
                return shouldShowContinueAnywayPromise.then(
                    (shouldShowButton) => {
                        if (shouldShowButton) {
                            this.sessionUtilities.logInfoEvent(`BootstrapStatus: Button visibility triggered`);
                            this.buttonVisibility(this.showSignOutButton ? this.BUTTON_FLAG_SIGN_OUT : this.BUTTON_FLAG_CONTINUE_ANYWAY);
                        }
                }).then(() => {
                    return this.categoryUiContainers[this.currentCategoryIndex].startActionsAsync(previousCategorySucceeded, tryingAgain).then(
                        // Continuation handler
                        (previousCategorySucceeded) => {
                            this.sessionUtilities.logInfoEvent(`BootstrapStatus: Category ${this.categoryUiContainers[this.currentCategoryIndex].getId()} ${previousCategorySucceeded ? "succeeded" : "failed"}.`);

                            this.currentCategoryIndex++;
                            return this.runOneCategory(previousCategorySucceeded, tryingAgain);
                        },

                        // Error handler
                        (e) => {
                            this.sessionUtilities.logErrorEvent("BootstrapStatus: startActionAsync failed", e);
                        });
                });
            });
        }

        runAllCategories(tryingAgain) {
            // Clear all click handlers since running each category will add them.
            this.clickHandlers = [];
            this.currentCategoryIndex = 0;

            return new WinJS.Promise(
                // Promise initialization
                (completeDispatch, errorDispatch, progressDispatch) => {
                    this.sessionUtilities.logInfoEvent(`BootstrapStatus: Applying the ESP Timeout value: ${this.syncFailTimeoutInMilliseconds/(1000 * 60)} minutes.`);
                    WinJS.Promise.timeout(this.syncFailTimeoutInMilliseconds, this.runOneCategory(true, tryingAgain)).then((previousCategorySucceeded) => {
                        if (previousCategorySucceeded) {
                            this.provisioningCompleted = true;
                            this.exitPage();
                        } else if ((previousCategorySucceeded !== true) && (this.isWhiteGloveFlow)) {
                            // Redirect to White Glove failure page
                            let error = this.sessionUtilities.getTransientState(this.sessionUtilities.WHITE_GLOVE_ERROR_USER_MESSAGE);

                            if (error === undefined) {
                                error = this.resourceStrings.WhiteGloveTimeOutError;
                            }

                            bridge.invoke("CloudExperienceHost.Storage.SharableData.addValue", this.sessionUtilities.WHITE_GLOVE_RESULT_NAME, error);
                            bridge.invoke("CloudExperienceHost.Storage.SharableData.addValue", this.sessionUtilities.WHITE_GLOVE_END_TIME_VALUE, Date.now());

                            setTimeout(
                                () => {
                                    this.sessionUtilities.logInfoEvent("BootstrapStatus: Exiting page due to White Glove failure.");

                                    this.handleFullyExitingEsp();

                                    return this.transitionToSuccessPageAsync(CloudExperienceHost.Events.done, this.PAGE_TRANSITION_WHITE_GLOVE_RESULTS_PAGE);
                                },
                                this.ACTION_INITIATION_DELAY_IN_MILLISECONDS);
                        } else {
                            return this.displayErrorAsync().then(() => {
                                return previousCategorySucceeded;
                            });
                        }

                        return WinJS.Promise.as(previousCategorySucceeded);
                    }).then((previousCategorySucceeded) => {
                        completeDispatch(previousCategorySucceeded);
                    });
                },

                // Cancellation event handler
                () => {
                });
        }
    }

    return autopilotEspProgressViewModel;
});
