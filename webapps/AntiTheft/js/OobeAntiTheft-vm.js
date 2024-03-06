//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout', 'legacy/bridge', 'legacy/events', 'legacy/core', 'legacy/appObjectFactory', 'legacy/appManager'], (ko, bridge, constants, core, appObjectFactory) => {
    class AntiTheftViewModel {
        constructor(resourceStrings, isInternetAvailable, queryStr) {
            /* Globals */
            this.isInternetAvailable = isInternetAvailable;
            this.resourceStrings = resourceStrings;
            this.hasInternet = ko.observable(this.isInternetAvailable);

            /* Title - Shared */
            this.title = ko.observable(this.resourceStrings.AntiTheftTitle);

            /* Page Controls */
            this.showDisambiguation = ko.observable(true);
            this.showOffline = ko.observable(false);
            this.showOnline = ko.observable(this.isInternetAvailable);
            
            /* Disamiguation Strings (First Page) */
            this.AccountString = ko.observable("");
            this.DisambiguationIntro1 = ko.observable(this.resourceStrings.DisambiguationIntro1);
            this.DisambiguationIntro2 = ko.observable(this.resourceStrings.DisambiguationIntro2);
            this.recoveryButtonText = ko.observable(this.resourceStrings.RecoveryKeyButtonText);
            this.DisambiguationIntro3 = ko.observable(this.resourceStrings.DisambiguationIntro3);
            this.signInText = ko.observable(this.resourceStrings.SignIn);
            
            /* Offline Strings (Recovery Key Page) */
            this.offlineIntro = ko.observable(this.resourceStrings.OfflineIntroText1);
            this.AMCLink = ko.observable(this.resourceStrings.AMCLink);
            this.offlineIntro2 = ko.observable(this.resourceStrings.OfflineIntroText2);
            this.rKeyLink = ko.observable(this.resourceStrings.RecoveryKeyLinkText);
            this.rKeyText = ko.observable(this.resourceStrings.RecoveryKeyPlaceHolder);
            this.nextText = ko.observable(this.resourceStrings.NextText);

            /* Recovery Key Pretty-Display Variables */
            this.internalRKey = ko.observable("");
            this.rKeyValue = ko.pureComputed({
                read: () => {
                    return this.internalRKey();
                },
                write: (value) => {
                    this.internalRKey(this.PrettyDisplay5x5(value));
                },
                owner: this
            });
            this.shouldAllowNext = ko.computed(() => {
                // Magic Number 5 digits * 5 groups + 4 separators
                return this.internalRKey().length === 29;
            });

            /* Errors */
            this.errorText = ko.observable("");
            this.showError = ko.observable(false);

            /* Functions */
            this.navigateToOffline = () => {
                this.showOffline(true);
                this.showOnline(false);
                this.showDisambiguation(false);
                this.title(this.resourceStrings.SecondaryTitle);
            }

            this.PrettyDisplay5x5 = (FiveByFive) => {
                FiveByFive = FiveByFive.replace(new RegExp("-+", "g"), "");
                let concat = [];
                // magic number 5 groups
                for (let i = 0; i < FiveByFive.length; i+=5)
                {
                    //magic number 5 characters
                    if (FiveByFive.length - (i) > 5) {
                        concat.push(FiveByFive.substr(i, 5));
                    } else {
                        concat.push(FiveByFive.substr(i));
                    }   
                }
                return concat.join("-");
            }

            this.unlockAntiTheftOffline = () => {
                try {
                    AntiTheft.AntiTheftClient.disableByRecoveryKey(this.rKeyValue());
                    bridge.fireEvent(CloudExperienceHost.Events.showProgressWhenPageIsBusy);
                    bridge.fireEvent(constants.Events.done, constants.AppResult.success);
                }
                catch(err) {
                    this.showError(true);
                    this.errorText(err);
                }
            }

            this.unlockAntiTheftOnline = () => {
                // show server hosted page
                const OAuthProxy = "https://sdx.microsoft.com/antitheft?redirect=";
                let uriState = AntiTheft.ANTI_THEFT_AUTH_URI_STATE.NOT_MATCHING_REGEX;
                let currentUri = window.location.href;
                if(queryStr.size > 0)
                {
                    // remove the query params
                    currentUri = currentUri.split('?')[0];
                }
                window.location.href = OAuthProxy + currentUri;
                if ((new RegExp('^ms-appx-web:\/\/microsoft\.(windows\.|)cloudexperiencehost.*\/webapps\/antitheft\/views\/OobeAntiTheft-main\.html$')).test(window.location.href)) {
                    uriState = AntiTheft.ANTI_THEFT_AUTH_URI_STATE.MATCHING_REGEX;
                }
                AntiTheft.AntiTheftClient.LogOobeAuthUriState(uriState);
            }

            this.handleQuery = (query) => {
                let basicMap = {};
                let str = "";
                for (let item of query) {
                    basicMap["" + item.name] = "" + item.value;
                }

                if (basicMap.hasOwnProperty("error")) {
                    this.showError(true);
                    this.errorText(basicMap["error_description"]);
                }

                if (basicMap.hasOwnProperty("access_token")) {
                    this.token = basicMap['access_token'];
                    this.token_type = basicMap['token_type'];
                }
            }

            if (queryStr.size > 0) {
                this.handleQuery(queryStr);
            }

            try {
                let obfuscatedAccount = AntiTheft.AntiTheftClient.getObfuscatedAccount();
                this.AccountString(obfuscatedAccount);

                if (this.token) {
                    AntiTheft.AntiTheftClient.disableByRemoteAuth(this.token, AntiTheft.ANTI_THEFT_TICKET_TYPE.msa_OOBE_TICKET);
                    bridge.fireEvent(CloudExperienceHost.Events.done, constants.AppResult.success);
                }
            }
            catch (err) {
                this.showError(true);
                this.errorText(err);
            }
        }
    }
    return AntiTheftViewModel;
});
