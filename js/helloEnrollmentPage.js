//
// Copyright (C) Microsoft. All rights reserved.
//
/// <disable>JS2085.EnableStrictMode</disable>
"use strict";
var CloudExperienceHost;
(function (CloudExperienceHost) {
    var Hello;
    (function (Hello) {
        var helloResources = {};
        var bridge = new CloudExperienceHost.Bridge();
        var enrollmentKinds;
        var faceDisambiguationChoice = { title: "", description: "", glyph: "\uEB68" };
        var fingerDisambiguationChoice = { title: "", description: "", glyph: "\uE928" };
        var disambiguationArray = [faceDisambiguationChoice, fingerDisambiguationChoice];
        Hello.enrollmentList = new WinJS.Binding.List(disambiguationArray);
        WinJS.UI.Pages.define("/views/helloEnrollment.html", {
            init: function (element, options) {
                var pagePromise = new WinJS.Promise(function (completeDispatch, errorDispatch) {
                    function _checkIfEnrollmentSupportedAndGetReady(completeDispatch, errorDispatch) {
                        bridge.invoke("CloudExperienceHost.Hello.getSupportedHelloEnrollmentKinds").then(function (kinds) {
                            enrollmentKinds = JSON.parse(kinds);
                            if (enrollmentKinds && (enrollmentKinds.face || enrollmentKinds.fingerprint)) {
                                var languagePromise = bridge.invoke("CloudExperienceHost.Globalization.Language.getPreferredLang").then(function (preferredLang) {
                                    _htmlRoot.setAttribute("lang", preferredLang);
                                }, function () { });
                                var dirPromise = bridge.invoke("CloudExperienceHost.Globalization.Language.getReadingDirection").then(function (dirVal) {
                                    _htmlRoot.setAttribute("dir", dirVal);
                                }, function () { });
                                var stringPromise = bridge.invoke("CloudExperienceHost.Hello.localizedStrings").then(function (result) {
                                    helloResources = JSON.parse(result);
                                });
                                WinJS.Promise.join({ languagePromise: languagePromise, dirPromise: dirPromise, stringPromise: stringPromise }).then(completeDispatch, errorDispatch);
                            } else {
                                completeDispatch();
                            }
                        }, function (e) {
                            errorDispatch(e);
                        });
                    }
                    function _checkIfNthSkipCondition(completeDispatch, errorDispatch) {
                        bridge.invoke("CloudExperienceHost.UnifiedEnroll.checkIfPinPromptScenario").then(function (result) {
                            if (result) {
                                _checkIfEnrollmentSupportedAndGetReady(completeDispatch, errorDispatch);
                            } else {
                                // This should only fire in the NTHENTORMDM or NTHAADORMDM flows, else the app will "Fall Off" and quit.
                                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentSkipInNthFlow");
                                bridge.fireEvent(CloudExperienceHost.Events.done, CloudExperienceHost.AppResult.action1);
                            }
                        }, function (e) {
                            _checkIfEnrollmentSupportedAndGetReady(completeDispatch, errorDispatch);
                        });
                    }
                    // Check to see if a previous component would like us to be skipped
                    bridge.invoke("CloudExperienceHost.Storage.SharableData.getValue", "skipNGC").then(function (skipNGC) {
                        if (skipNGC) {
                            _logEvent("HelloEnrollmentSkippedViaSharableData");
                            completeDispatch();
                        }
                        else {
                            _checkIfNthSkipCondition(completeDispatch, errorDispatch);
                        }
                    }, function (e) {
                        _checkIfNthSkipCondition(completeDispatch, errorDispatch);
                    });
                });
                var cssPromise = uiHelpers.LoadCssPromise(document.head, "..", bridge);
                return WinJS.Promise.join({ pagePromise: pagePromise, cssPromise: cssPromise });
            },
            ready: function (element, options) {
                // Skip link
                SkipLink.textContent = helloResources["Hello" + SkipLink.id];
                SkipLink.addEventListener("click", function (event) {
                    event.preventDefault();
                    _logEvent("HelloEnrollmentCanceled");
                    bridge.fireEvent(CloudExperienceHost.Events.done, CloudExperienceHost.AppResult.cancel);
                });

                // Call to register EaseOfAccess control
                uiHelpers.RegisterEaseOfAccess(easeOfAccess, bridge);

                // Elements based on supported hardware
                if (enrollmentKinds && (enrollmentKinds.face || enrollmentKinds.fingerprint)) {
                    // Next button
                    NextButton.textContent = helloResources["HelloButtonText"];
                    NextButton.addEventListener("click", function () {
                        event.preventDefault();
                        NextButton.disabled = true; // prevent double click
                        _enroll();
                    }.bind(this));
                    NextButton.focus();

                    if (enrollmentKinds.face && enrollmentKinds.fingerprint) {
                        _logEvent("ShowingHelloEnrollmentPage", "Face AND Fingerprint");

                        // Remove the non-applicable elements
                        _setVisibility(FaceOrFingerprint, false);

                        // Set the ListView properties
                        let rootStyle = window.getComputedStyle(_htmlRoot, "");
                        let rootBackgroundColor = rootStyle.getPropertyValue("background-color");
                        EnrollmentChoiceItemTemplateStyle.style = "height: 125px; display: -ms-grid; background-color: " + rootBackgroundColor;

                        Title.textContent = helloResources['HelloTitleMulti'];
                        faceDisambiguationChoice.title = helloResources['HelloOptionTitleFace'];
                        faceDisambiguationChoice.description = helloResources['HelloLeadTextFace'];
                        fingerDisambiguationChoice.title = helloResources['HelloOptionTitleFingerprint'];
                        fingerDisambiguationChoice.description = helloResources['HelloOptionBodyFingerprint'];

                        NextButton.disabled = true;
                        EnrollmentListView.addEventListener("iteminvoked", function (e) {
                            NextButton.disabled = false;
                            if (disambiguationArray[e.detail.itemIndex] === faceDisambiguationChoice) {
                                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentDisambiguationFaceSelected");
                                enrollmentKinds.face = true;
                                enrollmentKinds.fingerprint = false;
                            }
                            else {
                                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "HelloEnrollmentDisambiguationFingerprintSelected");
                                enrollmentKinds.fingerprint = true;
                                enrollmentKinds.face = false;
                            }
                        });
                        EnrollmentListView.focus();
                    } else {
                        // Remove the non-applicable elements
                        _setVisibility(FaceAndFingerprint, false);

                        if (enrollmentKinds.face) {
                            _logEvent("ShowingHelloEnrollmentPage", "Face");

                            _setVisibility(FingerprintOnlyGlyph, false);

                            Title.textContent = helloResources['HelloTitleFace'];
                            LeadText.textContent = helloResources['HelloLeadTextFace'];

                            FaceOnlyGlyph.textContent = "\uEB68";
                            FaceOnlyGlyph.setAttribute("aria-label", helloResources['HelloFaceIconAriaLabel']);
                        } else {
                            _logEvent("ShowingHelloEnrollmentPage", "Fingerprint");

                            _setVisibility(FaceOnlyGlyph, false);

                            Title.textContent = helloResources['HelloTitleFingerprint'];
                            LeadText.textContent = helloResources['HelloLeadTextFingerprint'];

                            FingerprintOnlyGlyph.textContent = "\uE928";
                            FingerprintOnlyGlyph.setAttribute("aria-label", helloResources['HelloFingerprintIconAriaLabel']);
                        }
                    }

                    // Enable page
                    bridge.fireEvent(CloudExperienceHost.Events.visible, true);
                } else {
                    _logEvent("NotShowingHelloEnrollmentPage");
                    bridge.fireEvent(CloudExperienceHost.Events.done, CloudExperienceHost.AppResult.abort);
                }

                function _logEvent(eventName, eventParam) {
                    if (eventParam) {
                        bridge.invoke("CloudExperienceHost.Telemetry.logEvent", eventName, eventParam);
                    } else {
                        bridge.invoke("CloudExperienceHost.Telemetry.logEvent", eventName);
                    }
                }

                function _setVisibility(container, visible) {
                    container.style.visibility = (visible) ? 'visible' : 'hidden';
                    container.style.display = (visible) ? 'inline' : 'none';
                    container.setAttribute("aria-hidden", (visible) ? "false" : "true");
                }

                // Helper function to invoke the Hello enrollment app
                function _enroll() {
                    _logEvent("HelloEnrollmentShowingEnrollmentApp");
                    uiHelpers.SetElementVisibility(PageContent, false);

                    // Size and position don't matter because it'll show fullscreen
                    let rect = {
                        height: 0,
                        width: 0,
                        x: 0,
                        y: 0
                    };
                    bridge.invoke("CloudExperienceHost.Hello.startHelloEnrollment", enrollmentKinds, rect).then(function (enrolledSuccessfully) {
                        if (enrolledSuccessfully) {
                            _logEvent("HelloEnrollmentSuccess");
                            bridge.fireEvent(CloudExperienceHost.Events.done, CloudExperienceHost.AppResult.success);
                        } else {
                            _logEvent("HelloEnrollmentCanceled");
                            bridge.fireEvent(CloudExperienceHost.Events.done, CloudExperienceHost.AppResult.cancel);
                        }
                    }, function (e) {
                        _logEvent("HelloEnrollmentFailed", JSON.stringify({ number: e && e.number.toString(16), stack: e && e.asyncOpSource && e.asyncOpSource.stack }));
                        bridge.fireEvent(CloudExperienceHost.Events.done, CloudExperienceHost.AppResult.fail);
                    });
                }
            },
            error: function (e) {
                _logEvent("HelloEnrollmentWinJSPageError", JSON.stringify({ number: e && e.number.toString(16), stack: e && e.asyncOpSource && e.asyncOpSource.stack }));
                bridge.fireEvent(CloudExperienceHost.Events.done, CloudExperienceHost.AppResult.fail);
            },
        });
    })(Hello = CloudExperienceHost.Hello || (CloudExperienceHost.Hello = {}));
})(CloudExperienceHost || (CloudExperienceHost = {}));
