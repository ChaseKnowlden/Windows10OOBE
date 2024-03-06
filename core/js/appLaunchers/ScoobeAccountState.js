//
// Copyright (C) Microsoft. All rights reserved.
//

define(() => {
    class ScoobeAccountState {
        launchAsync() {
            // Block non-supported account types such as secondary MSA, Domain joined, AAD connected accounts, Guest acoounts etc. from going through the SCOOBE flow
            let items = ["MsaPrimaryAccount"];
            return CloudExperienceHost.AccountAndServices.getUserProfileEngagementAsync(items).then(function (itemResults) {
                if (itemResults[0] === "Ineligible") {
                    return WinJS.Promise.as(CloudExperienceHost.AppResult.cancel);
                }
                // Call getContextParameterProperties to get the account and ngc state.
                return CloudExperienceHost.MSA.getContextParameterProperties().then(function (propertySet) {
                    // ShouldSkipNGCEnroll.getShouldSkipAsync will call NgcQueryEnabled to check whether or not Ngc is disabled for provision.
                    return CloudExperienceHost.MSA.ShouldSkipNGCEnroll.getShouldSkipAsync().then(function (isNgcDisabled) {

                        let hasNgc = propertySet['hasngc'] === "1";
                        let accountState = propertySet['scid']; // scenario ID

                        // Here is the logic of what to upsell based on the account and ngc state.
                        // (The "non-supported" case handles internal selfhost scenarios.)
                        //
                        // Account and Hello state      | MSA upsell    | Hello upsell
                        // -----------------------------+---------------+-------------
                        // local only                   | Associated    | Skip
                        // local with Hello             | Associated    | Enroll
                        // Connected only               | Skip          | Enroll
                        // Connected with Hello         | Skip          | Skip
                        // Associated with or w/o Hello | Skip          | Skip
                        // Non-supported account state  | Skip          | Skip

                        const scoobeMSA = CloudExperienceHost.AppResult.action1;
                        const scoobeMSAHello = CloudExperienceHost.AppResult.action2;
                        const skipAccountSetup = CloudExperienceHost.AppResult.action3;
                        let result = scoobeMSA;
                        let skipNgc = false;

                        switch (accountState) {
                            case "1": // local user
                                result = scoobeMSA;
                                if (!hasNgc || isNgcDisabled) {
                                    // Set the SkipNGC property to skip Hello upsell after associated.
                                    CloudExperienceHost.Storage.SharableData.addValue("SkipNGC", "1");
                                    skipNgc = true;
                                }
                                break;
                            case "3": // MSA connected
                                result = (hasNgc || isNgcDisabled) ? skipAccountSetup : scoobeMSAHello;
                                break;
                            case "6": // MSA associated
                                result = skipAccountSetup;
                                break;
                            default:
                                // Non-supported account state - fall back to skipping
                                result = skipAccountSetup;
                        }

                        propertySet['result'] = result;
                        propertySet['skipNgc'] = skipNgc;
                        propertySet['isNgcDisabled'] = isNgcDisabled;
                        CloudExperienceHost.Telemetry.WebAppTelemetry.getInstance().logEvent("ScoobeAccountState", JSON.stringify(propertySet));
                        return WinJS.Promise.as(result);
                    });
                });
            });
        }
    }
    return ScoobeAccountState;
});