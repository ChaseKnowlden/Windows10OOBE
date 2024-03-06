//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout', 'legacy/bridge', 'legacy/events'], (ko, bridge, constants) => {
    function stringFromEnum(enumType, enumValue) {
        return Object.keys(enumType).find((key) => enumType[key] == enumValue);
    }
    
    const cxhSpeech = CloudExperienceHostAPI.Speech;
    const winSpeech = Windows.Media.SpeechRecognition;
    const skipConstraintTag = "skip";
    const retryConstraintTag = "retry";

    class DevicePairingViewModel {
        constructor(element, resourceStrings, accessories, accessoryImageUrls) {
            this.element = element;
            this.resourceStrings = resourceStrings;
            this.accessories = accessories;
            this.accessoryImageUrls = accessoryImageUrls;
            this.PairingStatusEnum = CloudExperienceHostAPI.OobeDevicePairingStatus;
            this.pairingStatus = ko.observable(this.PairingStatusEnum.unknown);
            this.pairingStatusChangedListener = this._onPairingStatusChanged.bind(this);
            this.statusText = ko.observable("");

            this.processingFlag = ko.observable(false);
            this.disableControl = ko.pureComputed(() => {
                return this.processingFlag();
            });

            this.isPairing = ko.pureComputed(() => {
                let status = this.pairingStatus();
                return (status != this.PairingStatusEnum.succeeded) && (status != this.PairingStatusEnum.failed);
            });

            this.isPairing.subscribe(this._onIsPairingChanged.bind(this));

            this.isWorking = ko.pureComputed(() => {
                return (this.pairingStatus() == this.PairingStatusEnum.discovering) ||
                       (this.pairingStatus() == this.PairingStatusEnum.pairing) ||
                       (this.pairingStatus() == this.PairingStatusEnum.installing);
            });
            
            this.statusText = ko.pureComputed(() => {
                let statusName = stringFromEnum(this.PairingStatusEnum, this.pairingStatus());
                return this.resourceStrings["StatusText-" + statusName] || "";
            });
            
            this.currentAccessoryIndex = ko.observable(0);
            this.currentAccessory = ko.pureComputed(() => {
                return this.accessories[this.currentAccessoryIndex()];
            });
             
            this.currentAccessoryImages = ko.pureComputed(() => {
                return this.accessoryImageUrls[this.currentAccessoryIndex()];
            });

            // Note this will not fire for the first accessory, but we fire it manually in onPageLoaded.
            this.currentAccessory.subscribe(this._onCurrentAccessoryChanged.bind(this));

            this.currentAccessoryIndex.subscribe((newAccessoryIndex) => {
                this.processingFlag(false);
            });
        }

        onSkipClicked() {
            if (!this.processingFlag()) {
                this.processingFlag(true);

                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "SkipUserOobeDevicePairing");
                this._nextOrDone();
            }
        }

        onRetryClicked() {
            if (!this.processingFlag()) {
                this.processingFlag(true);

                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "RetryUserOobeDevicePairing");
                this._beginPairingAccessory();
            }
        }

        onNextClicked() {
            if (!this.processingFlag()) {
                this.processingFlag(true);

                this._nextOrDone();
            }
        }

        _nextOrDone() {
            let nextAccessoryIndex = this.currentAccessoryIndex() + 1;
            if (nextAccessoryIndex < this.accessories.length) {
                this._disconnectAccessoryListener();
                this.currentAccessoryIndex(nextAccessoryIndex);
            }
            else {
                if (this.pairingStatus() == this.PairingStatusEnum.succeeded) {
                    bridge.fireEvent(constants.Events.done, constants.AppResult.success);
                }
                else if (this.pairingStatus() == this.PairingStatusEnum.failed) {
                    bridge.fireEvent(constants.Events.done, constants.AppResult.failed);
                }
                else {
                    bridge.fireEvent(constants.Events.done, constants.AppResult.cancel);
                }
            }
        }

        _disconnectAccessoryListener() {
            if (this.currentAccessory()) {
                this.currentAccessory().removeEventListener("statuschanged", this.pairingStatusChangedListener);
            }
        }

        _onCurrentAccessoryChanged(accessory) {
            this.processingFlag(false);
            accessory.addEventListener("statuschanged", this.pairingStatusChangedListener);
            this._beginPairingAccessory();
        }

        _onPairingStatusChanged(e) {
            this.processingFlag(false);
            this.pairingStatus(e.target.status);
        }

        _onIsPairingChanged(isPairing) {
            this.processingFlag(false);

            // When this fires, the view is changing the content and buttons, so this is almost a good time to update focus
            // (but we need to defer slightly until the querySelector is operating over the incoming footer elements).
            setImmediate(() => {
                let focusElement = this.element.querySelector("[autofocus='true']");
                if (focusElement) {
                    focusElement.focus();
                }
            });

            cxhSpeech.SpeechRecognition.stop();
            if (this.pairingStatus() == this.PairingStatusEnum.failed) {
                this._promptOnErrorPage();
            }
        }

        onPageLoaded() {
            // Kick off pairing of the first accessory
            this._onCurrentAccessoryChanged(this.currentAccessory());
        }

        _promptOnErrorPage() {
            let skipConstraint = new winSpeech.SpeechRecognitionListConstraint([this.resourceStrings.DevicePairSkip1SpeechConstraint, this.resourceStrings.DevicePairSkip2SpeechConstraint]);
            skipConstraint.tag = skipConstraintTag;
            
            let retryConstraint = new winSpeech.SpeechRecognitionListConstraint([this.resourceStrings.DevicePairRetry1SpeechConstraint, this.resourceStrings.DevicePairRetry2SpeechConstraint]);
            retryConstraint.tag = retryConstraintTag;

            cxhSpeech.SpeechRecognition.promptForCommandsAsync(this.resourceStrings.ErrorPageVoiceOver, [skipConstraint, retryConstraint]).done((result) => {
                if (result && !this.processingFlag()) {
                    if (result.constraint.tag == skipConstraintTag) {
                        bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "SkipUserOobeDevicePairing");
                        this.processingFlag(true);
                        this._nextOrDone();
                    }
                    else if (result.constraint.tag == retryConstraintTag) {
                        bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "RetryUserOobeDevicePairing");
                        this.processingFlag(true);
                        this._beginPairingAccessory();
                    }
                }
            });
        }

        _startPairing() {
            // I saw an "object disconnected" error here while debugging.
            // Probably just due to debugging RuntimeBroker,
            // but handling just in case as it left the app stuck saying it was searching when it wasn't.
            try {
                this.currentAccessory().startPairing();
            }
            catch (ex) {
                this.processingFlag(false);

                this.pairingStatus(this.PairingStatusEnum.failed);
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "UnexpectedErrorStartDevicePairing");
            }
        }

        _beginPairingAccessory() {
            this.pairingStatus(this.PairingStatusEnum.discovering);

            cxhSpeech.SpeechRecognition.stop();
            let speechPromise = cxhSpeech.SpeechSynthesis.speakAsync(this.resourceStrings.InstructionPageVoiceOver);
            // Give the user a few seconds to see the page before we start actually pairing
            // This also ensures we have time to read the above string before potentially navigating to the error page
            // And makes it clear that the retry button is doing something even if the retry actually fails immediately
            WinJS.Promise.join([speechPromise, WinJS.Promise.timeout(3000)]).done(() => {
                this._startPairing();
            }, () => {
                this._startPairing();
            });
        }
    }
    return DevicePairingViewModel;
});