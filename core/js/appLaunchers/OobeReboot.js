//
// Copyright (C) Microsoft. All rights reserved.
//

define(() => {
    class OOBEReboot {
        launchAsync(currentNode) {
            return new WinJS.Promise(function (completeDispatch /*, errorDispatch, progressDispatch */) {
                let shouldReboot = CloudExperienceHost.Storage.SharableData.getValue("shouldRebootForOOBE");
                if (shouldReboot) {
                    CloudExperienceHost.Storage.SharableData.addValue("OOBEResumeEnabled", true);
                    let resumeCXHId = CloudExperienceHost.Storage.SharableData.getValue("resumeCXHId");
                    // Default to resume from the next node of the reboot node
                    if (!resumeCXHId && currentNode.successID) {
                        CloudExperienceHost.Storage.SharableData.addValue("resumeCXHId", currentNode.successID);
                    }
                    CloudExperienceHost.Telemetry.oobeHealthEvent(CloudExperienceHostAPI.HealthEvent.expectedMachineNoErrorReboot, 0 /* Unused Result Parameter */);
                    CloudExperienceHostAPI.UtilStaticsCore.restartAsync().done(function () {}, function (err) { completeDispatch(CloudExperienceHost.AppResult.fail); });
                }
                else {
                    completeDispatch(CloudExperienceHost.AppResult.success);
                }
            });
        }
    }
    return OOBEReboot;
});