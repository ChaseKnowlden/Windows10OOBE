//
// Copyright (C) Microsoft. All rights reserved.
//
/// <disable>JS2085.EnableStrictMode</disable>
"use strict";
var CloudExperienceHost;
(function (CloudExperienceHost) {
    var EnterpriseNgcEnrollment;
    (function (EnterpriseNgcEnrollment) {
        function didHelloEnrollmentSucceed() {
            return (CloudExperienceHost.getCurrentNode().cxid === "EnterpriseHelloNGC");
        }
        EnterpriseNgcEnrollment.didHelloEnrollmentSucceed = didHelloEnrollmentSucceed;

        function enrollForNgc() {
            return new WinJS.Promise((completeDispatch, errorDispatch) => {
                var NgcContainerOptionsEnum = {
                    Default : 0,
                    PreserveContainer: 1,
                    ClearContainer : 2
                };
                var ContainerOptions;
                if (CloudExperienceHost.getCurrentNode().cxid === "EnterpriseNGCReset") {
                    ContainerOptions = NgcContainerOptionsEnum.ClearContainer;
                }
                else if (CloudExperienceHost.getCurrentNode().cxid === "EnterpriseNGCFixMe") {
                    ContainerOptions = NgcContainerOptionsEnum.PreserveContainer;
                }
                else {
                    ContainerOptions = NgcContainerOptionsEnum.Default;
                }

                // http://osgvsowi/15955698: Converge the WinRT activations for NgcRegManager and userNgcRegManager into one call
                var platform = CloudExperienceHost.Environment.getPlatform();
                var userObj = CloudExperienceHost.getIUser();
                if (platform == CloudExperienceHost.TargetPlatform.DESKTOP || !userObj) {
                    UserDeviceRegistration.Ngc.NgcRegManager.registerAsync(ContainerOptions).done((GUID) => {
                        completeDispatch();
                    }, (err) => {
                        errorDispatch({ number: err.number });
                    });
                }
                else {
                    var userNgcRegManager = UserDeviceRegistration.Ngc.UserNgcRegManagerFactory.getNgcRegManagerForUser(userObj);
                    userNgcRegManager.registerAsync(ContainerOptions).done((GUID) => {
                        completeDispatch();
                    }, (err) => {
                        errorDispatch({ number: err.number });
                    });
                }
            });
        }
        EnterpriseNgcEnrollment.enrollForNgc = enrollForNgc;
    })(CloudExperienceHost.EnterpriseNgcEnrollment || (CloudExperienceHost.EnterpriseNgcEnrollment = {}));
})(CloudExperienceHost || (CloudExperienceHost = {}));