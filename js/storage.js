//
// Copyright (C) Microsoft. All rights reserved.
//
/// <disable>JS2085.EnableStrictMode</disable>
"use strict";
var CloudExperienceHost;
(function (CloudExperienceHost) {
    var Storage;
    (function (Storage) {
        var SharableData;
        (function (SharableData) {
            function _getShareContainer() {
                var localSettings = Windows.Storage.ApplicationData.current.localSettings;
                var shareContainerKey = "SHARE_CONTAINER";
                var shareContainer;
                if (localSettings.containers.hasKey(shareContainerKey)) {
                    shareContainer = localSettings.containers.lookup(shareContainerKey);
                }
                else {
                    shareContainer = localSettings.createContainer(shareContainerKey, Windows.Storage.ApplicationDataCreateDisposition.always);
                }
                return shareContainer;
            }
            // This has an 8KB max size
            function addValue(name, value) {
                _getShareContainer().values[name] = value;
            }
            SharableData.addValue = addValue;
            function removeValue(name) {
                _getShareContainer().values.remove(name);
            }
            SharableData.removeValue = removeValue;
            function getValue(name) {
                return _getShareContainer().values[name];
            }
            SharableData.getValue = getValue;
            // This has a 64KB max size by using a composite to store the value
            function addLargeString(name, value) {
                var composite = new Windows.Storage.ApplicationDataCompositeValue();
                var i = 0;
                var limit = 4000;
                while (value.length > 0) {
                    composite[i] = value.substring(0, limit);
                    value = value.substring(limit);
                    i++;
                }
                _getShareContainer().values[name] = composite;
            }
            SharableData.addLargeString = addLargeString;
            function getLargeString(name) {
                var value = "";
                var composite = _getShareContainer().values[name];
                var i = 0;
                for (i = 0; i < 16; i++) {
                    if (!composite.hasKey(i)) {
                        break;
                    }
                    value += composite[i];
                }
                return value;
            }
            SharableData.getLargeString = getLargeString;
        })(SharableData = Storage.SharableData || (Storage.SharableData = {}));
    })(Storage = CloudExperienceHost.Storage || (CloudExperienceHost.Storage = {}));
})(CloudExperienceHost || (CloudExperienceHost = {}));
var CloudExperienceHost;
(function (CloudExperienceHost) {
    var Storage;
    (function (Storage) {
        var PrivateData;
        (function (PrivateData) {
            class Container {
                static getAppContainer() {
                    var appContainer;
                    var cxid = CloudExperienceHost.getCurrentNode().cxid;
                    if (Container._container.hasOwnProperty(cxid)) {
                        appContainer = Container._container[cxid];
                    }
                    else {
                        appContainer = new Object;
                        Container._container[cxid] = appContainer;
                    }
                    return appContainer;
                }
            }
            Container._container = new Object;
            function addItem(name, value) {
                Container.getAppContainer()[name] = value;
            }
            PrivateData.addItem = addItem;
            function getItem(name) {
                return Container.getAppContainer()[name];
            }
            PrivateData.getItem = getItem;
            function getValues() {
                var container = Container.getAppContainer();
                var propertySet = new Windows.Foundation.Collections.PropertySet();
                Object.keys(container).forEach(function (key) {
                    propertySet[key] = container[key];
                });
                return propertySet;
            }
            PrivateData.getValues = getValues;
        })(PrivateData = Storage.PrivateData || (Storage.PrivateData = {}));
    })(Storage = CloudExperienceHost.Storage || (CloudExperienceHost.Storage = {}));
})(CloudExperienceHost || (CloudExperienceHost = {}));
var CloudExperienceHost;
(function (CloudExperienceHost) {
    var Storage;
    (function (Storage) {
        var VolatileSharableData;
        (function (VolatileSharableData) {
            class Container {
                static getCustomDictionary(key) {
                    let customDictionary;
                    if (Container._customDictionaries.has(key)) {
                        customDictionary = Container._customDictionaries.get(key);
                    }
                    else {
                        customDictionary = new Map();
                        Container._customDictionaries.set(key, customDictionary);
                    }
                    return customDictionary;
                }
            }
            Container._customDictionaries = new Map();
            function addItem(dictionaryName, key, value) {
                Container.getCustomDictionary(dictionaryName).set(key, value);
            }
            VolatileSharableData.addItem = addItem;
            function getItem(dictionaryName, key) {
                return Container.getCustomDictionary(dictionaryName).get(key);
            }
            VolatileSharableData.getItem = getItem;
            function removeItem(dictionaryName, key) {
                return Container.getCustomDictionary(dictionaryName).delete(key);
            }
            VolatileSharableData.removeItem = removeItem;
            function getValues(dictionaryName) {
                let customDictionary = Container.getCustomDictionary(dictionaryName);
                let propertySet = new Windows.Foundation.Collections.PropertySet();
                customDictionary.forEach((value, key, map) => propertySet.insert(value, key));
                return propertySet;
            }
            VolatileSharableData.getValues = getValues;
        })(VolatileSharableData = Storage.VolatileSharableData || (Storage.VolatileSharableData = {}));
    })(Storage = CloudExperienceHost.Storage || (CloudExperienceHost.Storage = {}));
})(CloudExperienceHost || (CloudExperienceHost = {}));
//# sourceMappingURL=storage.js.map