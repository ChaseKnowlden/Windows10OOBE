// Copyright (C) Microsoft. All rights reserved.

define(() => {
    class OobeAntiTheftEnable {
        EnableAntiTheft() {
                /* Currently Not Implemented Due to issues with getting an RPS Ticket - noop for RS5 */
                return WinJS.Promise.as(CloudExperienceHost.AppResult.success);
        }

        launchAsync() {
            return EnableAntiTheft()
        }
    }
    return OobeAntiTheftEnable;
});