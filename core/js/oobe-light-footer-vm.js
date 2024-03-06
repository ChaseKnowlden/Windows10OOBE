//
// Copyright (C) Microsoft. All rights reserved.
//


define(['lib/knockout', 'legacy/bridge', 'legacy/events', 'legacy/core', 'legacy/uiHelpers'], (ko, bridge, constants, core, legacy_uiHelpers) => {
    class LightOOBEFooterViewModel {
        constructor(params) {
            this.showEOAButton = ko.observable(true);
            this.showVolumeControlButton = ko.observable(true);

            let resourceStrings = window.resourceStrings;
            document.title = resourceStrings.ControlBarAccName;
            this.easeOfAccessAccName = ko.observable(resourceStrings.EaseOfAccessAccName);
            this.volumeControlAccName = ko.observable(resourceStrings.VolumeControlAccName);
        }

        onVolumeControl(data, event) {
            // https://microsoft.visualstudio.com/OS/_workitems/edit/20742115
        }

        onEOAButton(data, event) {
            // https://microsoft.visualstudio.com/OS/_workitems/edit/20742103
        }
    }
    return LightOOBEFooterViewModel;
});


