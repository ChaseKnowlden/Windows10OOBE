//
// Copyright (C) Microsoft. All rights reserved.
//
"use strict";
define(['lib/knockout', 'legacy/bridge', 'legacy/events', 'legacy/core'], (ko, bridge, constants, core) => {
    class OemRegistrationViewModel {
        constructor(resourceStrings, regions, oemRegistrationInfo, userInfo) {
            this.resourceStrings = resourceStrings
            this.regions = regions;
            userInfo = userInfo || {};
            this.title = oemRegistrationInfo.title;
            this.subHeaderText = oemRegistrationInfo.subtitle;
            this.hideSkip = oemRegistrationInfo.hideskip;
            this.loadingLink = ko.observable(false);

            this.processingFlag = ko.observable(false);
            this.disableControl = ko.pureComputed(() => {
                return this.processingFlag();
            });

            this.customerInfo = {
                firstName: {
                    label: resourceStrings.FirstNameLabel,
                    value: ko.observable(userInfo.firstName || ""),
                    defaultValue: userInfo.firstName || "",
                },
                lastName: {
                    label: resourceStrings.LastNameLabel,
                    value: ko.observable(userInfo.lastName || ""),
                    defaultValue: userInfo.lastName || "",
                },
                email: { 
                    label: resourceStrings.EmailAddressLabel,
                    value: ko.observable(userInfo.email || ""),
                    defaultValue: userInfo.email || "",
                },
                region: {
                    label: resourceStrings.RegionLabel,
                    value: ko.observable(userInfo.country || ""),
                    defaultValue: userInfo.country || "",
                },
            };
            
            this.customerInfoField = oemRegistrationInfo.customerinfo;
            this.customerInfoField.value = ko.observable(this.customerInfoField.value);

            oemRegistrationInfo.fields.forEach((field) => {
                if (field.value !== undefined) {
                    field.value = ko.observable(field.value);
                    field.defaultValue = field.value;
                }
            });
            this.checkBoxFields = oemRegistrationInfo.fields.filter((field => field.type == "checkbox"));
            this.linkFields = oemRegistrationInfo.fields.filter((field => field.type == "link"));
            
            this.currentPanelIndex = ko.observable(this.customerInfoField ? 0 : 1);

            this.pageDefaultAction = () => {
                if (this.currentPanelIndex() == 0) {
                    this.onSubmitCustomerInfo();
                }
                else {
                    this.onSubmitAdditionalFields();
                }
            }

            this.currentPanelIndex.subscribe((newStepIndex) => {
                this.processingFlag(false);
            });
        }

        saveInfoAsync() {
            // Must be sure to unpack all observables before serializing
            let customerInfoFieldUnwrapped = {
                label: this.customerInfoField.label,
                value: this.customerInfoField.value(),
            };

            let registrationInfo = {
                customerinfo: customerInfoFieldUnwrapped,
                fields: [],
            };

            let telemetryInfos = [];

            if (this.customerInfoField) {
                Object.keys(this.customerInfo).forEach((key, index) => {
                    let field = this.customerInfo[key];
                    field.type = "textbox";
                    field.id = "text" + (index + 1);
                    field.value = field.value();
                    // Region values are an object with codeTwoLetter and displayName properties.
                    if (field.value && field.value.codeTwoLetter) {
                        field.value = field.value.codeTwoLetter;
                    }

                    // Don't add fields with null/undefined values (e.g. if the user doesn't select a region)
                    // as these break serialization in the broker's save implementation.
                    if (!field.value) {
                        field.value = "";
                    }
                    registrationInfo.fields.push(field);
                    telemetryInfos.push(this.getTelemetryInfo(field));
                });
            }

            this.checkBoxFields.forEach((field, index) => {
                field.value = field.value();
                registrationInfo.fields.push(field);
                telemetryInfos.push(this.getTelemetryInfo(field));
            });

            return bridge.invoke("CloudExperienceHost.OEMRegistrationInfo.saveOEMRegisrationInfo", JSON.stringify(registrationInfo)).then(() => {
                bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "saveOEMRegistrationInfoSuccess", JSON.stringify(telemetryInfos));
            });
        }

        onSkipCustomerInfo() {
            bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "SkipUserOobeOEMRegistrationPage");
            bridge.fireEvent(constants.Events.done, constants.AppResult.cancel);
        }

        onSubmitCustomerInfo() {
            if (!this.processingFlag()) {
                this.processingFlag(true);
                this.currentPanelIndex(1);
            }
        }

        onSubmitAdditionalFields() {
            if (!this.processingFlag()) {
                this.processingFlag(true);

                // Show the progress ring while committing async.
                bridge.fireEvent(CloudExperienceHost.Events.showProgressWhenPageIsBusy);

                this.saveInfoAsync().done(() => {
                    bridge.fireEvent(constants.Events.done, constants.AppResult.success);
                }, (error) => {
                    bridge.invoke("CloudExperienceHost.Telemetry.logEvent", "saveOEMRegistrationInfoFailure", core.GetJsonFromError(error));
                    // Mimicking old OEM page behavior of not blocking OOBE if saving the OEM data fails. This is the same as if the user clicked skip button, if it's not hidden.
                    bridge.fireEvent(constants.Events.done, constants.AppResult.cancel);
                });
            }
        }

        onOemLinkClicked(linkItem, e) {
            if (!this.loadingLink()) {
                this.loadingLink(true);
                let filePromise = bridge.invoke("CloudExperienceHost.OEMRegistrationInfo.getLinkFileContent", linkItem.value());
                let winjsPromise = requireAsync(["winjs/ui"]);
                WinJS.Promise.join({ fileContent: filePromise, modules: winjsPromise }).done((result) => {
                    let flyoutEl = document.getElementById("linkFlyout");
                    flyoutEl.setAttribute("aria-label", linkItem.label);
                    let flyoutControl = flyoutEl.winControl;
                    if (!flyoutControl) {
                        flyoutControl = new WinJS.UI.Flyout(flyoutEl);
                    }
                    let flyoutFrame = flyoutEl.querySelector("#linkFlyoutIFrame");
                    let frameDoc = flyoutFrame.contentWindow.document;
                    frameDoc.open('text/html', 'replace');
                    frameDoc.dir = document.dir;
                    frameDoc.write(result.fileContent);
                    frameDoc.close();

                    // Avoid reading "pane" for this
                    frameDoc.body.setAttribute("role", "presentation");

                    flyoutControl.onaftershow = () => {
                        flyoutFrame.contentWindow.focus();
                    };

                    flyoutControl.show(e.target, 'autovertical', 'left');
                    this.loadingLink(false);
                }, (error) => {
                    this.loadingLink(false);
                });
            }
        }

        getTelemetryInfo(field) {
            let defaultValue = ko.unwrap(field.defaultValue);
            if (field.type == "checkbox") {
                return {
                    id: field.id,
                    isPrePopulated: !!defaultValue,
                    isEmpty: false,
                    wasEmpty: false,
                    changed: defaultValue !== field.value
                };
            }
            else {
                return {
                    id: field.id,
                    isPrePopulated: defaultValue.length > 0,
                    isEmpty: field.value && field.value.length < 1,
                    wasEmpty: defaultValue.length < 1,
                    changed: defaultValue !== field.value
                };
            }
        }

        startVoiceOver() {
            try {
                CloudExperienceHostAPI.Speech.SpeechRecognition.stop();
                CloudExperienceHostAPI.Speech.SpeechSynthesis.speakAsync(this.resourceStrings.PageIntroVoiceOver);
            }
            catch (err) {
            }
        }
    }
    return OemRegistrationViewModel;
});