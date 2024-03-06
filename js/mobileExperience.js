//
// Copyright (C) Microsoft. All rights reserved.
//
/// <disable>JS2085.EnableStrictMode</disable>
"use strict";
var CloudExperienceHost;
(function (CloudExperienceHost) {
    var MobileExperience;
    (function (MobileExperience) {
        function setMobileExperienceOptIn() {
            let mobileExperienceManager = new ContentManagement.ContentManagementBroker();
            mobileExperienceManager.mobilityExperienceSettings.optedIn = true;
        }

        function getShouldSkipAsync() {
            return new WinJS.Promise(function (completeDispatch, errorDispatch) {
                let mobileExperienceManager = new ContentManagement.ContentManagementBroker();
                let isOptedIn = mobileExperienceManager.mobilityExperienceSettings.optedIn;
                let isPinned = mobileExperienceManager.mobilityExperienceSettings.yourPhoneTaskbarIconCreated;

                // Skip the MMX node if user is opted in and GG is pinned
                (isOptedIn && isPinned) ? completeDispatch(true) : completeDispatch(false);
            });
        }

        function createYourPhoneTaskbarIconIfNeeded(linkedMobileOS, selectedMobileOS, segmentMobileOS) {
            let mobileExperienceManager = new ContentManagement.ContentManagementBroker();
            mobileExperienceManager.mobilityExperienceSettings.createYourPhoneTaskbarIconIfNeeded(linkedMobileOS, selectedMobileOS, segmentMobileOS);
        }

        // These are added for Settings only because OOBE will not have these values set or enabled
        function getSettingsQueryString() {
            let flightingInfo = CloudExperienceHostAPI.ContentDeliveryManagerHelpers.getFlightingInfo();
            let queryString = getQueryString();
            let mobileExperienceManager = new ContentManagement.ContentManagementBroker();
            queryString += "&waasBldFlt=" + (flightingInfo.enabled ? "1" : "0");
            queryString += "&waasRing=" + flightingInfo.ring;
            queryString += "&mobilityOptIn=" + (mobileExperienceManager.mobilityExperienceSettings.optedIn ? "1" : "0");
            return queryString;
        }
        function getQueryString() {
            let smbUsage = CloudExperienceHostAPI.ContentDeliveryManagerHelpers.businessUsageIndicator;
            let tailoredExperience = CloudExperienceHostAPI.ContentDeliveryManagerHelpers.tailoredExperiencesEnabled;
            let queryString = "";
            queryString += "isu=" + (smbUsage ? "1" : "0");
            queryString += "&poptin=" + (tailoredExperience ? "1" : "0");
            return queryString;
        }
        MobileExperience.setMobileExperienceOptIn = setMobileExperienceOptIn;
        MobileExperience.getShouldSkipAsync = getShouldSkipAsync;
        MobileExperience.createYourPhoneTaskbarIconIfNeeded = createYourPhoneTaskbarIconIfNeeded;
        MobileExperience.getOobeQueryString = getQueryString;
        MobileExperience.getSettingsQueryString = getSettingsQueryString;
        MobileExperience.getScoobeQueryString = getSettingsQueryString;
    })(MobileExperience = CloudExperienceHost.MobileExperience || (CloudExperienceHost.MobileExperience = {}));
})(CloudExperienceHost || (CloudExperienceHost = {}));
