//
// Copyright (C) Microsoft. All rights reserved.
//
(() => {
    WinJS.UI.Pages.define("/webapps/inclusiveOobe/view/oobedevicepairing-main.html", {
        init: function (element, options) {
            this.element = element;
            require.config(new RequirePathConfig("/webapps/inclusiveOobe"));

            return requireAsync(["legacy/uiHelpers", "legacy/bridge"]).then((result) => {
                var promises = [];
                promises.push(result.legacy_uiHelpers.LoadCssPromise(document.head, "", result.legacy_bridge));
                promises.push(result.legacy_uiHelpers.LangAndDirPromise(document.documentElement, result.legacy_bridge));
                promises.push(result.legacy_bridge.invoke("CloudExperienceHost.StringResources.makeResourceObject", "oobeDevicePairing").then((result) => {
                    this.resourceStrings = JSON.parse(result);
                }));

                promises.push(this.loadAccessoryDataAsync());

                return WinJS.Promise.join(promises);
            });
        },
        _getBlobUrlForImageFileAsync: function (file) {
            return file.openReadAsync().then((imageStream) => {
                if (imageStream.size === 0) {
                    throw new Error("Invalid (empty) image stream provided to Device Pairing page");
                }

                let blob = MSApp.createBlobFromRandomAccessStream(file.contentType, imageStream.cloneStream());
                return URL.createObjectURL(blob);
            });
        },
        loadAccessoryDataAsync: function () {
            let devicePairingManager = new CloudExperienceHostAPI.OobeDevicePairingManager();
            let promise = devicePairingManager.getDevicePairingInfosAsync();
            return promise.then((details) => {
                let accessoryImageUrls = [];
                let promises = [];
                details.forEach((accessoryItem) => {
                    let itemUrls = {};
                    accessoryImageUrls.push(itemUrls);
                    promises.push(this._getBlobUrlForImageFileAsync(accessoryItem.instructionImageFile).then((url) => {
                        itemUrls.instructionImageUrl = url;
                    }));
                    promises.push(this._getBlobUrlForImageFileAsync(accessoryItem.successImageFile).then((url) => {
                        itemUrls.successImageUrl = url;
                    }));
                    promises.push(this._getBlobUrlForImageFileAsync(accessoryItem.errorImageFile).then((url) => {
                        itemUrls.errorImageUrl = url;
                    }));
                });

                return WinJS.Promise.join(promises).then(() => {
                    this.accessoryDetails = details;
                    this.accessoryImageUrls = accessoryImageUrls;
                });
            });
        },
        error: (e) => {
            require(["legacy/bridge", "legacy/events"], (bridge, constants) => {
                bridge.fireEvent(constants.Events.done, constants.AppResult.error);
            });
        },
        ready: function (element, options) {
            require(["lib/knockout", "jsCommon/knockout-helpers", "legacy/bridge", "legacy/events", "oobedevicepairing-vm"], (ko, KoHelpers, bridge, constants, DevicePairingViewModel) => {
                // Setup knockout customizations
                koHelpers = new KoHelpers();
                koHelpers.registerCustomComponents();
                window.KoHelpers = KoHelpers;

                // Apply bindings and show the page
                let vm = new DevicePairingViewModel(this.element, this.resourceStrings, this.accessoryDetails, this.accessoryImageUrls);
                ko.applyBindings(vm);
                KoHelpers.waitForInitialComponentLoadAsync().then(() => {
                    WinJS.Utilities.addClass(document.body, "pageLoaded");
                    bridge.fireEvent(constants.Events.visible, true);
                    KoHelpers.setFocusOnAutofocusElement();
                    vm.onPageLoaded();
                });
            });
        }
    });
})();