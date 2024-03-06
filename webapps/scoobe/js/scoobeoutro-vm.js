//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout', 'legacy/bridge', 'legacy/events', 'legacy/core'], (ko, bridge, constants, core) => {
    class ScoobeOutroViewModel {
        constructor(resourceStrings, hasInternetAccess) {
            this.resourceStrings = resourceStrings;

            this.title = resourceStrings.OutroTitle;
            this.subHeaderText = resourceStrings.OutroSubtitle;
            this.imageName = resourceStrings.OutroTitle;

            this.processingFlag = ko.observable(false); 
            this.flexEndButtons = [
                {
                    buttonText: resourceStrings.CloseButtonText,
                    buttonType: "button",
                    autoFocus: true,
                    disableControl: ko.pureComputed(() => {
                        return this.processingFlag();
                    }),
                    buttonClickHandler: () => {
                        this.onCloseClick();
                    }
                }
            ];
        }

        onCloseClick() {
            bridge.fireEvent(constants.Events.done, constants.AppResult.exitCxhSuccess);
        }
    }
    return { ScoobeOutroViewModel };
});
