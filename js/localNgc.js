

"use strict";
var CloudExperienceHost;
(function (CloudExperienceHost) {
    var LocalNgc;
    (function (LocalNgc) {
        function localNgcLocalizedStrings() {
            var localNgcResources = {};
            var keyList = ['Title', 'TitleTryAgain', 'Body', 'BodyTryAgain', 'SkipButton', 'NextButton', 'TryAgainButton'];
            var i = 0;
            for (i = 0; i < keyList.length; i++) {
                var resourceId = '/localNgc/' + keyList[i];
                localNgcResources[keyList[i]] = WinJS.Resources.getString(resourceId).value;
            }
            return JSON.stringify(localNgcResources);
        }
        LocalNgc.localNgcLocalizedStrings = localNgcLocalizedStrings;
        function createLocalPinAsync() {
            return new WinJS.Promise(function (completeDispatch, errorDispatch, progressDispatch) {
                var localNgc = new CloudExperienceHostBroker.LocalNgc.LocalNgcManager();
                localNgc.createLocalPinAsync().done(function () { completeDispatch(); }, function (err) { errorDispatch(err); }, function (progress) { progressDispatch(progress); });
            });
        }
        LocalNgc.createLocalPinAsync = createLocalPinAsync;
    })(CloudExperienceHost.LocalNgc || (CloudExperienceHost.LocalNgc = {}));
})(CloudExperienceHost || (CloudExperienceHost = {}));