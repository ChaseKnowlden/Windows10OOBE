//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout', 'oobesettings-data', 'legacy/bridge', 'legacy/events', 'legacy/core', 'jsCommon/knockout-helpers'], (ko, oobeSettingsData, bridge, constants, core, KoHelpers) => {

    class SettingsViewModel {
        constructor(resources, isInternetAvailable, targetPersonality) {
            this.resources = resources;
            let oobeSettingsToggles = this.getSettingsToggles();
            this.contentSettings = oobeSettingsToggles.settingsData;
            this.settingsObjects = oobeSettingsToggles.settingsObjects;
            this.learnMoreContent = oobeSettingsData.getLearnMoreContent();

            // Log telemetry for Default Settings
            for (let setting of this.settingsObjects) {
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Default" + setting.canonicalName, setting.value);
            }

            // observable to monitor page view change
            this.viewName = ko.observable("customize");

            let mainTitleTextStrings = {};
            let mainSubHeaderTextStrings = {};
            mainTitleTextStrings["customize"] = resources.SettingsTitle;
            mainSubHeaderTextStrings["customize"] = resources.SettingsSubtitle;
            mainTitleTextStrings["learnmore"] = resources.LearnMoreTitle;

            this.title = ko.pureComputed(() => {
                return mainTitleTextStrings[this.viewName()];
            });
            this.subHeaderText = ko.pureComputed(() => {
                return mainSubHeaderTextStrings[this.viewName()];
            });

            this.voiceOverContent = {};
            this.voiceOverContent["customize"] = resources.CustomizeVoiceOver;

            this.processingFlag = ko.observable(false);
            let flexEndButtonSet = {};
            flexEndButtonSet["customize"] = [
                {
                    buttonText: resources.LearnMoreButtonText,
                    buttonType: "button",
                    isPrimaryButton: false,
                    autoFocus: false,
                    disableControl: ko.pureComputed(() => {
                        return this.processingFlag();
                    }),
                    buttonClickHandler: () => {
                        this.onLearnMore();
                    }
                },
                {
                    buttonText: resources.NextButtonText,
                    buttonType: "button",
                    automationId: "OOBESettingsAcceptButton",
                    isPrimaryButton: true,
                    autoFocus: true,
                    disableControl: ko.pureComputed(() => {
                        return this.processingFlag();
                    }),
                    buttonClickHandler: () => {
                        this.onSave();
                    }
                }
            ];
            flexEndButtonSet["learnmore"] = [
                {
                    buttonText: resources.ContinueButtonText,
                    buttonType: "button",
                    isPrimaryButton: true,
                    autoFocus: false,
                    disableControl: ko.pureComputed(() => {
                        return this.processingFlag();
                    }),
                    buttonClickHandler: () => {
                        this.onLearnMoreContinue();
                    }
                }
            ];

            this.flexEndButtons = ko.pureComputed(() => {
                return flexEndButtonSet[this.viewName()];
            });

            this.customizeVisible = ko.pureComputed(() => {
                return (this.viewName() === "customize");
            });
            this.learnMoreVisible = ko.pureComputed(() => {
                return (this.viewName() === "learnmore");
            });

            this.pageDefaultAction = () => {
                if (this.customizeVisible()) {
                    this.onSave();
                }
                else if (this.learnMoreVisible()) {
                    this.onLearnMoreContinue();
                }
            };

            this.viewName.subscribe((newViewName) => {
                this.processingFlag(false);
            });

            let footerDescriptionTextSet = {};
            footerDescriptionTextSet["customize"] = resources.LearnMoreDescription;
            this.footerDescriptionText = ko.pureComputed(() => {
                return footerDescriptionTextSet[this.viewName()];
            });
            this.footerDescriptionVisible = ko.pureComputed(() => {
                return (footerDescriptionTextSet[this.viewName()] !== null);
            });
        }

        startVoiceOver() {
            this.speak(this.viewName());
        }

        speak(viewName) {
            if (viewName in this.voiceOverContent) {
                CloudExperienceHostAPI.Speech.SpeechRecognition.stop();
                CloudExperienceHostAPI.Speech.SpeechSynthesis.speakAsync(this.voiceOverContent[viewName]);
            }
        }

        onLearnMore() {
            if (!this.processingFlag()) {
                this.processingFlag(true);
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "Settings", "LearnMoreLink");
                this.viewName("learnmore");
                this.onAfterViewNameUpdated();
                KoHelpers.setFocusOnAutofocusElement();
            }
        }

        onAfterViewNameUpdated() {
            let learnMoreIFrame = document.getElementById("learnMoreIFrame");
            let doc = learnMoreIFrame.contentWindow.document;
            oobeSettingsData.updateLearnMoreContentForRender(doc, document.documentElement.dir, isInternetAvailable, this.resources.NavigationError, targetPersonality);
        }

        onToggleChange() {
        }

        onSave() {
            if (!this.processingFlag()) {
                this.processingFlag(true);
                oobeSettingsData.commitSettings(this.settingsObjects, 2 /*PrivacyConsentPresentationVersion::AllSettingsSinglePageTwoColumn*/);
            }
        }

        onLearnMoreContinue() {
            if (!this.processingFlag()) {
                this.processingFlag(true);

                this.viewName("customize");
                KoHelpers.setFocusOnAutofocusElement();
            }
        }

        // Converts the underlying settings objects into a format consumable by the single-page variant of oobe settings
        getSettingsToggles() {
            //initialize the settingsData object
            let settingsData = [];
            let settingsObjects = [];
            let oobeSettingsGroups = CloudExperienceHostAPI.OobeSettingsStaticsCore.getSettingGroups();

            for (let oobeSettingsGroup of oobeSettingsGroups) {
                let settingsGroupModel = {};
                settingsGroupModel.contentHeader = oobeSettingsGroup.title;
                settingsGroupModel.description = oobeSettingsGroup.description;

                let toggles = [];
                let settingsInGroup = oobeSettingsGroup.getSettings();
                for (let setting of settingsInGroup) {
                    settingsObjects.push(setting);
                    let toggle = {
                        labelOffText: setting.valueOffLabel,
                        labelOnText: setting.valueOnLabel,
                        checkedValue: ko.observable(setting.value),
                        name: setting.name,
                        descriptionOn: setting.descriptionOn,
                        descriptionOff: setting.descriptionOff,
                        titleText: ko.observable(setting.value ? setting.descriptionOn : setting.descriptionOff),
                        canonicalName: setting.canonicalName
                    };
                    toggle.checkedValue.subscribe(function (newValue) {
                        setting.value = newValue;
                        toggle.titleText(newValue ? toggle.descriptionOn : toggle.descriptionOff);
                    });
                    toggles.push(toggle);
                }
                settingsGroupModel.toggleContent = toggles;
                settingsData.push(settingsGroupModel);
            }
            return {
                settingsData: settingsData,
                settingsObjects: settingsObjects
            };
        }
    }
    return SettingsViewModel;
});
