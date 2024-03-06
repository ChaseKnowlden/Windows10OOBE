//
// Copyright (C) Microsoft. All rights reserved.
//
/// <disable>JS2085.EnableStrictMode</disable>
"use strict";
var CloudExperienceHost;
(function (CloudExperienceHost) {
    var AppFrame;
    (function (AppFrame) {
        function showGraphicAnimation(fileName) {
            return requireAsync(['legacy/appViewManager']).then((result) => {
                return result.legacy_appViewManager.showGraphicAnimation(fileName);
            });
        }
        AppFrame.showGraphicAnimation = showGraphicAnimation;
    })(AppFrame = CloudExperienceHost.AppFrame || (CloudExperienceHost.AppFrame = {}));
})(CloudExperienceHost || (CloudExperienceHost = {}));
//# sourceMappingURL=appFrame.js.map