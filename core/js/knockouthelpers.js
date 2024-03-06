//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout'], (ko) => {
    let componentLoadCompleteCallback;
    let componentLoadingPromise = new WinJS.Promise((reportComplete) => {
        componentLoadCompleteCallback = reportComplete;
    });
    let pendingComponentLoads = 0;
    let initialComponentLoadComplete = false;
    function onComponentPreloaded(component) {
        if (!initialComponentLoadComplete && --pendingComponentLoads == 0) {
            initialComponentLoadComplete = true;
            setImmediate(() => {
                componentLoadCompleteCallback();
            });
        }
    }

    // Components to register and pre-load
    let customComponents = {
        'default-progress': {},
        'default-contentView': {},
        'backstack-chrome-breadcrumb': {},
        'close-chrome-breadcrumb': {},
        'oobe-chrome-breadcrumb': {},
        'oobe-chrome-contentview': {},
        'oobe-chrome-footer': {},
        'oobe-progress': {},
        'oobe-light-contentview': {},
        'oobe-light-progress': {},
        'oobe-light-footer': {},
        'default-frame': {},
        'oobe-frame': {},
        'sspr-frame': {},
        'oobe-light-frame': {},
    };

    class KnockoutHelpers {
        // Register components for the frame
        registerFrameComponents() {
            // Setup naming convention and path for templates and view models for requirejs to load
            let componentLoader = {
                getConfig: (name, callback) => {
                    let viewModelConfig = { require: name + '-vm' },
                        templateConfig = { require: 'lib/text!pageView/' + name + '-template.html' };
                    // The synchronous flag means components are *allowed* to load synchronously,
                    // after the initial load which is always async
                    callback({ viewModel: viewModelConfig, template: templateConfig, synchronous: true });
                }
            };
            ko.components.loaders.unshift(componentLoader);

            // Register virtual elements
            Object.keys(customComponents).forEach((key) => {
                ko.components.register(key, customComponents[key]);
            });

            // Preload async components and allow waiting on them
            Object.keys(customComponents).forEach((key) => {
                pendingComponentLoads++;
                ko.components.get(key, onComponentPreloaded);
            });
        }

        static waitForInitialComponentLoadAsync() {
            return componentLoadingPromise;
        }
    }

    return KnockoutHelpers;
});
