//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout', 'legacy/bridge', 'legacy/events', 'legacy/core', 'jsCommon/knockout-helpers'], (ko, bridge, constants, core, KoHelpers) => {

    class ActivitySyncConsentViewModel {
        constructor(resources/*, isInternetAvailable*/) {
            this.resources = resources;
            this.processingFlag = ko.observable(false);
            this.currentPanelIndex = ko.observable(0).extend({ notify: 'always' });
            this.currentPanelIndex.subscribe((newStopIndex) => {
                this.processingFlag(false);
            });

            // Constraints for voice recognition
            this.learnMoreTag = "LearnMore";
            this.returnToMainTag = "Done";

            // TODO: We should be using a richer vocabulary for constraints like oobecortana-page.js - to avoid relocalizing
            //       anything at this point, the most we can do is use the button text.
            this.mainPageConstraints = new Array(
                CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.yes,
                CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.no,
                new Windows.Media.SpeechRecognition.SpeechRecognitionListConstraint([ this.resources.learnMoreBtn ], this.learnMoreTag)
            );

            this.learnMorePageConstraints = new Array(
                CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.yes,
                CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.back,
                new Windows.Media.SpeechRecognition.SpeechRecognitionListConstraint([ this.resources.returnToMain ], this.returnToMainTag)
            );

            this.commitUserConsent = (hasConsented) => {
                bridge.invoke("CloudExperienceHost.Telemetry.logUserInteractionEvent", "ActivitySyncConsent", hasConsented);
                if (this.processingFlag()) {
                    return;
                }
                this.processingFlag(true);
                try {
                    // Show the progress ring while committing async.
                    bridge.fireEvent(CloudExperienceHost.Events.showProgressWhenPageIsBusy);

                    CloudExperienceHostAPI.TaskFlow.OobeActivityPrivacyManager.consentToActivitySyncAsync(hasConsented).done(() => {
                        bridge.fireEvent(constants.Events.done, constants.AppResult.success);
                    }, (err) => {
                        bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "ActivityHistoryCloudSyncAllowedByUserAsyncWorkerFailure", core.GetJsonFromError(err));
                        bridge.fireEvent(constants.Events.done, constants.AppResult.error);
                    });
                }
                catch (err) {
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "ActivityHistoryCloudSyncAllowedByUserFailure", core.GetJsonFromError(err));
                    bridge.fireEvent(constants.Events.done, constants.AppResult.error);
                }
            };

            this.flexStartButtons = [
                {
                    buttonText: this.resources.learnMoreBtn,
                    isPrimaryButton: false,
                    disableControl: ko.pureComputed(() => {
                        return this.processingFlag();
                    }),
                    buttonClickHandler: () => {
                        this.showLearnMorePage();
                    }
                }
            ];

            this.flexEndButtons = [
                {
                    buttonText: this.resources.setActivitySyncOptOut,
                    buttonType: "button",
                    isPrimaryButton: false,
                    disableControl: ko.pureComputed(() => {
                        return this.processingFlag();
                    }),
                    buttonClickHandler: () => {
                        this.commitUserConsent(false /* hasNotConsented */);
                    }
                },
                {
                    buttonText: this.resources.setActivitySyncOptIn,
                    buttonType: "button",
                    automationId: "OOBEActivitySyncOptInButton",
                    isPrimaryButton: true,
                    autoFocus: true,
                    disableControl: ko.pureComputed(() => {
                        return this.processingFlag();
                    }),
                    buttonClickHandler: () => {
                        this.commitUserConsent(true /* hasConsented */);
                    }
                }
            ];

            this.returnToMainButton = [
                {
                    buttonText: this.resources.returnToMain,
                    buttonType: "button",
                    isPrimaryButton: true,
                    autoFocus: true,
                    disableControl: ko.pureComputed(() => {
                        return this.processingFlag();
                    }),
                    buttonClickHandler: () => {
                        this.returnToMain();
                    }
                }
            ];
        }

        showLearnMorePage(options = { voiceActivated: false }) {
            if (!this.processingFlag()) {
                this.processingFlag(true);

                bridge.invoke("CloudExperienceHost.Telemetry.logUserInteractionEvent", "ActivitiesSyncConsent",  options.voiceActivated ? "VoiceActivatedLearnMoreButton" : "ClickedLearnMoreButton");

                // Cancel existing prompts for top level dialog 
                CloudExperienceHostAPI.Speech.SpeechSynthesis.stop();
                CloudExperienceHostAPI.Speech.SpeechRecognition.stop();

                this.insertLearnMoreContent();
                this.currentPanelIndex(1);

                try {
                    CloudExperienceHostAPI.Speech.SpeechRecognition.listenForCommandsAsync(this.learnMorePageConstraints).then((command) => {
                        this.handleSpeechCommandLearnMore(command);
                    });
                }
                catch (err) {
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "ActivitySyncConsentPageFailure: ", core.GetJsonFromError(err));
                }
            }
        }

        insertLearnMoreContent() {
            var learmorehtml;
            CloudExperienceHostAPI.UtilStaticsCore.loadHtmlFileAsUtf16WideCharTextAsync(
                "oobe\\oobe_learn_more_activity_history.htm",
                CloudExperienceHostAPI.LoadHtmlFileOptions.pathMuiLookup,
                CloudExperienceHostAPI.LoadHtmlFileRelativePathKnownFolderId.system32,
                learmorehtml).done((learmorehtml) => {
                    let learnMoreIFrameParent = document.getElementById("learnMorePage");
                    let learnMoreIFrame = document.getElementById("learnMoreIFrame");
                    if (learnMoreIFrame) {
                        learnMoreIFrameParent.removeChild(learnMoreIFrame);
                    }

                    let newframe = document.createElement("iframe");
                    newframe.id = "learnMoreIFrame";
                    newframe.style.width = "100%";
                    newframe.style.height = "100%";
                    learnMoreIFrameParent.appendChild(newframe);
                    learnMoreIFrame = document.getElementById("learnMoreIFrame");

                    learnMoreIFrame.contentDocument.body.innerHTML = learmorehtml;
                    this.updateLearnMore();
                });
        }

        updateLearnMore() {
            let learnMore = document.getElementById("cla");
            let learnMoreIFrame = document.getElementById("learnMoreIFrame");
            let doc = learnMoreIFrame.contentWindow.document;
            let privacyLinks = doc.querySelectorAll("a");
            for (let i = 0; i < privacyLinks.length; i++) {
                let errorMessage = this.resources.privacyOffLineError;
                let link = privacyLinks[i];
                link.onclick = (e) => {
                    if (isInternetAvailable) {
                        let url = e.target.href;
                        WinJS.xhr({ url: url }).then((response) => {
                            doc.location.href = url;
                        }, (error) => {
                            let html = "<html><head><link href=\"/webapps/inclusiveOobe/css/inclusive-mseula.css\" rel=\"stylesheet\"></head><body><p>" + errorMessage + "</p></body></html>";
                            KoHelpers.loadIframeContent(doc, { content: html, dir: document.documentElement.dir });
                        });
                        e.preventDefault();
                    }
                    else {
                        doc.body.innerHTML = "<html><head><link href=\"/webapps/inclusiveOobe/css/inclusive-mseula.css\" rel=\"stylesheet\"></head><body><p>" + errorMessage + "</p></body></html>";
                        e.preventDefault();
                    }
                }
            }
        }

        returnToMain(options = { voiceActivated: false }) {
            if (!this.processingFlag()) {
                this.processingFlag(true);

                bridge.invoke("CloudExperienceHost.Telemetry.logUserInteractionEvent", "ActivitiesSyncConsent",  options.voiceActivated ? "VoiceActivatedReturnToMain" : "ClickedReturnToMain");

                CloudExperienceHostAPI.Speech.SpeechRecognition.stop();

                this.currentPanelIndex(0);

                try {
                    CloudExperienceHostAPI.Speech.SpeechRecognition.listenForCommandsAsync(this.mainPageConstraints).then((command) => {
                        this.handleSpeechCommandMain(command);
                    });
                }
                catch (err) {
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "ActivitySyncConsentPageFailure: ", core.GetJsonFromError(err));
                }
            }
        }

        startMainVoiceOver() {
            try {
                CloudExperienceHostAPI.Speech.SpeechRecognition.promptForCommandsAsync(this.resources.activitiesVoiceOver, this.mainPageConstraints).then((command) => {
                    this.handleSpeechCommandMain(command);
                });
            }
            catch (err) {
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "ActivitySyncConsentPageFailure: ", core.GetJsonFromError(err));
            }
        }

        handleSpeechCommandLearnMore(command) {
            if (command && !this.processingFlag()) {
                switch (command.constraint.tag) {
                    case CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.yes.tag:
                    case CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.back.tag:
                    case this.returnToMainTag:
                        this.returnToMain({ voiceActivated : true });
                        break

                    default:
                        break;
                }
            }
        }

        handleSpeechCommandMain(command) {
            if (command && !this.processingFlag()) {
                switch (command.constraint.tag) {
                    case CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.no.tag:
                        this.commitUserConsent(false /* hasNotConsented */);
                        break;

                    case CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.yes.tag:
                        this.commitUserConsent(true /* hasConsented */);
                        break;

                    case this.learnMoreTag:
                        this.showLearnMorePage({ voiceActivated : true });
                        break;

                    default:
                        break;
                }
            }
        }
    }
    return ActivitySyncConsentViewModel;
});