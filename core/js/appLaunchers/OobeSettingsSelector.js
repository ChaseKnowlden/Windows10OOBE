//
// Copyright (C) Microsoft. All rights reserved.
//

define(() => {
    class OOBESettingsSelector {
        launchAsync() {
            return new WinJS.Promise((completeDispatch /*, errorDispatch, progressDispatch */) => {
                // List of regions that use the multi-page version of settings
                // Please be aware of the list in %SDXROOT%\onecoreuap\shell\inc\PrivacyConsentHelpers.h,
                // which is not necessarily the same as this list
                let supportedRegionList = ["AT", "AUT", "BE", "BEL", "BG", "BGR", "BR", "BRA", "CA", "CAN", "HR", "HRV", "CY", "CYP",
                    "CZ", "CZE", "DK", "DNK", "EE", "EST", "FI", "FIN", "FR", "FRA", "DE", "DEU", "GR", "GRC",
                    "HU", "HUN", "IS", "ISL", "IE", "IRL", "IT", "ITA", "KR", "KOR", "LV", "LVA", "LI", "LIE", "LT", "LTU",
                    "LU", "LUX", "MT", "MLT", "NL", "NLD", "NO", "NOR", "PL", "POL", "PT", "PRT", "RO", "ROU",
                    "SK", "SVK", "SI", "SVN", "ES", "ESP", "SE", "SWE", "CH", "CHE", "GB", "GBR"];
                let region = CloudExperienceHost.Globalization.GeographicRegion.getCode();
                let result = CloudExperienceHost.AppResult.success;
                if (supportedRegionList.includes(region) || CloudExperienceHostAPI.FeatureStaging.isOobeFeatureEnabled("OobeSettingsMultiAllRegions"))
                {
                    result = CloudExperienceHost.AppResult.action1;
                }
                completeDispatch(result);
            });
        }
    }
    return OOBESettingsSelector;
});