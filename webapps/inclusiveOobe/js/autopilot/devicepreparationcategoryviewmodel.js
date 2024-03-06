//
// Copyright (C) Microsoft. All rights reserved.
//

"use strict";

define([
    'legacy/bridge',
    'legacy/events',
    'autopilot/bootstrapStatusSubcategoryViewModel',
    'autopilot/mdmBootstrapSessionUtilities'], (
    bridge,
    constants,
    bootstrapStatusSubcategoryViewModel,
    mdmBootstrapSessionUtilities) => {
    class devicePreparationCategoryViewModel {
        constructor(resourceStrings, sessionUtilities) {
            // Constants
            this.MAX_TPM_ATTESTATION_WAIT_TIME_IN_MILLISECONDS = 420000; // 7 minutes
            this.MIN_PPKG_PROCESSING_TIME_IN_MILLISECONDS = 5000;   // 5 seconds
            this.POLLING_INTERVAL_IN_MILLISECONDS = 500; // .5 seconds

            // Provisioning progress enumerations
            this.PROVISIONING_STATUS_RUNNING = 0;
            this.PROVISIONING_STATUS_SUCCEEDED = 1;
            this.PROVISIONING_STATUS_FAILED = 2;

            // ESP policy provider installation result codes
            this.ESP_POLICY_PROVIDER_INSTALL_RESULT_SUCCESS = 1;
            this.ESP_POLICY_PROVIDER_INSTALL_RESULT_TIMEOUT = 2;
            this.ESP_POLICY_PROVIDER_INSTALL_RESULT_FAILURE = 3;

            // Private member variables
            this.resourceStrings = resourceStrings;
            this.tpmIsAttested = false;
            this.whiteGloveMode = 0; // Initialize to unknown mode
            this.isUsingDeviceTicket = false;
            this.tpmAttestationEventName = "tpmevent";
            this.timeoutErrorCode = 0x800705B4;

            this.sessionUtilities = sessionUtilities;
            this.mdmBootstrapSessionUtilities = new mdmBootstrapSessionUtilities(
                resourceStrings,
                this.sessionUtilities.runningInOobe(),
                sessionUtilities);

            this.initializationPromise = this.sessionUtilities.autopilotApis.getDeviceAutopilotModeAsync().then((mode) => {
                this.whiteGloveMode = mode;
            }).then(() => {
                return this.sessionUtilities.autopilotApis.getOobeSettingsOverrideAsync(EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotOobeSetting.aadAuthUsingDeviceTicket);
            }).then((isUsingDeviceTicket) => {
                this.isUsingDeviceTicket = isUsingDeviceTicket;
                return bridge.invoke("CloudExperienceHost.Storage.SharableData.getValue", "AutopilotWhiteGloveStartTime");
            }).then((startTime) => {
                this.whiteGloveStartTime = startTime;
            });
        }

        // Private methods
        runTpmAttestationAsync() {
            return new WinJS.Promise(
                // Promise initialization handler
                (completeDispatch, errorDispatch, progressDispatch) => {
                    this.sessionUtilities.logInfoEvent("Beginning TPM identity attestation for device token Azure AD Join.");

                    let tpmAttestationWaitPromise = new WinJS.Promise(
                        // Promise initialization handler
                        (completeDispatch, errorDispatch, progressDispatch) => {
                            // Create event handler.
                            this.tpmAttestationListener = (hresult) => {
                                if (0 === hresult.target) {
                                    this.sessionUtilities.logInfoEvent(`BootstrapStatus: TPM attestation succeeded.`);
                                    this.tpmIsAttested = true;
                                } else {
                                    this.tpmAttestationErrorHresultString = this.sessionUtilities.formatNumberAsHexString(hresult.target, 8);
                                    this.sessionUtilities.logInfoEvent(`BootstrapStatus: TPM attestation failed (hr = ${this.tpmAttestationErrorString}).`);
                                    let errorMessage = this.sessionUtilities.formatMessage(this.resourceStrings.BootstrapPageDevicePreparationTpmError, this.tpmAttestationErrorHresultString);
                                    this.sessionUtilities.storeTransientState(this.sessionUtilities.WHITE_GLOVE_ERROR_USER_MESSAGE, errorMessage);
                                }

                                completeDispatch(true);
                            };

                            // Register event handler.
                            try {
                                this.sessionUtilities.tpmNotificationManager.addEventListener(this.tpmAttestationEventName, this.tpmAttestationListener.bind(this));
                            } catch (e) {
                                this.sessionUtilities.logErrorEvent("BootstrapStatus: Registering TPM event listener failed.", e);
                            }
                        },

                        // Promise cancellation event handler
                        () => {
                        });

                    // Set a max timeout for TPM attestation
                    let tpmAttestationTimeoutPromise = WinJS.Promise.timeout(this.MAX_TPM_ATTESTATION_WAIT_TIME_IN_MILLISECONDS).then(() => {
                        this.sessionUtilities.logInfoEvent("BootstrapStatus: TPM attestation timed out.");
                    });

                    let tpmAttestationPromises = [
                        tpmAttestationTimeoutPromise,
                        tpmAttestationWaitPromise
                    ];

                    // Wait for either the TPM attested state or the timeout.
                    return WinJS.Promise.any(tpmAttestationPromises).then(() => {
                        if (this.tpmAttestationListener !== null) {
                            // Remove event listener for TPM Attestation
                            try {
                                this.sessionUtilities.tpmNotificationManager.removeEventListener(this.tpmAttestationEventName, this.tpmAttestationListener.bind(this));
                            } catch (e) {
                                this.sessionUtilities.logErrorEvent("BootstrapStatus: Deregistering TPM event listener failed.", e);
                            }
                        }

                        tpmAttestationTimeoutPromise.cancel();
                        tpmAttestationTimeoutPromise = null;

                        // ERROR_TIMEOUT
                        if (!this.tpmIsAttested && (undefined === this.tpmAttestationErrorHresultString)) {
                            this.tpmAttestationErrorHresultString = this.sessionUtilities.formatNumberAsHexString(this.sessionUtilities.HRESULT_TIMEOUT, 8);
                            this.sessionUtilities.storeTransientState(this.sessionUtilities.WHITE_GLOVE_ERROR_USER_MESSAGE, this.resourceStrings.WhiteGloveTpmTimeoutError);
                        }

                        completeDispatch(this.sessionUtilities.createActionResult(
                            this.tpmIsAttested ? this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED : this.sessionUtilities.SUBCATEGORY_STATE_FAILED,
                            this.tpmAttestationErrorHresultString));

                    });
                },

                // Promise cancellation event handler
                () => {
                });
        }

        startWaitForTpmAttestationAsync() {
            if (!this.isUsingDeviceTicket) {
                // Check if this is the White Glove flow, which requires TPM attestation.
                return bridge.invoke("CloudExperienceHost.Storage.SharableData.getValue", "AutopilotWhiteGloveStartTime").then(
                    // Continuation handler
                    (result) => {
                        if (undefined === result) {
                            // White Glove is NOT in progress.
                            this.sessionUtilities.logInfoEvent("BootstrapStatus: Unable to find AutopilotWhiteGloveStartTime value.");
                            this.sessionUtilities.logInfoEvent("Skipping TPM Attestation.");

                            // Since the device won't be using a device AAD ticket and White Glove is not in progress, then there's no need to initiate TPM attestation.
                            return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                                this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                                null));
                        }

                        // White Glove is in progress.
                        this.sessionUtilities.logInfoEvent("OOBEProvisioningProgress AutopilotWhiteGloveFlow");
                        return this.runTpmAttestationAsync();
                    },

                    // Error handler
                    (e) => {
                        // Return an error.
                        this.sessionUtilities.logErrorEvent("BootstrapStatus: TPM attestation failed.", e);

                        return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                            this.sessionUtilities.SUBCATEGORY_STATE_FAILED,
                            null));
                    });
            }

            return this.runTpmAttestationAsync();
        }

        pollForPpkgProcessingResultsAsync() {
            return new WinJS.Promise(
                // Promise initialization handler
                (completeDispatch, errorDispatch, progressDispatch) => {
                    return this.sessionUtilities.provisioningPluginManager.getProvisioningSucceededAsync().then((processingResult) => {
                        if (this.sessionUtilities.provisioningPluginManager.isRebootRequired()) {
                            // Provisioning processing requires a reboot. Initiate it now.
                            this.sessionUtilities.logInfoEvent("BootstrapStatus: Provisioning processing requires a reboot.");
                            try {
                                bridge.fireEvent(constants.Events.done, constants.AppResult.action1);
                                this.sessionUtilities.logInfoEvent("Reboot following provisioning succeeded.");
                            } catch (e) {
                                this.sessionUtilities.logErrorEvent("BootstrapStatus: Attempted reboot following provisioning failed.", e);
                            }

                            // Stop polling with success (although shouldn't matter, since the device will reboot anyway).
                            completeDispatch(this.sessionUtilities.createActionResult(
                                this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                                null));

                        } else if (this.PROVISIONING_STATUS_SUCCEEDED === processingResult) {
                            this.sessionUtilities.logInfoEvent("BootstrapStatus: PPKG package provisioning succeeded.");

                            // Stop polling with success.
                            completeDispatch(this.sessionUtilities.createActionResult(
                                this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                                null));

                        } else if (this.PROVISIONING_STATUS_FAILED === processingResult) {
                            this.sessionUtilities.logInfoEvent("BootstrapStatus: PPKG package provisioning failed.");

                            // Stop polling with error.
                            completeDispatch(this.sessionUtilities.createActionResult(
                                this.sessionUtilities.SUBCATEGORY_STATE_FAILED,
                                this.resourceStrings["BootstrapPageDevicePreparationReapplyingPpkgsErrorMessage"]));
                        }

                        // Default: Continue waiting.

                    }).then(() => {
                        // Continue waiting.
                        return WinJS.Promise.timeout(this.POLLING_INTERVAL_IN_MILLISECONDS);

                    }).then(() => {
                        // Poll once again.
                        return pollForPpkgProcessingResultsAsync();
                    });

                }, () => {
                    // Promise cancellation event handler
                });
        }

        startPpkgProcessingAsync() {
            return this.sessionUtilities.getSettingAsync(this.sessionUtilities.STATE_NAME_GLOBAL_RESTORE_MDM_TASKS).then((restoreMdmTasks) => {
                if (restoreMdmTasks === "false") {
                    return WinJS.Promise.as();
                }

                try {
                    this.sessionUtilities.logInfoEvent("Rebuilding schedules and syncing with server.");
                    return this.sessionUtilities.enrollmentApis.rebuildSchedulesAndSyncWithServerAsync();
                } catch (e) {
                    this.sessionUtilities.logErrorEvent("BootstrapStatus: rebuildSchedulesAndSyncWithServerAsync failed.", e);
                }

            }).then(() => {
                return this.sessionUtilities.getSettingAsync(this.sessionUtilities.STATE_NAME_GLOBAL_RUN_PROVISIONING);

            }).then((runProvisioning) => {
                if (runProvisioning === "false") {
                    // No provisioning should be done.
                    this.sessionUtilities.logInfoEvent("AADJ Provisioning skipped.");

                    return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                        this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                        null));

                }

                let provisioningPromises = [
                    this.sessionUtilities.provisioningPluginManager.applyAfterConnectivityPackagesAsync(),
                    WinJS.Promise.timeout(this.MIN_PPKG_PROCESSING_TIME_IN_MILLISECONDS)
                ];

                return WinJS.Promise.join(provisioningPromises)
                    .then(() => {
                        return this.pollForPpkgProcessingResultsAsync();
                    });

            });
        }

        startDeviceAadjAndEnrollmentHelperAsync() {
            this.sessionUtilities.logInfoEvent("BootstrapStatus: Starting Autopilot device enrollment.");

            return this.sessionUtilities.autopilotApis.performDeviceEnrollmentAsync().then((result) => {
                // Continuation handler
                this.sessionUtilities.logInfoEvent("BootstrapStatus: Device enrollment call completed. Processing results...");
                let enrollmentState = result.enrollmentDisposition;

                this.sessionUtilities.logInfoEvent("BootstrapStatus: Result data extracted.");

                this.sessionUtilities.storeSettingAsync(
                    this.sessionUtilities.STATE_NAME_GLOBAL_MDM_ENROLLMENT_STATUS,
                    this.sessionUtilities.MDM_ENROLLMENT_DISPOSITION[enrollmentState]);

                if (enrollmentState === EnterpriseDeviceManagement.Service.AutoPilot.EnrollmentDisposition.completed) {
                    this.sessionUtilities.logInfoEvent("BootstrapStatus: Enrollment disposition marked as completed.");

                    this.sessionUtilities.logInfoEvent(`BootstrapStatus: Device enrollment results: ${enrollmentState}, ${this.sessionUtilities.formatNumberAsHexString(result.dispositionResult, 8)}`);

                    return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                        this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                        null));

                } else {
                    this.sessionUtilities.logInfoEvent("BootstrapStatus: Enrollment disposition marked as not completed.");

                    let errorCode = this.sessionUtilities.formatNumberAsHexString(result.dispositionResult, 8);
                    let resultMessage = this.sessionUtilities.formatMessage(`${enrollmentState}, ${errorCode}`);

                    this.sessionUtilities.logInfoEvent(`BootstrapStatus: Device enrollment results: ${resultMessage}`);

                    switch (enrollmentState) {
                        case EnterpriseDeviceManagement.Service.AutoPilot.EnrollmentDisposition.aadConfigure:
                            this.sessionUtilities.logInfoEvent("CommercialOOBE_ESPDevicePreparation_DeviceEnrollment_WhiteGloveAadConfigureError");
                            this.sessionUtilities.storeTransientState(this.sessionUtilities.WHITE_GLOVE_ERROR_USER_MESSAGE, this.sessionUtilities.formatMessage(this.resourceStrings.WhiteGloveAadConfigureError, errorCode));
                            break;

                        case EnterpriseDeviceManagement.Service.AutoPilot.EnrollmentDisposition.aadJoin:
                            this.sessionUtilities.logInfoEvent("CommercialOOBE_ESPDevicePreparation_DeviceEnrollment_WhiteGloveAadJoinError");
                            this.sessionUtilities.storeTransientState(this.sessionUtilities.WHITE_GLOVE_ERROR_USER_MESSAGE, this.sessionUtilities.formatMessage(this.resourceStrings.WhiteGloveAadJoinError, errorCode));
                            break;

                        case EnterpriseDeviceManagement.Service.AutoPilot.EnrollmentDisposition.aadDeviceDiscovery:
                            this.sessionUtilities.logInfoEvent("CommercialOOBE_ESPDevicePreparation_DeviceEnrollment_WhiteGloveAadDeviceDiscoveryError");
                            this.sessionUtilities.storeTransientState(this.sessionUtilities.WHITE_GLOVE_ERROR_USER_MESSAGE, this.sessionUtilities.formatMessage(this.resourceStrings.WhiteGloveAadDeviceDiscoveryError, errorCode));
                            break;

                        case EnterpriseDeviceManagement.Service.AutoPilot.EnrollmentDisposition.aadTicket:
                            this.sessionUtilities.logInfoEvent("CommercialOOBE_ESPDevicePreparation_DeviceEnrollment_WhiteGloveAadTicketError");
                            this.sessionUtilities.storeTransientState(this.sessionUtilities.WHITE_GLOVE_ERROR_USER_MESSAGE, this.sessionUtilities.formatMessage(this.resourceStrings.WhiteGloveAadTicketError, errorCode));
                            break;

                        case EnterpriseDeviceManagement.Service.AutoPilot.EnrollmentDisposition.mdmEnrolling:
                            this.sessionUtilities.logInfoEvent("CommercialOOBE_ESPDevicePreparation_DeviceEnrollment_WhiteGloveMdmEnrollmentError");
                            this.sessionUtilities.storeTransientState(this.sessionUtilities.WHITE_GLOVE_ERROR_USER_MESSAGE, this.sessionUtilities.formatMessage(this.resourceStrings.WhiteGloveMdmEnrollmentError, errorCode));
                            break;

                        default:
                            this.sessionUtilities.logInfoEvent("CommercialOOBE_ESPDevicePreparation_DeviceEnrollment_WhiteGloveGenericEnrollmentError");
                            this.sessionUtilities.storeTransientState(this.sessionUtilities.WHITE_GLOVE_ERROR_USER_MESSAGE, this.sessionUtilities.formatMessage(this.resourceStrings.WhiteGloveGenericEnrollmentError, errorCode));
                    }

                    return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                        this.sessionUtilities.SUBCATEGORY_STATE_FAILED,
                        resultMessage));
                }
            },
            (e) => {
                // Error handler
                this.sessionUtilities.logErrorEvent("BootstrapStatus: performDeviceEnrollmentAsync failed.", e);

                return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                    this.sessionUtilities.SUBCATEGORY_STATE_FAILED,
                    null));
            });
        }

        startDeviceAadjAndEnrollmentAsync() {
            if ((!this.isUsingDeviceTicket || (this.whiteGloveMode === EnterpriseDeviceManagement.Service.AutoPilot.AutopilotMode.whiteGloveDJPP))
                && (this.whiteGloveMode !== EnterpriseDeviceManagement.Service.AutoPilot.AutopilotMode.whiteGloveCanonical)) {
                // If the device won't be using a device AAD ticket, then there's no need to perform
                // device AADJ and MDM enrollment.
                this.sessionUtilities.logInfoEvent("Skipping MDM enrollment.");

                return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                    this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                    null));
            } 

            if (undefined !== this.whiteGloveStartTime) {
                // Device enrollment for White Glove.
                this.sessionUtilities.logInfoEvent("BootstrapStatus: White glove device enrollment.");

                return this.sessionUtilities.autopilotApis.setDeviceAutopilotModeAsync(EnterpriseDeviceManagement.Service.AutoPilot.AutopilotMode.whiteGloveCanonical).then(() => {
                    return this.startDeviceAadjAndEnrollmentHelperAsync();
                },
                (e) => {
                    this.sessionUtilities.logErrorEvent("BootstrapStatus: White glove device enrollment error.", e);
                });
            }

            this.sessionUtilities.logInfoEvent("BootstrapStatus: Normal (i.e., non-white-glove) device enrollment.");
            return this.startDeviceAadjAndEnrollmentHelperAsync();
        }

        waitForEspPolicyProviders() {
            this.sessionUtilities.logInfoEvent("BootstrapStatus: Starting the wait for policy providers installation.");

            return this.sessionUtilities.espTrackingUtility.waitForPolicyProviderInstallationToCompleteAsync().then((result) => {
                this.sessionUtilities.logInfoEvent("BootstrapStatus: waitForPolicyProviderInstallationToComplete returned, processing results...");

                if (result.installationResult === this.ESP_POLICY_PROVIDER_INSTALL_RESULT_SUCCESS) {
                    // Completed successfully
                    this.sessionUtilities.logInfoEvent("BootstrapStatus: All policy providers have successfully installed a list of policies.");

                    return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                        this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                        null));
                }

                // Return failure.
                let errorCode = 0;

                switch (result.installationResult) {
                    case this.ESP_POLICY_PROVIDER_INSTALL_RESULT_TIMEOUT:
                        // Provider timeout
                        errorCode = result.errorCode;
                        this.sessionUtilities.logInfoEvent(`BootstrapStatus: Timed out waiting for all policy providers to provide a list of policies. (${this.sessionUtilities.formatNumberAsHexString(errorCode)})`);
                        break;

                    case this.ESP_POLICY_PROVIDER_INSTALL_RESULT_FAILURE:
                        // Provider reported error
                        errorCode = result.errorCode;
                        this.sessionUtilities.logInfoEvent(`BootstrapStatus: Policy provider(s) installation failed. Error: ${this.sessionUtilities.formatNumberAsHexString(errorCode, 8)}.`);
                        break;

                    default:
                        errorCode = 0x8000FFFF; // E_UNEXPECTED
                        this.sessionUtilities.logInfoEvent(`BootstrapStatus: Policy provider failure: unexpected installationResult encountered (${result.installationResult}). Error: ${this.sessionUtilities.formatNumberAsHexString(errorCode, 8)}.`);
                }

                this.sessionUtilities.storeTransientState(this.sessionUtilities.WHITE_GLOVE_ERROR_USER_MESSAGE, this.sessionUtilities.formatMessage(this.resourceStrings.WhiteGloveEspProviderError, this.sessionUtilities.formatNumberAsHexString(errorCode, 8)));

                return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                    this.sessionUtilities.SUBCATEGORY_STATE_FAILED,
                    this.sessionUtilities.formatNumberAsHexString(errorCode, 8)));
            },
            (e) => {
                this.sessionUtilities.logErrorEvent("BootstrapStatus: waitForPolicyProviderInstallationToComplete Failed", e);
            });
        }

        setContinueAnywayButtonVisibility() {
            // If this subcategory is being run, it means Device Preparation has succeeded and the Continue Anyway button can be enabled
            this.sessionUtilities.logInfoEvent("BootstrapStatus: setContinueAnywayButtonVisibility triggered.");

            return this.sessionUtilities.storeSettingAsync(this.sessionUtilities.STATE_NAME_GLOBAL_SHOW_CONTINUE_ANYWAY_BUTTON, "true").then(() => {
                return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                    this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                    null));
            });
        }

        // Category interface methods

        getId() {
            return "DevicePreparationCategory";
        }

        getTitle() {
            return this.resourceStrings["BootstrapPageDevicePreparationCategoryTitle"];
        }

        getIconClass() {
            return "icon-gears";
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
            return [
                new bootstrapStatusSubcategoryViewModel(
                    this.resourceStrings,
                    this.sessionUtilities,
                    "DevicePreparation.TpmAttestationSubcategory",
                    this.resourceStrings["BootstrapPageDevicePreparationTpmAttestationSubcategoryTitle"],
                    false,
                    () => {
                        if ((this.sessionUtilities.provisioningPluginManager != undefined)
                            && (this.sessionUtilities.provisioningPluginManager != null)) {
                            // Skip TPM attestation if post-reset because device is already enrolled
                            if (this.sessionUtilities.provisioningPluginManager.isPostPowerwash()) {
                                this.sessionUtilities.logInfoEvent("BootstrapStatus: Skipping TPM attestation because in post-reset flow.");
                                return this.sessionUtilities.SUBCATEGORY_DISPOSITION_IGNORED;
                            }
                        }

                        return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                    },
                    (progressCallbackAsync) => {
                        return this.startWaitForTpmAttestationAsync();
                    }),

                new bootstrapStatusSubcategoryViewModel(
                    this.resourceStrings,
                    this.sessionUtilities,
                    "DevicePreparation.AadjSubcategory",
                    this.resourceStrings["BootstrapPageDevicePreparationAadjSubcategoryTitle"],
                    false,
                    () => {
                        return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                    },
                    (progressCallbackAsync) => {
                        return this.startPpkgProcessingAsync();
                    }),

                new bootstrapStatusSubcategoryViewModel(
                    this.resourceStrings,
                    this.sessionUtilities,
                    "DevicePreparation.MdmEnrollmentSubcategory",
                    this.resourceStrings["BootstrapPageDevicePreparationMdmEnrollmentSubcategoryTitle"],
                    false,
                    () => {
                        return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                    },
                    (progressCallbackAsync) => {
                        return this.startDeviceAadjAndEnrollmentAsync();
                    }),

                new bootstrapStatusSubcategoryViewModel(
                    this.resourceStrings,
                    this.sessionUtilities,
                    "DevicePreparation.EspProviderInstallationSubcategory",
                    this.resourceStrings["BootstrapPageDevicePreparationEspProviderInstallationSubcategoryTitle"],
                    true,
                    () => {
                        return this.sessionUtilities.SUBCATEGORY_DISPOSITION_VISIBLE;
                    },
                    (progressCallbackAsync) => {
                        return this.waitForEspPolicyProviders();
                    }),

                // This subcategory needs to be parallelized with EspProviderInstallationSubcategory because it's waiting on Intune to install
                // policy providers during sync sessions.
                new bootstrapStatusSubcategoryViewModel(
                    this.resourceStrings,
                    this.sessionUtilities,
                    "DevicePreparation.InitiateSyncSessions",
                    "DevicePreparation.InitiateSyncSessions",
                    true,
                    () => {
                        return this.sessionUtilities.SUBCATEGORY_DISPOSITION_SILENT;
                    },
                    (progressCallbackAsync) => {
                        // This is a fire and forget best effort operation, always return succes
                        this.mdmBootstrapSessionUtilities.initiateSyncSessionsAsync(ModernDeployment.Autopilot.Core.SyncSessionExitCondition.policyProvidersComplete);

                        return WinJS.Promise.as(this.sessionUtilities.createActionResult(
                            this.sessionUtilities.SUBCATEGORY_STATE_SUCCEEDED,
                            null));
                    }),

                // The following subcategory has to run last in Device Preparation as
                // the continue anyway button should only be enabled to show if all previous
                // subcategories have succeeded
                new bootstrapStatusSubcategoryViewModel(
                    this.resourceStrings,
                    this.sessionUtilities,
                    "DevicePreparation.SetContinueAnywayButtonVisibility",
                    "DevicePreparation.SetContinueAnywayButtonVisibility",
                    false,
                    () => {
                        return this.sessionUtilities.SUBCATEGORY_DISPOSITION_SILENT;
                    },
                    (progressCallbackAsync) => {
                        return this.setContinueAnywayButtonVisibility();
                    })
            ];
        }

        getClickHandler() {
            return (handlerParameters) => {
                // True means that this handler succeeded.
                return WinJS.Promise.as(true);
            };
        }

    }

    return devicePreparationCategoryViewModel;
});
