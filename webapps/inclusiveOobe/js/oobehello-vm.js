//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout', 'legacy/bridge', 'legacy/events', 'legacy/core', 'jsCommon/knockout-helpers'], (ko, bridge, constants, core, KoHelpers) => {
    class HelloViewModel {
        constructor(resourceStrings, enrollmentKinds) {
            const cxhSpeech = CloudExperienceHostAPI.Speech;
            const winSpeech = Windows.Media.SpeechRecognition;

            this.resourceStrings = resourceStrings;
            this.enrollmentKinds = enrollmentKinds;
            this.processingFlag = ko.observable(false);
            this.contentContainerVisibility = ko.observable(true);

            this.isMultiChoice = (this.enrollmentKinds.face && this.enrollmentKinds.fingerprint);
            if (this.isMultiChoice) {
                this.title = resourceStrings.HelloTitleMulti;
                this.items = [
                    {
                        face: true,
                        fingerprint: false,
                        ariaLabel: resourceStrings.HelloFaceIconAriaLabel,
                        title: resourceStrings.HelloOptionTitleFace,
                        description: resourceStrings.HelloLeadTextFace
                    },
                    {
                        face: false,
                        fingerprint: true,
                        ariaLabel: resourceStrings.HelloFingerprintIconAriaLabel,
                        title: resourceStrings.HelloOptionTitleFingerprint,
                        description: resourceStrings.HelloOptionBodyFingerprint
                    }
                ];

                this.selectedItem = ko.observable(this.items[0]);
                this.selectedItem.subscribe((newSelectedItem) => {
                    if (this.selectedItem().title != newSelectedItem.title) {
                        if (newSelectedItem.face) {
                            bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentDisambiguationFaceSelected");
                        } else if (newSelectedItem.fingerprint) {
                            bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentDisambiguationFingerprintSelected");
                        }
                    }
                });
            } else {
                if (this.enrollmentKinds.face) {
                    const faceAnimation = document.getElementById("helloFaceAnimation");
                    faceAnimation.src = "/media/HelloFaceAnimation.gif";

                    this.ariaLabel = resourceStrings.HelloFaceAnimationAltText;
                    this.title = resourceStrings.HelloTitleFace;
                    this.leadText = resourceStrings.HelloLeadTextFace;
                } else if (this.enrollmentKinds.fingerprint) {
                    this.ariaLabel = resourceStrings.HelloFingerprintIconAriaLabel;
                    this.title = resourceStrings.HelloTitleFingerprint;
                    this.leadText = resourceStrings.HelloLeadTextFingerprint;
                }
            }

            this.flexStartHyperLinks = [
                {
                    hyperlinkText: resourceStrings.HelloSkipLink,
                    handler: () => {
                        this.onSkipClick();
                    }
                }
            ];

            this.flexEndButtons = [
                {
                    buttonText: resourceStrings.HelloButtonText,
                    buttonType: "button",
                    isPrimaryButton: true,
                    autoFocus: !this.isMultiChoice,
                    buttonClickHandler: (() => {
                        const enrollmentKind = {
                            face: ((this.isMultiChoice && this.selectedItem().face) || (!this.isMultiChoice && this.enrollmentKinds.face)),
                            fingerprint: ((this.isMultiChoice && this.selectedItem().fingerprint) || (!this.isMultiChoice && this.enrollmentKinds.fingerprint))
                        };
                        this.onSetUpClick(enrollmentKind);
                    }),
                    disableControl: ko.pureComputed(() => {
                        return this.processingFlag();
                    })
                }
            ];

            this.pageDefaultAction = () => {
                if (this.isMultiChoice) {
                    this.flexEndButtons[0].buttonClickHandler();
                }
            }

            // Setup simple voiceover and speech recognition using the resource strings
            try {
                cxhSpeech.SpeechRecognition.stop();
                let constraints = [];
                const constraintsTags = {
                    setUp: "setUp", // Enroll with current selection (applicable to single and multi sensor cases)
                    multiFace: "multiFace", // Enroll with face in a multi sensor case
                    multiFingerprint: "multiFingerprint", // Enroll with fingerprint in a multi sensor case
                    skip: "skip" // Skip Windows Hello enrollment
                };

                if (this.isMultiChoice) {
                    let multiFaceConstraint = new winSpeech.SpeechRecognitionListConstraint([this.resourceStrings.HelloMultiFace1SpeechConstraint, this.resourceStrings.HelloMultiFace2SpeechConstraint, this.resourceStrings.HelloMultiFace3SpeechConstraint, this.resourceStrings.HelloMultiFace4SpeechConstraint, this.resourceStrings.HelloMultiFace5SpeechConstraint, this.resourceStrings.HelloMultiFace6SpeechConstraint]);
                    multiFaceConstraint.tag = constraintsTags.multiFace;
                    let multiFingerprintConstraint = new winSpeech.SpeechRecognitionListConstraint([this.resourceStrings.HelloMultiFingerprint1SpeechConstraint, this.resourceStrings.HelloMultiFingerprint2SpeechConstraint, this.resourceStrings.HelloMultiFingerprint3SpeechConstraint, this.resourceStrings.HelloMultiFingerprint4SpeechConstraint, this.resourceStrings.HelloMultiFingerprint5SpeechConstraint, this.resourceStrings.HelloMultiFingerprint6SpeechConstraint, this.resourceStrings.HelloMultiFingerprint7SpeechConstraint]);
                    multiFingerprintConstraint.tag = constraintsTags.multiFingerprint;
                    constraints.push(multiFaceConstraint, multiFingerprintConstraint);
                } else {
                    // Yes and no variations only apply for single sensor case
                    constraints.push(cxhSpeech.SpeechRecognitionKnownCommands.yes, cxhSpeech.SpeechRecognitionKnownCommands.no);
                }

                let setUpConstraint = new winSpeech.SpeechRecognitionListConstraint([this.resourceStrings.HelloSetUpSpeechConstraint]);
                setUpConstraint.tag = constraintsTags.setUp;

                let skipConstraint = new winSpeech.SpeechRecognitionListConstraint([this.resourceStrings.HelloSkip1SpeechConstraint, this.resourceStrings.HelloSkip2SpeechConstraint]);
                skipConstraint.tag = constraintsTags.skip;

                constraints.push(cxhSpeech.SpeechRecognitionKnownCommands.next, setUpConstraint, skipConstraint);
                if (constraints && (constraints.length > 0)) {
                    let helloVoiceOver = null;
                    if (this.isMultiChoice) {
                        helloVoiceOver = this.resourceStrings.HelloMultiVoiceOver;
                    } else {
                        if (this.enrollmentKinds.face) {
                            helloVoiceOver = this.resourceStrings.HelloFaceVoiceOver;
                        } else if (this.enrollmentKinds.fingerprint) {
                            helloVoiceOver = this.resourceStrings.HelloFingerprintVoiceOver;
                        }
                    }

                    cxhSpeech.SpeechRecognition.promptForCommandsAsync(helloVoiceOver, constraints).done((result) => {
                        if (result && !this.processingFlag()) {
                            if ((result.constraint.tag == constraintsTags.skip) || (result.constraint.tag == cxhSpeech.SpeechRecognitionKnownCommands.no.tag)) {
                                this.onSkipClick();
                            } else {
                                let enrollmentKind = null;
                                if ((result.constraint.tag == constraintsTags.setUp) || (result.constraint.tag == cxhSpeech.SpeechRecognitionKnownCommands.yes.tag) || (result.constraint.tag == cxhSpeech.SpeechRecognitionKnownCommands.next.tag)) {
                                    enrollmentKind = {
                                        face: ((this.isMultiChoice && this.selectedItem().face) || (!this.isMultiChoice && this.enrollmentKinds.face)),
                                        fingerprint: ((this.isMultiChoice && this.selectedItem().fingerprint) || (!this.isMultiChoice && this.enrollmentKinds.fingerprint))
                                    };
                                } else if ((result.constraint.tag == constraintsTags.multiFace) || (result.constraint.tag == constraintsTags.multiFingerprint)) {
                                    enrollmentKind = {
                                        face: (result.constraint.tag == constraintsTags.multiFace),
                                        fingerprint: (result.constraint.tag == constraintsTags.multiFingerprint)
                                    };
                                }
                                if (enrollmentKind) {
                                    this.onSetUpClick(enrollmentKind);
                                }
                            }
                        }
                    });
                }
            }
            catch (err) {
            }
        }

        onSetUpClick(enrollmentKind) {
            if (!this.processingFlag()) {
                this.processingFlag(true);

                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentShowingEnrollmentApp");

                try {
                    const cxhSpeech = CloudExperienceHostAPI.Speech;
                    cxhSpeech.SpeechRecognition.stop();

                    let helloVoiceOver = null;
                    if (enrollmentKind.face) {
                        helloVoiceOver = this.resourceStrings.HelloFaceEnrollmentVoiceOver;
                    } else if (enrollmentKind.fingerprint) {
                        helloVoiceOver = this.resourceStrings.HelloFingerprintEnrollmentVoiceOver;
                    }

                    cxhSpeech.SpeechRecognition.promptForCommandsAsync(helloVoiceOver, null);
                }
                catch (err) {
                }

                bridge.invoke("CloudExperienceHost.getBoundingClientRect").done((result) => {
                    const rect = {
                        height: result.height,
                        width: result.width,
                        x: result.x * window.devicePixelRatio,
                        y: result.y * window.devicePixelRatio
                    };

                    // Hide the content of this page to avoid undesired flashing after bio enrollment app
                    // finishes and this page shows up a split second before navigating to next page
                    this.contentContainerVisibility(false);

                    bridge.invoke("CloudExperienceHost.Hello.startHelloEnrollment", enrollmentKind, rect).done((enrolledSuccessfully) => {
                        window.removeEventListener("resize", HelloViewModel._onResize);
                        if (enrolledSuccessfully) {
                            bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentSuccess");
                            bridge.fireEvent(constants.Events.done, constants.AppResult.success);
                        } else {
                            bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentCanceled");
                            bridge.invoke("CloudExperienceHost.undimChrome");

                            this.processingFlag(false);
                            // Show the content of this page if enrollment app cancels
                            this.contentContainerVisibility(true);
                            // Restore focus to the default focusable element as the flow is returning to this page
                            KoHelpers.setFocusOnAutofocusElement();
                        }
                    }, (error) => {
                        window.removeEventListener("resize", HelloViewModel._onResize);
                        bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentFailed", core.GetJsonFromError(error));
                        bridge.fireEvent(constants.Events.done, constants.AppResult.fail);
                    });

                    window.addEventListener("resize", HelloViewModel._onResize);
                    bridge.invoke("CloudExperienceHost.dimChrome");
                }, (error) => {
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentSizingFailed", core.GetJsonFromError(error));
                    bridge.fireEvent(constants.Events.done, constants.AppResult.fail);
                });
            }
        }

        onSkipClick() {
            if (!this.processingFlag()) {
                this.processingFlag(true);
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentCanceled");
                bridge.fireEvent(constants.Events.done, constants.AppResult.cancel);
            }
        }

        static _onResize(param) {
            bridge.invoke("CloudExperienceHost.getBoundingClientRect").done((result) => {
                try {
                    const rect = {
                        height: result.height,
                        width: result.width,
                        x: result.x * window.devicePixelRatio,
                        y: result.y * window.devicePixelRatio
                    };

                    bridge.invoke("CloudExperienceHost.Hello.updateWindowLocation", rect);
                }
                catch (error) {
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentResizingFailed", core.GetJsonFromError(error));
                }
            });
        }
    }
    return HelloViewModel;
});
