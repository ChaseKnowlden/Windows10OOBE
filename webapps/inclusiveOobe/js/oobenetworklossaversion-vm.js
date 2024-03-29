﻿//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout', 'legacy/bridge', 'legacy/events', 'legacy/core', 'jsCommon/knockout-helpers'], (ko, bridge, constants, core, KoHelpers) => {
    class NetworkLossAversionViewModel {
        constructor(resources, version) {
            this.resources = resources;
            this.version = version;

            this.title = this.resources["NetworkLossAversionTitleV" + this.version];
            this.descriptionText = this.resources["descriptionTextV" + this.version];
            this.processingFlag = ko.observable(false);

            this.constraintTags = {
                optIn: "optIn",
                optOut: "optOut"
            };
            this.checkBoxAriaLabel = this.resources.checkBoxAriaLabel;
            this.featureOnForFullSetup = "icon-oobe icon-checkmark";

            if (this.version === 1) {
                this.flexEndButtons = [
                    {
                        buttonText: this.resources["NetworkLossAversionOptOutV" + this.version],
                        buttonType: "button",
                        isPrimaryButton: false,
                        buttonClickHandler: (() => {
                            this.onNo();
                        }),
                    },
                    {
                        buttonText: this.resources["NetworkLossAversionOptInV" + this.version],
                        buttonType: "button",
                        isPrimaryButton: true,
                        autoFocus: true,
                        buttonClickHandler: (() => {
                            this.onYes();
                        }),
                    }
                ];
            }
            else {
                this.flexStartHyperLinks = [
                    {
                        hyperlinkText: this.resources["NetworkLossAversionOptOutV" + this.version],
                        handler: () => {
                            this.onNo();
                        }
                    }
                ];
                this.flexEndButtons = [
                    {
                        buttonText: this.resources["NetworkLossAversionOptInV" + this.version],
                        buttonType: "button",
                        isPrimaryButton: true,
                        autoFocus: true,
                        buttonClickHandler: (() => {
                            this.onYes();
                        }),
                    }
                ];
                this.featureContents = this.getFeatureContents();
            }
        }

        startVoiceOver() {
            try {
                let constraints = this.createSpeechRecognitionConstraints();
                CloudExperienceHostAPI.Speech.SpeechRecognition.promptForCommandsAsync(this.resources.NetworkLossAversionVoiceOver, constraints).done((result) => {
                    this.onSpeechRecognitionResult(result);
                });
            }
            catch (err) {
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "SpeechNetworkLossAversionPageFailure: ", core.GetJsonFromError(err));
            }
        }

        createSpeechRecognitionConstraints() {
            let constraints = new Array(CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.yes, CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.no);
            if (this.version === 2) {
                let optOutConstraint = new Windows.Media.SpeechRecognition.SpeechRecognitionListConstraint(new Array(this.resources.NetworkLossAversionOptOutV2));
                optOutConstraint.tag = this.constraintTags.optOut;

                let optInConstraint = new Windows.Media.SpeechRecognition.SpeechRecognitionListConstraint(new Array(this.resources.NetworkLossAversionOptInV2));
                optInConstraint.tag = this.constraintTags.optIn;

                constraints.push(optOutConstraint, optInConstraint);
            }
            return constraints;
        }

        onSpeechRecognitionResult(result) {
            if (result && !this.processingFlag()) {
                if ((result.constraint.tag === CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.no.tag) || 
                    ((this.version === 2) && (result.constraint.tag === this.constraintTags.optOut))) {
                    this.onNo();
                }
                else if ((result.constraint.tag === CloudExperienceHostAPI.Speech.SpeechRecognitionKnownCommands.yes.tag) ||
                         ((this.version === 2) && (result.constraint.tag === this.constraintTags.optIn))) {
                    this.onYes();
                }
            }
        }

        onNo() {
            if (!this.processingFlag()) {
                this.processingFlag(true);
                bridge.invoke("CloudExperienceHost.Telemetry.logUserInteractionEvent", "GoToNetworkPage", "No");
                bridge.fireEvent(constants.Events.done, constants.AppResult.success);
            }
        }

        onYes() {
            if (!this.processingFlag()) {
                this.processingFlag(true);
                bridge.invoke("CloudExperienceHost.Telemetry.logUserInteractionEvent", "GoToNetworkPage", "Yes");
                bridge.fireEvent(constants.Events.done, constants.AppResult.action1);
            }
        }

        getFeatureContents() {
            let featureContents = [];
            // the first one is for the table header
            let numOfFeatures = 3;
            let featureClasses = [
                "icon-oobe icon-shield",
                "icon-oobe icon-onedrive",
                "icon-oobe icon-windowsLogo"
            ];
            for (let i = 0; i <= numOfFeatures; i++) {
                let totalContent;
                if (i === 0) {
                    totalContent = {
                        featureHeader: this.resources.featureHeader,
                        featureTemplateName: "nla-TableHeader-Template"
                    };
                }
                else {
                    totalContent = {
                        featureTitle: this.resources["featureTitle" + i],
                        featureDesc: this.resources["featureDesc" + i],
                        featureClass: featureClasses[i-1],
                        featureTemplateName: "nla-TableItem-Template"
                    };
                }
                featureContents.push(totalContent);
            }
            return featureContents;
        }

        getFeatureTemplateName(featureContent) {
            return featureContent.featureTemplateName;
        }
    }
    return NetworkLossAversionViewModel;
});
