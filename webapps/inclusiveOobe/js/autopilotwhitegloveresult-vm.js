//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout', 'legacy/bridge', 'legacy/events', 'legacy/core', 'autopilot-telemetry'], (ko, bridge, constants, core, autopilotTelemetryUtility) => {
    class WhiteGloveResultViewModel {
        constructor(resourceStrings) {
            this.enterpriseManagementWorker = new EnterpriseDeviceManagement.Enrollment.ReflectedEnroller();
            this.pluginManager = new CloudExperienceHostAPI.Provisioning.PluginManager();
            this.autoPilotManager = new EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotServer();
            this.deviceManagementUtilities = new ModernDeployment.Autopilot.Core.DeviceManagementUtilities();

            // UI element initialization
            this.resourceStrings = resourceStrings;
            this.organizationName = ko.observable(resourceStrings.WhiteGloveOrganizationNotFound);
            this.profileName = ko.observable(resourceStrings.WhiteGloveProfileNotFound);
            this.assignedUserName = ko.observable(resourceStrings.WhiteGloveUserNotAssigned);
            this.elapsedHoursText = resourceStrings.WhiteGloveHoursText;
            this.elapsedMinutesText = resourceStrings.WhiteGloveMinutesText;
            this.elapsedTimeNumber = ko.observable(resourceStrings.WhiteGloveTimeText);
            this.title = resourceStrings.WhiteGloveTitle;
            this.subHeaderText = ko.observable("");
            this.subHeaderErrorText = ko.observable("");
            this.organizationText = resourceStrings.WhiteGloveOrganizationTitle;
            this.profileText = resourceStrings.WhiteGloveProfileTitle;
            this.assignedUserText = resourceStrings.WhiteGloveAssignedUserTitle;
            this.elapsedTimeText = resourceStrings.WhiteGloveElapsedTimeTitle;
            
            this.provisioningTextStyle = ko.observable("");
            this.resultBackground = ko.observable("");
            this.showResultFooter = ko.observable("");
            this.isResetButtonDisabled = ko.observable(false);
            this.isRetryButtonDisabled = ko.observable(true);
            this.isDiagnosticsDisabled = ko.observable(false);
            this.isLoading = ko.observable(false);
            
            let flexStartHyperlinksSets = {};
            let flexEndButtonsSets = {};
            this.hyperlinkVisibility = ko.observable(0);

            // Sharable Data Values - must be kept in sync with their values in:
            // autopilotwhiteglovelanding-vm.js
            // oobeprovisioningprogress-vm.js
            this.whiteGloveStartTimeValueName = "AutopilotWhiteGloveStartTime";
            this.whiteGloveSuccessValueName = "AutopilotWhiteGloveSuccess";
            this.whiteGloveDomainJoinStateValueName = "AutopilotWhiteGloveDomainJoinInProgress";

            // Time Constants
            this.msPerHour = 3600000;
            this.msPerMinute = 60000;

            // Footer Button Visibility Enumerations
            const whiteGloveSuccess = 0;
            const whiteGloveFailure = 1;

            // Diagnostics Enumerations
            const whiteGloveAreaName = "Autopilot;TPM";
            const whiteGloveLogName = "\\AutopilotWhiteGloveLogs.zip";

            flexStartHyperlinksSets[whiteGloveSuccess] = [];
            flexStartHyperlinksSets[whiteGloveFailure] = [
                {
                    handler: () => {
                        this.onDiagnosticsClickAsync(whiteGloveAreaName, whiteGloveLogName);
                    },
                    disableControl: ko.pureComputed(() => {
                        return this.isDiagnosticsDisabled();
                    }),
                    hyperlinkText: resourceStrings.WhiteGloveDiagnosticsButtonText
                }
            ];

            this.flexStartHyperLinks = ko.pureComputed(() => {
                return flexStartHyperlinksSets[this.hyperlinkVisibility()];
            });

            flexEndButtonsSets[whiteGloveSuccess] = [
                {
                    buttonText: resourceStrings.WhiteGloveResealButtonText,
                    buttonType: "button",
                    isPrimaryButton: true,
                    buttonClickHandler: () => {
                        this.onResealAsync();
                    }
                }
            ];

            flexEndButtonsSets[whiteGloveFailure] = [
                {
                    buttonText: resourceStrings.WhiteGloveRetryButtonText,
                    buttonType: "button",
                    isPrimaryButton: true,
                    disableControl: ko.pureComputed(() => {
                        return this.isRetryButtonDisabled();
                    }),
                    buttonClickHandler: () => {
                        bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", this.whiteGloveSuccessValueName);
                        bridge.fireEvent(constants.Events.done, constants.AppResult.action1);
                    }
                },
                {
                    buttonText: resourceStrings.WhiteGloveResetButtonText,
                    buttonType: "button",
                    isPrimaryButton: true,
                    disableControl: ko.pureComputed(() => {
                        return this.isResetButtonDisabled();
                    }),
                    buttonClickHandler: () => {
                        this.onResetAsync();
                    }
                }
            ];

            this.flexEndButtons = ko.pureComputed(() => {
                return flexEndButtonsSets[this.hyperlinkVisibility()];
            });

            this.runAsync(this.displayResultsAsyncGen);
        }      

        onResetAsync() {
            return this.runAsync(this.resetAsyncGen);
        }

        *resetAsyncGen() {
            this.isResetButtonDisabled(true);
            this.isDiagnosticsDisabled(true);

            yield bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "White glove failure page system reset chosen");

            yield bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", this.whiteGloveStartTimeValueName);
            yield bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", this.whiteGloveDomainJoinStateValueName);
            yield bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", this.whiteGloveSuccessValueName);

            try {
                yield this.pluginManager.initiateSystemResetAsync();
                yield bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "White glove failure page system reset successful");
            } catch (error) {
                yield this.runAsync(this.logFailureEventAsyncGen, autopilotTelemetryUtility.whiteGloveError.Reset, "system reset error", error);
                this.displayError();
            }
        }

        onDiagnosticsClickAsync(area, file) {
            return this.runAsync(this.diagnosticsClickHandlerAsyncGen, area, file);
        }

        *diagnosticsClickHandlerAsyncGen(area, file) {
            yield bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "White glove failure page collect logs chosen");
            let formerSubheaderText = this.subHeaderText._latestValue;
            let formerIsRetryButtonDisabledState = this.isRetryButtonDisabled._latestValue;

            try {
                let folderPath = yield bridge.invoke("CloudExperienceHost.showFolderPicker");

                this.isResetButtonDisabled(true);
                this.isDiagnosticsDisabled(true);
                this.isRetryButtonDisabled(true);
                this.isLoading(true);

                this.subHeaderText(this.resourceStrings.CollectingLogsSpinnerText);

                yield this.enterpriseManagementWorker.collectLogsEx(area, folderPath + file);

                this.isResetButtonDisabled(false);
                this.isDiagnosticsDisabled(false);
                this.isLoading(false);
                this.isRetryButtonDisabled(formerIsRetryButtonDisabledState);
                this.subHeaderText(formerSubheaderText);

                yield bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "White glove failure page collect logs failure");
            } catch (error) {
                yield this.runAsync(this.logFailureEventAsyncGen, "log collection error", error);

                this.isResetButtonDisabled(false);
                this.isDiagnosticsDisabled(false);
                this.isLoading(false);
                this.isRetryButtonDisabled(formerIsRetryButtonDisabledState);
                this.subHeaderText(formerSubheaderText);

                this.displayError();
            }
        }

        onResealAsync() {
            return this.runAsync(this.resealAsyncGen);
        }

        *resealAsyncGen() {
            try {
                yield bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "White glove reseal started");

                // Clears new sharable data
                yield bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", this.whiteGloveStartTimeValueName);
                yield bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", this.whiteGloveSuccessValueName);
                yield bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", this.whiteGloveDomainJoinStateValueName);

                // Update the white glove mode indicating that technician flow has completed and the device has been resealed.
                yield this.autoPilotManager.setDeviceAutopilotModeAsync(EnterpriseDeviceManagement.Service.AutoPilot.AutopilotMode.whiteGloveResealed);

                // Clears value so first page of OOBE will show on start up
                yield bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", "resumeCXHId");

                // Disables resuming OOBE at a certain node
                yield bridge.invoke("CloudExperienceHost.Storage.SharableData.removeValue", "OOBEResumeEnabled");

                // Deletes the following so that the Device ESP is displayed during the user flow after reseal:
                // 1. The IsSyncDone registry value
                // 2. The ServerHasFinishedProvisioning registry value
                // 3. The DMClient CSP tracking files
                // 4. The Sidecar tracking policies
                yield this.deviceManagementUtilities.prepareForResealAsync();

                // Powers down the device
                yield CloudExperienceHostAPI.UtilStaticsCore.shutdownAsync();
                yield bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "White glove shut down initiated");
                yield bridge.invoke("CloudExperienceHost.Telemetry.oobeHealthEvent", CloudExperienceHostAPI.HealthEvent.machineReseal, 0 /* Unused Result Parameter */);
            } catch (error) {
                yield this.runAsync(this.logFailureEventAsyncGen, autopilotTelemetryUtility.whiteGloveError.Shutdown, "shutdown error", error);
                this.displayError();
            }          
        }

        *displayResultsAsyncGen()
        {
            try {
                // Check for success value written by ESP when it successfully completes.
                let success = yield bridge.invoke("CloudExperienceHost.Storage.SharableData.getValue", this.whiteGloveSuccessValueName);
                this.displayResult(success);

                yield this.runAsync(this.displayCategoriesAsyncGen);
                yield this.runAsync(this.displayProvisioningTimeAsyncGen);
                yield this.runAsync(this.displayQRCodeAsyncGen);
            } catch (error) {
                // Swallow exception and show error on page.
                this.displayError();
            }
        }

        *displayCategoriesAsyncGen() {
            try {
                let organizationName = yield this.autoPilotManager.getStringPolicyAsync("CloudAssignedTenantDomain");
                if (organizationName !== "") {
                    this.organizationName(organizationName);
                }
    
                let profileName = yield this.autoPilotManager.getStringPolicyAsync("DeploymentProfileName");
                if (profileName !== "") {
                    this.profileName(profileName);
                } 
    
                let userName = yield this.autoPilotManager.getStringPolicyAsync("CloudAssignedTenantUpn");
                if (userName !== "") {
                    this.assignedUserName(userName);
                }
            } catch (error) {
                yield this.runAsync(this.logFailureEventAsyncGen, autopilotTelemetryUtility.whiteGloveError.Error, "error retrieving Autopilot policies.", error);
                throw error;
            }            
        }

        *displayQRCodeAsyncGen() {
            try {
                let qrData = yield this.autoPilotManager.getDeviceBlobForQRCodeAsync();
                yield bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "AutopilotWhiteGlove: QR code result", JSON.stringify({ data: qrData }));

                // If ZtdId was retrieved, display the QR code
                if (JSON.parse(qrData).ZtdId != "") {
                    let walletBarcode = new Windows.ApplicationModel.Wallet.WalletBarcode(Windows.ApplicationModel.Wallet.WalletBarcodeSymbology.qr, qrData);

                    let image = yield walletBarcode.getImageAsync();
                    if (image != null) {
                        let qrCode = document.getElementById("qrAssignmentCode");
                        let blob = yield image.openReadAsync();

                        let qrImageStream = MSApp.createStreamFromInputStream("image/bmp", blob);
                        qrCode.src = URL.createObjectURL(qrImageStream);
                    }
                } else {
                    // Else the device is not registered, so display error message and block next button
                    yield this.runAsync(this.logFailureEventAsyncGen, autopilotTelemetryUtility.whiteGloveError.Error, "Unable to get device ZtdId");
                }
            } catch (error) {
                // If device blob retrieval failed, display error message and block next button
                yield this.runAsync(this.logFailureEventAsyncGen, autopilotTelemetryUtility.whiteGloveError.Error, "QR blob generation error", error);
                throw error;
            }
        }

        *displayProvisioningTimeAsyncGen() {
            try {
                let startTime = yield bridge.invoke("CloudExperienceHost.Storage.SharableData.getValue", this.whiteGloveStartTimeValueName);
                let whiteGloveEndTime = Date.now();
                let milliseconds = whiteGloveEndTime - startTime;
                let hours = Math.floor(milliseconds / this.msPerHour);
                let minutes = Math.floor((milliseconds - (hours * this.msPerHour)) / this.msPerMinute);

                this.elapsedTimeNumber(resourceStrings.WhiteGloveTimeText
                    .replace("{0}", hours)
                    .replace("{1}", minutes));
            } catch (error) {
                yield this.runAsync(this.logFailureEventAsyncGen, autopilotTelemetryUtility.whiteGloveError.Error, "error retrieving start time", error);
                throw error;
            }
        }
        
        displayError() {
            this.provisioningTextStyle("error");
            this.subHeaderText(resourceStrings.WhiteGloveQRCodeError);
        }

        displayResult(result) {
            if (result === "Success") {
                this.resultBackground("success-background");
                this.showResultFooter("success-footer");
                this.subHeaderText(this.resourceStrings.WhiteGloveCompletedText);
                this.hyperlinkVisibility(0);
                autopilotTelemetryUtility.logger.logError(autopilotTelemetryUtility.whiteGloveInformational.Success, "AutopilotWhiteGlove: showing success page because AutopilotWhiteGloveSuccess was marked as success.");

            } else {
                this.resultBackground("failure-background");
                this.showResultFooter("failure-footer");
                this.hyperlinkVisibility(1);
                this.isRetryButtonDisabled(!this.isRetriableError(result));
                this.subHeaderText(this.resourceStrings.WhiteGloveFailureText);
                if (result !== null) {
                    this.subHeaderErrorText(result);
                    autopilotTelemetryUtility.logger.logError(autopilotTelemetryUtility.whiteGloveError.Error, "AutopilotWhiteGLove: showing failure page because AutopilotWhiteGloveSuccess was marked as an error.");
                }
            }
        }

        // By default assume all errors are re-triable 
        isRetriableError(result) {
            return true;
        }

        *logFailureEventAsyncGen(area, failureName, e) {
            yield autopilotTelemetryUtility.logger.logError(area, failureName + " " + JSON.stringify({ number: e && e.number.toString(16), stack: e && e.asyncOpSource && e.asyncOpSource.stack }));

            if (typeof e !== "undefined") {
                yield autopilotTelemetryUtility.logger.logErrorCode(area, e.number);
            }
        }        
        
        runAsync(makeGenerator) {
            let generatorArgs = [].slice.call(arguments, 1);
            return function () {
                let generator = makeGenerator.apply(this, arguments);

                function iterateGenerator(result) {
                    // every yield returns: result => { done: [Boolean], value: [Object] }
                    if (result.done) {
                        return Promise.resolve(result.value);
                    }

                    return Promise.resolve(result.value).then(function (result) {
                        return iterateGenerator(generator.next(result));
                    }, function (error) {
                        return iterateGenerator(generator.throw(error));
                    });
                }

                try {
                    return iterateGenerator(generator.next());
                } catch (error) {
                    return Promise.reject(error);
                }
            }.apply(this, generatorArgs);
        }         
    }
    return WhiteGloveResultViewModel;
});
