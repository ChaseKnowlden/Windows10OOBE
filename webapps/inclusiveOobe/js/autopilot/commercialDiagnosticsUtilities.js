﻿//
// Copyright (C) Microsoft. All rights reserved.
//

define(['legacy/bridge'], (bridge) => {
    class commercialDiagnosticsUtilities {
        constructor() {
            // Error Codes
            this.timeoutErrorCode = 0x800705B4; // ERROR_TIMEOUT
            this.unexpectedErrorCode = 0x8000FFFF; // E_UNEXPECTED
            this.noInternetErrorCode = 0x800C0003;
            this.notSupportedErrorCode = 0x80004021;
            this.parameterNotFoundErrorCode = 0x80020004;

            this.DETECT_RUNNING_ON_HUB_SETTING = "IsRunningOnHub";
            this.EXPORT_LOGS_REMOVABLE_DRIVE_SETTING = "ESP.AutomaticallyExportLogsToRemovableDrive";
            this.FEATURE_AUTOPILOTSURFACEHUB22H2 = "AutopilotSurfaceHub22H2";
        }

        logInfoEventWithMetadata(eventName, eventMessage, eventMetadata) {
            bridge.invoke("CloudExperienceHost.AutoPilot.internalLogEvent", eventName, null, eventMessage, eventMetadata);
        }

        // This is the Commercial OOBE Info-level logging function
        logInfoEvent(eventName, eventMessage) {
            this.logInfoEventWithMetadata(eventName, eventMessage, null);
        }

        logInfoEventName(eventName) {
            this.logInfoEvent(eventName, "");
        }

        logHresultEvent(eventName, eventMessage, hresult) {
            bridge.invoke("CloudExperienceHost.AutoPilot.internalLogEvent", eventName, hresult, eventMessage, null);
        }

        logExceptionEventWithMetadata(eventName, exception, eventMessage, eventMetadata) {
            if ((eventMetadata === null) || (eventMetadata === undefined) || (typeof(eventMetadata) !== "object")) {
                eventMetadata = {};
            }
            
            eventMetadata["stack"] = (exception && exception.asyncOpSource && exception.asyncOpSource.stack) ? exception.asyncOpSource.stack : "";

            bridge.invoke("CloudExperienceHost.AutoPilot.internalLogEvent", eventName, exception.number, eventMessage, eventMetadata);
        }

        logExceptionEvent(eventName, eventMessage, exception) {
            this.logExceptionEventWithMetadata(eventName, exception, eventMessage, null);
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

        logInfoEventDeprecated() {
            let message = this.formatMessage.apply(this, arguments);

            bridge.invoke("CloudExperienceHost.Telemetry.logEvent", message);
        }

        logErrorEventDeprecated(errorMessage, errorObject) {
            bridge.invoke(
                "CloudExperienceHost.Telemetry.logEvent",
                errorMessage,
                JSON.stringify({
                    number: errorObject && errorObject.number.toString(16),
                    stack: errorObject && errorObject.asyncOpSource && errorObject.asyncOpSource.stack
                }));
        }

        formatNumberAsHexString(numberToConvert, maxHexCharacters) {
            let stringToReturn = "";

            for (var i = 0; i < maxHexCharacters; i++) {
                let digitValue = 0xF & (numberToConvert >> (i * 4));
                stringToReturn = digitValue.toString(16) + stringToReturn;
            }

            return "0x" + stringToReturn;
        }

        getExportLogsFolderPathAsync() {
            this.logInfoEvent("CommercialOOBE_CommercialDiagnosticsUtilities_GetExportLogsFolderPathAsync", "Started");
            return bridge.invoke("CloudExperienceHost.AutoPilot.getStringSettingAsync", this.DETECT_RUNNING_ON_HUB_SETTING).then((isHub) => {
                this.logInfoEventWithMetadata("CommercialOOBE_CommercialDiagnosticsUtilities_GetExportLogsFolderPathAsync", "isHub: ", isHub);
                if (isHub === "True") {
                    return bridge.invoke("CloudExperienceHost.AutoPilot.getStringSettingAsync", this.EXPORT_LOGS_REMOVABLE_DRIVE_SETTING).then((folderPath) => {
                        this.logInfoEvent(
                            "CommercialOOBE_CommercialDiagnosticsUtilities_GetExportLogsFolderPathAsync",
                            this.formatMessage("Returned folder path: ", folderPath));
                        return folderPath;
                    });
                } else {
                    return bridge.invoke("CloudExperienceHost.showFolderPicker").then((folderPath) => {
                        this.logInfoEvent(
                            "CommercialOOBE_CommercialDiagnosticsUtilities_GetExportLogsFolderPathAsync",
                            this.formatMessage("Selected folder path: ", folderPath));
                        return folderPath;
                    });                    
                }
            });
        }
    }

    return commercialDiagnosticsUtilities;
});