//
// Copyright (C) Microsoft. All rights reserved.
//

"use strict";

define(['legacy/bridge'], (bridge) => {
    class bootstrapSessionGeneralUtilities {
        constructor(isInOobe) {
            // Constants
            this.HRESULT_TIMEOUT = 0x800705B4;
            this.SUBCATEGORY_DISPOSITION_VISIBLE = "visible";
            this.SUBCATEGORY_DISPOSITION_SILENT = "silent";
            this.SUBCATEGORY_DISPOSITION_IGNORED = "ignored";
            this.CATEGORY_DISPOSITION_VISIBLE = "visible";
            this.CATEGORY_DISPOSITION_IGNORED = "ignored";

            this.SUBCATEGORY_STATE_NOT_STARTED = "notStarted";
            this.SUBCATEGORY_STATE_IN_PROGRESS = "inProgress";
            this.SUBCATEGORY_STATE_SUCCEEDED = "succeeded";
            this.SUBCATEGORY_STATE_FAILED = "failed";
            this.SUBCATEGORY_STATE_CANCELLED = "cancelled";
            this.SUBCATEGORY_STATE_FAILED_FROM_PREVIOUS_SUBCATEGORY = "failedFromPreviousSubcategory";
            this.SUBCATEGORY_STATE_REBOOT_REQUIRED_AND_TRY_AGAIN = "rebootRequiredAndTryAgain";

            this.CATEGORY_STATE_NOT_STARTED = "notStarted";
            this.CATEGORY_STATE_IN_PROGRESS = "inProgress";
            this.CATEGORY_STATE_SUCCEEDED = "succeeded";
            this.CATEGORY_STATE_FAILED = "failed";
            this.CATEGORY_STATE_CANCELLED = "cancelled";
            this.CATEGORY_STATE_FAILED_FROM_PREVIOUS_CATEGORY = "failedFromPreviousCategory";
            this.CATEGORY_STATE_REBOOT_REQUIRED_AND_TRY_AGAIN = "rebootRequiredAndTryAgain";

            this.CLICKABLE_ITEM_ID_CONTINUE_ANYWAY_BUTTON = "continueAnywayButton";

            this.CLICKABLE_ITEM_ID_VIEW_DIAGNOSTICS_BUTTON = "viewDiagnosticsButton";
            this.CLICKABLE_ITEM_ID_TRY_AGAIN_BUTTON = "tryAgainButton";
            this.CLICKABLE_ITEM_ID_RESET_BUTTON = "resetButton";
            this.CLICKABLE_ITEM_ID_COLLECT_LOGS_BUTTON = "collectLogsButton";
            this.CLICKABLE_ITEM_ID_SIGN_OUT_BUTTON = "signOutButton";

            // Persistent state names
            this.STATE_NAME_GLOBAL_RUN_PROVISIONING = "Global.RunProvisioning";
            this.STATE_NAME_GLOBAL_RESTORE_MDM_TASKS = "Global.RestoreMdmTasks";
            this.STATE_NAME_GLOBAL_SHOULD_WAIT_FOR_DEBUGGER_ATTACH = "Global.ShouldWaitForDebuggerAttach";

            // Transient state names
            this.STATE_NAME_GLOBAL_ERROR_BUTTONS_VISIBILITY = "Global.ErrorVisibility";
            this.STATE_NAME_GLOBAL_SHOW_COLLECT_LOGS_BUTTON = "Global.ShowCollectLogsButton";
            this.STATE_NAME_GLOBAL_MDM_PROGRESS_MODE = "Global.MdmProgressMode";
            this.STATE_NAME_GLOBAL_SHOW_CONTINUE_ANYWAY_BUTTON = "Global.ShowContinueAnywayButton";
            this.STATE_NAME_GLOBAL_MDM_ENROLLMENT_STATUS = "Global.MDMEnrollmentStatus";

            // White glove constants
            this.WHITE_GLOVE_END_TIME_VALUE = "AutopilotWhiteGloveEndTime";
            this.WHITE_GLOVE_RESULT_NAME = "AutopilotWhiteGloveSuccess";
            this.WHITE_GLOVE_RESULT_VALUE_SUCCESS = "Success";
            this.WHITE_GLOVE_ERROR_USER_MESSAGE = "AutopilotWhiteGloveError";

            // MDM progress mode enumerations; values must match those for MDMProgressMode in EnterpriseDeviceManagement.idl
            this.MDM_PROGRESS_MODE_DEVICE = 0;
            this.MDM_PROGRESS_MODE_USER = 1;
            this.MDM_PROGRESS_MODE_DEVICE_AND_USER = 2;

            // MDM Enrollment Disposition enumerations
            this.MDM_ENROLLMENT_DISPOSITION = {
                0 : "Unknown",
                1 : "Initial",
                2 : "AadConfigure",
                3 : "AadJoin",
                4 : "AadDeviceDiscovery",
                5 : "AadTicket",
                6 : "MdmEnrolling",
                7 : "Completed",
                8 : "LastKnown",
            };

            // Public properties
            this.enrollmentApis = new EnterpriseDeviceManagement.Enrollment.ReflectedEnroller();
            this.autopilotSubscriptionManager = new EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotWnfSubscriptionManager();
            this.tpmNotificationManager = new ModernDeployment.Autopilot.Core.TpmNotification();
            this.autopilotApis = new EnterpriseDeviceManagement.Service.AutoPilot.AutoPilotServer();
            this.surfaceHubHelper = new ModernDeployment.Autopilot.Core.AutopilotSurfaceHubHelper();
            this.provisioningPluginManager = new CloudExperienceHostAPI.Provisioning.PluginManager();
            this.espTrackingUtility = new EnterpriseDeviceManagement.Service.AutoPilot.EnrollmentStatusTrackingUtil();
            this.deviceManagementUtilities = new ModernDeployment.Autopilot.Core.DeviceManagementUtilities();
            this.hybridUtilities = new ModernDeployment.Autopilot.Core.AutopilotHybridJoin();

            // Private member variables
            this.isInOobe = isInOobe;
            this.transientStateStore = {};
        }

        // Public methods
        
        showElement(element, collapsible) {
            if (collapsible) {
                element.style.display = "inline";
            } else {
                element.style.visibility = "visible";
            }
        }

        hideElement(element, collapsible) {
            if (collapsible) {
                element.style.display = "none";
            } else {
                element.style.visibility = "hidden";
            }
        }

        isElementHidden(element) {
            return ((element.style.display === "none") || (element.style.visibility === "hidden"));
        }

        clearChildDomNodes(parentDomNode) {
            while (parentDomNode.hasChildNodes()) {
                parentDomNode.removeChild(parentDomNode.childNodes[0]);
            }
        }

        formatMessage(messageToFormat) {
            var args = Array.prototype.slice.call(arguments, 1);
            return messageToFormat.replace(/{(\d+)}/g, (match, number) => {
                return typeof args[number] !== 'undefined'
                    ? args[number]
                    : match
                    ;
            });
        }

        formatNumberAsHexString(numberToConvert, maxHexCharacters) {
            let stringToReturn = "";

            for (var i = 0; i < maxHexCharacters; i++) {
                let digitValue = 0xF & (numberToConvert >> (i * 4));
                stringToReturn = digitValue.toString(16) + stringToReturn;
            }

            return "0x" + stringToReturn;
        }

        replaceNodeText(node, newText) {
            this.clearChildDomNodes(node);
            node.appendChild(document.createTextNode(newText));
        }

        logInfoEvent() {
            let message = this.formatMessage.apply(this, arguments);

            bridge.invoke(
                "CloudExperienceHost.Telemetry.logEvent",
                message);
        }

        logWarningEvent() {
            let message = this.formatMessage.apply(this, arguments);

            bridge.invoke(
                "CloudExperienceHost.Telemetry.logEvent",
                message);
        }

        logErrorEvent(errorMessage, errorObject) {
            bridge.invoke(
                "CloudExperienceHost.Telemetry.logEvent",
                errorMessage,
                JSON.stringify({
                    number: errorObject && errorObject.number.toString(16),
                    stack: errorObject && errorObject.asyncOpSource && errorObject.asyncOpSource.stack
                }));
        }

        runningInOobe() {
            return this.isInOobe;
        }

        getSettingAsync(stateName) {
            return this.autopilotApis.getSettingAsync(stateName);
        }

        storeSettingAsync(stateName, stateValue) {
            let storeSettingAction = null;

            try {
                storeSettingAction = this.autopilotApis.storeSettingAsync(stateName, stateValue);
            } catch (e) {
                storeSettingAction = null;
            }

            return storeSettingAction;
        }
        
        getTransientState(stateName) {
            return this.transientStateStore[stateName];
        }

        storeTransientState(stateName, stateValue) {
            this.transientStateStore[stateName] = stateValue;
        }

        // Note:  The statusMessageToUse parameter is displayed to the user, and so the caller should keep localization in mind.
        createActionResult(actionResultStateToUse, statusMessageToUse) {
            return {
                actionResultState: actionResultStateToUse,
                statusMessage: statusMessageToUse
            };
        }

        categorySucceeded(categoryState) {
            return (categoryState === this.CATEGORY_STATE_SUCCEEDED);
        }

        subcategorySucceeded(subcategoryState) {
            return (subcategoryState === this.SUBCATEGORY_STATE_SUCCEEDED);
        }
    }

    return bootstrapSessionGeneralUtilities;
});
