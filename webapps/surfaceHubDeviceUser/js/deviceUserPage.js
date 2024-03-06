//
// Copyright (C) Microsoft. All rights reserved.
//
(function () {
    "use strict";
    var deviceUserResources = {};
    var bridge = new CloudExperienceHost.Bridge();
    var validator = new uiHelpers.Validator();
    var errorClass = new uiHelpers.ErrorUI();
    var errorTextMap = {
        0xc0000073: "Error_LogonFailure",       // STATUS_NONE_MAPPED
        0xd000005f: "Error_LogonFailure",       // STATUS_NO_SUCH_LOGON_SESSION
        0xd000006d: "Error_LogonFailure",       // STATUS_LOGON_FAILURE
        0xd0000071: "Error_PasswordExpired",    // STATUS_PASSWORD_EXPIRED
    };

    WinJS.UI.Pages.define("/webapps/surfaceHubDeviceUser/view/main.html", {
        init: function (element, options) {
            var languagePromise = bridge.invoke("CloudExperienceHost.Globalization.Language.getPreferredLang").then(function (preferredLang) {
                _htmlRoot.setAttribute("lang", preferredLang);
            }, function () { });
            var dirPromise = bridge.invoke("CloudExperienceHost.Globalization.Language.getReadingDirection").then(function (dirVal) {
                _htmlRoot.setAttribute("dir", dirVal);
            }, function () { });
            var keyList = ['Title', 'LeadText', 'UserPlaceholder', 'PasswordPlaceHolder', 'ErrorDialog', 'Error_NoUsername', 'Error_UsernameFormat', 'Error_LogonFailure', 'Error_PasswordExpired', 'NextButton'];
            var stringPromise = bridge.invoke("CloudExperienceHost.StringResources.makeResourceObject", "deviceUser", keyList).then((result) => {
                deviceUserResources = JSON.parse(result);
            });
            var cssPromise = uiHelpers.LoadCssPromise(document.head, "../../..", bridge);
            return WinJS.Promise.join({ languagePromise: languagePromise, dirPromise: dirPromise, stringPromise: stringPromise, cssPromise: cssPromise });
        },
        ready: function (element, options) {
            // Dynamically adding textContent to following elements
            var setContentFor = [Title, LeadText, NextButton];
            var i = 0;
            for (i = 0; i < setContentFor.length; i++) {
                setContentFor[i].textContent = deviceUserResources[setContentFor[i].id];
            }
            // Set ErrorDialog text to the password input's error dialog
            password_errorDialog.textContent = deviceUserResources['ErrorDialog'];

            // Dynamically setting attributes for the following elements
            var placeholderKey = [userName, password];
            var placeholderValue = ['UserPlaceholder', 'PasswordPlaceHolder'];
            for (i = 0; i < placeholderKey.length; i++) {
                placeholderKey[i].setAttribute('placeholder', deviceUserResources[placeholderValue[i]]);
            }

            // Update textContent and accesskey for Next Button
            var checkAmpersandFor = [NextButton];
            checkAmpersandFor.forEach(function (eachElement) {
                var result = CloudExperienceHost.ResourceManager.GetContentAndAccesskey(deviceUserResources[eachElement.id]);
                eachElement.textContent = result.content;
                eachElement.accessKey = result.accessKey;
            });

            // Call _onNext() on NextButton click
            NextButton.addEventListener("click", function (event) {
                event.preventDefault();
                _onNext.apply(this);
            }.bind(this));
            // Validate userName input field onBlur event
            userName.addEventListener("blur", function () {
                var errorCode = validator.validateUpn(userName);
                if (errorCode !== ErrorCodes.SUCCESS) {
                    _showErrorCode(errorCode, false /* setFocus */);
                }
            });
            // Remove error-message(if any) on valid username
            userName.addEventListener("keyup", function () {
                var errorCode = validator.validateUpn(userName);
                if (errorCode === ErrorCodes.SUCCESS) {
                    errorClass.HideError(userName, userName_errorDialog);
                }
            });

            userName.focus();

            bridge.fireEvent(CloudExperienceHost.Events.visible, true);

            function _onNext() {
                _setProgressState(true);
                // validate email address
                var result = validator.validateUpn(userName);
                if (result === ErrorCodes.SUCCESS) {
                    // Invoke createDeviceUser API via bridge
                    bridge.invoke("CloudExperienceHost.DeviceUser.createDeviceUser", userName.value.trim(), password.value.trim()).done(function () {
                        bridge.fireEvent(CloudExperienceHost.Events.done, CloudExperienceHost.AppResult.success);
                    }, function (e) {
                        _setProgressState(false);
                        result = _getErrorCode(e.number);
                        _showErrorCode(result, true /* setFocus */);
                    }.bind(this));
                }
                else {
                    _setProgressState(false);
                    _showErrorCode(result, true /* setFocus */);
                }
            }
            // Helper function to set progress state based on bool parameter
            function _setProgressState(waiting) {
                NextButton.disabled = waiting;
                userName.disabled = waiting;
                password.disabled = waiting;
                if (waiting) {
                    errorClass.HideError(userName, userName_errorDialog);
                    errorClass.HideError(password, password_errorDialog);
                }
                progressRing.style.visibility = (waiting) ? 'visible' : 'hidden';
            }
            // Helper function to resolve e.number to ErrorCodes
            function _getErrorCode(errorNumber) {
                var errorCode = uiHelpers.GetErrorCodeFromError(errorNumber);
                // if the error code is the default, change it to a known string, or something with the error number in it.
                if (errorCode === ErrorCodes.Error_Creating_Account_Warning) {
                    var unsignedErrorValue = (errorNumber >>> 0);
                    if (errorTextMap.hasOwnProperty(unsignedErrorValue)) {
                        errorCode = deviceUserResources[errorTextMap[unsignedErrorValue]];
                    }
                    else {
                        errorCode = deviceUserResources['ErrorDialog'] + unsignedErrorValue.toString(16);
                    }
                }
                return errorCode;
            }
            // Helper function to resolve and display errors
            // Set focus on inputField if shouldSetFocus is true
            function _showErrorCode(errorCode, setFocus) {
                // Note:The _showErrorCode() displays error on the var inputField.
                var resourceId = null, inputField = null;
                switch (errorCode) {
                    case ErrorCodes.LocalUser_NoUsername_Error:
                        resourceId = 'Error_NoUsername';
                        inputField = userName;
                        break;
                    case ErrorCodes.Username_Error:
                        resourceId = 'Error_UsernameFormat';
                        inputField = userName;
                        break;
                    case ErrorCodes.UsernameFormat_Error:
                        resourceId = 'Error_UsernameFormat';
                        inputField = userName;
                        break;
                    default:
                        inputField = password;
                }
                if (resourceId) {
                    errorClass.ShowError(inputField, document.getElementById(inputField.id + '_errorDialog'), deviceUserResources[resourceId]);
                }
                else {
                    errorClass.ShowError(inputField, document.getElementById(inputField.id + '_errorDialog'), errorCode);
                }
                if (setFocus) {
                    inputField.focus();
                }
            }
        },
    });
})();
