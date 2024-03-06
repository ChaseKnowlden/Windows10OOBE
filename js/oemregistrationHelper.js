

"use strict";
var CloudExperienceHost;
(function (CloudExperienceHost) {
    var OEMRegistrationInfo;
    (function (OEMRegistrationInfo) {
        function getOEMRegistrationKeyNames() {
            return {
                "title": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.title,
                "subtitle": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.subtitle,
                "hideSkip": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.hideSkip,
                "customerInfo": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.customerInfo,
                "fields": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.fields,
                "type": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.type,
                "id": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.id,
                "label": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.label,
                "value": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.value,
                "checkboxType": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.checkboxType,
                "textboxType": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.textboxType,
                "linkType": CloudExperienceHostAPI.OEMRegistrationKeyNamesStatics.linkType,
            };
        }
        OEMRegistrationInfo.getOEMRegistrationKeyNames = getOEMRegistrationKeyNames;
        function retrieveOEMRegisrationInfo() {
            return new WinJS.Promise(function (completeDispatch, errorDispatch ) {
                CloudExperienceHostAPI.OEMRegistrationStatics.retrieveInfoAsync().then(function (oemRegisrationInfo) {
                    completeDispatch(oemRegisrationInfo);
                }, errorDispatch);
            });
        }
        OEMRegistrationInfo.retrieveOEMRegisrationInfo = retrieveOEMRegisrationInfo;
        function saveOEMRegisrationInfo(oemRegisrationInfo) {
            return new WinJS.Promise(function (completeDispatch, errorDispatch ) {
                CloudExperienceHostAPI.OEMRegistrationStatics.saveInfoAsync(oemRegisrationInfo).then(function () {
                    completeDispatch();
                }, errorDispatch);
            });
        }
        OEMRegistrationInfo.saveOEMRegisrationInfo = saveOEMRegisrationInfo;
        function getLinkFileContent(filePath) {
            return new WinJS.Promise(function (completeDispatch, errorDispatch ) {
                CloudExperienceHostAPI.OEMRegistrationStatics.getLinkFileAsync(filePath).then(function (file) {
                    return Windows.Storage.FileIO.readTextAsync(file);
                }).done(function (contentBuffer) {
                    completeDispatch(contentBuffer);
                }, function (err) {
                    errorDispatch(err);
                });
            });
        }
        OEMRegistrationInfo.getLinkFileContent = getLinkFileContent;
        function getShouldShowOEMRegisration() {
            return new WinJS.Promise(function (completeDispatch, errorDispatch, progressDispatch) {
                var oemRegisration = CloudExperienceHostAPI.OEMRegistrationStatics;
                oemRegisration.getShouldSkipAsync().done(function (shouldSkip) {
                    completeDispatch(!shouldSkip);
                }, function (err) {
                    errorDispatch(err);
                }, function (progress) {
                    progressDispatch(progress);
                });
            });
        }
        OEMRegistrationInfo.getShouldShowOEMRegisration = getShouldShowOEMRegisration;
        
        function localizedStrings() {
            var oemRegistrationResources = {};
            var keyList = ['VoiceOver'];
            for (var i = 0; i < keyList.length; i++) {
                var resourceId = '/oemRegistration/' + keyList[i];
                oemRegistrationResources[keyList[i]] = WinJS.Resources.getString(resourceId).value;
            }
            return JSON.stringify(oemRegistrationResources);
        }
        OEMRegistrationInfo.localizedStrings = localizedStrings;
    })(OEMRegistrationInfo = CloudExperienceHost.OEMRegistrationInfo || (CloudExperienceHost.OEMRegistrationInfo = {}));
})(CloudExperienceHost || (CloudExperienceHost = {}));
//# sourceMappingURL=oemregistrationHelper.js.map