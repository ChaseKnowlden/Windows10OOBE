//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout', 'legacy/bridge', 'legacy/events', 'legacy/core', 'jsCommon/knockout-helpers'], (ko, bridge, constants, core, KoHelpers) => {
    class LocalNGCViewModel {
        constructor(resourceStrings) {
            this.resourceStrings = resourceStrings;
            this.processingFlag = ko.observable(false);
            this.title = resourceStrings.LocalNGCTitle;
            this.leadText = resourceStrings.LocalNGCLeadText;
            this.ariaLabel = resourceStrings.LocalNGCIconAriaLabel;

            this.flexEndButtons = [
                {
                    buttonText: resourceStrings.LocalNGCButtonText,
                    buttonType: "button",
                    isPrimaryButton: true,
                    autoFocus: true,
                    buttonClickHandler: (() => {
                        this._createLocalPin();
                    }),
                    disableControl: ko.pureComputed(() => {
                        return this.processingFlag();
                    })
                }
            ];

            // Setup simple voiceover and speech recognition using the resource strings
            try {
                CloudExperienceHostAPI.Speech.SpeechRecognition.stop();
                let localNGCConstraint = new Windows.Media.SpeechRecognition.SpeechRecognitionListConstraint([this.resourceStrings.LocalNGC1SpeechConstraint, this.resourceStrings.LocalNGC2SpeechConstraint]);
                localNGCConstraint.tag = "localNGC";
                let constraints = [CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.next, localNGCConstraint];
                if (constraints && (constraints.length > 0)) {
                    CloudExperienceHostAPI.Speech.SpeechRecognition.promptForCommandsAsync(this.resourceStrings.LocalNGCVoiceOver, constraints).done((result) => {
                        if (result && !this.processingFlag()) {
                            if ((result.constraint.tag == CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.next.tag) || (result.constraint.tag == "localNGC")) {
                                this._createLocalPin();
                            }
                        }
                    });
                }
            }
            catch (err) {
            }
        }

        _createLocalPin() {
            if (!this.processingFlag()) {
                this.processingFlag(true);

                // Show the progress ring while committing async.
                bridge.fireEvent(CloudExperienceHost.Events.showProgressWhenPageIsBusy);

                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "LocalNgcNextButtonClick");

                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "LocalNgcEnrollStart");
                bridge.invoke("CloudExperienceHost.LocalNgc.createLocalPinAsync").done(() => {
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "LocalNgcEnrolled");
                    bridge.fireEvent(constants.Events.done, constants.AppResult.success);
                }, (e) => {
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "LocalNgcFailure", core.GetJsonFromError(e));

                    this.processingFlag(false);
                    // Fire event to hide progress ring on failure
                    bridge.fireEvent(constants.Events.visible, true);

                    // Restore focus to the default focusable element as the flow is returning to this page
                    KoHelpers.setFocusOnAutofocusElement();
                });
            }
        }
    }
    return LocalNGCViewModel;
});