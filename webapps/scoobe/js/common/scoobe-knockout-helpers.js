//
// Copyright (C) Microsoft. All rights reserved.
//
define(['lib/knockout', 'legacy/appObjectFactory',
    'optional!sample/Sample.CloudExperienceHostAPI.Speech.SpeechSynthesis'], (ko, appObjectFactory) => {
    let pendingPanelTransition = WinJS.Promise.as(null);

    // http://osgvsowi/9869974: Refactor and combine with code in core\knockouthelpers.js
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
        'common-header': {},
        'common-footer': {},
        'common-button': {},
        'common-listview': {},
        'common-toggle': {},
        'common-textinput': {},
    };

    let componentsRegistered = false;

    function isEnterKeyHandlerAllowed(ev) {
        if (ev.keyCode == WinJS.Utilities.Key.enter) {
            let isLink = ev.target && ev.target.tagName && (ev.target.tagName.toLowerCase() === "a");
            let isButton = ev.target && ev.target.tagName && (ev.target.tagName.toLowerCase() === "button");
            let isSelect = ev.target && ev.target.tagName && (ev.target.tagName.toLowerCase() === "select");
            if (!isLink && !isButton && !isSelect) {
                return true;
            }
        }
        return false;
    }

    class KnockoutHelpers {
        // Register custom components for OOBE
        registerCustomComponents() {
            if (componentsRegistered) { Debug.break(); return; }

            // Setup naming convention and path for templates and view models for requirejs to load
            let componentLoader = {
                getConfig: (name, callback) => {
                    let viewModelConfig = { require: 'jsTemplates/' + name + '-vm' };
                    let templateConfig = { require: 'lib/text!viewCommonTemplates/' + name + '-template.html' };
                    // The synchronous flag means components are *allowed* to load synchronously,
                    // after the initial load which is always async
                    callback({ viewModel: viewModelConfig, template: templateConfig, synchronous: true });
                },
                loadViewModel: (name, viewModelConfig, callback) => {
                    // Pass the component root element to the VM,
                    // and hook up an easy way to get to the VM from the element
                    var viewModelConstructor = {
                        createViewModel: function (params, componentInfo) {
                            let vm = new viewModelConfig(params, componentInfo.element);
                            componentInfo.element.koComponent = vm;
                            return vm;
                        }
                    };
                    ko.components.defaultLoader.loadViewModel(name, viewModelConstructor, callback);
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

            componentsRegistered = true;
        }

        // Since we don't have jQuery with its handy .index() method...
        static getElementIndex(element) {
            let index = 0;
            let parent = element.parentNode;
            if (parent && parent.children.length > 0) {
                for (let i = 0; i < parent.children.length; i++) {
                    if (element == parent.children[i]) {
                        index = i;
                        break;
                    }
                }
            }
            return index;
        }

        static waitForInitialComponentLoadAsync() {
            return componentLoadingPromise;
        }

        enableWinJSBinding(callback) {
            // Enable winjs control binding
            require(['lib/knockout-winjs'], callback);
        }

        static setFocusOnAutofocusElement() {
            let currentPanel = document.querySelector('.current-visible-panel');
            // If there is no current panel, assume the page does not use panels and see if there is an autofocus element in the doc
            let autofocusElement = currentPanel ? currentPanel.querySelector("[autofocus='true']") : document.querySelector("[autofocus='true']");
            let firstInput = currentPanel ? currentPanel.querySelector("input") : null;
            if (autofocusElement) {
                autofocusElement.focus();
            } else if (firstInput) {
                firstInput.focus();
            }
        }

        static loadIframeContent(iframeDocument, value) {
            iframeDocument.open('text/html', 'replace');
            iframeDocument.write(value.content);
            iframeDocument.close();

            iframeDocument.dir = value.dir;
            iframeDocument.body.setAttribute("tabindex", "0");
            if (value.focusBody) {
                iframeDocument.body.focus();
            }

            if (value.addStyleSheet) {
                let fileRef = iframeDocument.head.ownerDocument.createElement("link");
                fileRef.setAttribute("rel", "stylesheet");
                fileRef.setAttribute("type", "text/css");
                fileRef.setAttribute("href", "/webapps/inclusiveOobe/css/inclusive-mseula.css");
                iframeDocument.head.appendChild(fileRef);
            }

            if (value.frameTitle) {
                iframeDocument.title = value.frameTitle;
            }

            if (value.pageDefaultAction) {
                function enterKeyHandler(ev) {
                    if (isEnterKeyHandlerAllowed(ev)) {
                        value.pageDefaultAction();
                        return false;
                    }
                    return true; // Tells Knockout to allow the default action
                }
                iframeDocument.addEventListener("keyup", enterKeyHandler);
            }
        }
    };

    ko.bindingHandlers.panelIndexVisible = {
        init: function (element, valueAccessor) {
            let panelIndex = element.getAttribute("data-panel-index") || KnockoutHelpers.getElementIndex(element);
            Debug.assert(panelIndex !== undefined, "Panel binding couldn't find a panel index");
            let shouldDisplay = ko.unwrap(valueAccessor()) == panelIndex;
            element.style.display = shouldDisplay ? "" : "none";
            if (shouldDisplay) {
                element.classList.add("current-visible-panel");
            }
            document.dispatchEvent(new Event("panelChanged"));
        },
        update: function (element, valueAccessor, allBindings) {
            let panelIndex = element.getAttribute("data-panel-index") || KnockoutHelpers.getElementIndex(element);
            Debug.assert(panelIndex !== undefined, "Panel binding couldn't find a panel index");
            let shouldDisplay = ko.unwrap(valueAccessor()) == panelIndex;
            if (shouldDisplay) {
                // This function (update) gets called for every panel when the active panel index changes.
                // Each panel decides whether it should be hidden or shown.
                // The setImmediate here ensures the hidden panel starts its exit animation (and assigns to pendingPanelTransition)
                // before the entrance animation gets queued by the incoming panel.
                // This introduces a very small timing window where two panels can have entrance animations queued in setImmediate callbacks
                // We synchronously add this class to the chosen incoming panel (and remove from others) to guard against this.
                element.classList.add("current-visible-panel");
                setImmediate(() => {
                    // Ensure we don't queue an entrance if another panel got selected as visible before the setImmediate callback fired
                    if (element.classList.contains("current-visible-panel")) {
                        pendingPanelTransition = pendingPanelTransition.then(() => {
                            if (element.style.display == "none") {
                                element.style.opacity = 0;
                                element.style.display = "";
                                document.dispatchEvent(new Event("panelChanged"));
                                let autoFocusItem = element.querySelector("[autofocus='true']");
                                let firstInput = element.querySelector("input");
                                if (autoFocusItem) {
                                    autoFocusItem.focus();
                                } else if (firstInput) {
                                    // If there is no item with the autofocus attribute then fall back to setting focus on the first input element
                                    firstInput.focus();
                                }
                                return WinJS.UI.Animation.fadeIn(element);
                            }
                        });
                    }
                });
            }
            else {
                element.classList.remove("current-visible-panel");
                pendingPanelTransition = pendingPanelTransition.then(() => {
                    if (element.style.display != "none") {
                        return WinJS.UI.Animation.fadeOut(element).then(() => {
                            element.style.display = "none";
                        });
                    }
                });
            }
        }
    };

    ko.bindingHandlers.textVoiceOver = {
        update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            let value = valueAccessor();
            let valueUnwrapped = ko.unwrap(value);

            if (valueUnwrapped && (valueUnwrapped.length > 0)) {
                let speechSynthesis = appObjectFactory.getObjectFromString("CloudExperienceHostAPI.Speech.SpeechSynthesis");
                speechSynthesis.speakAsync(valueUnwrapped).done(() => {
                    if (typeof viewModel.onSpeechComplete === "function") {
                        viewModel.onSpeechComplete();
                    }
                }, (error) => {
                    if (typeof viewModel.onSpeechError === "function") {
                        viewModel.onSpeechError(error);
                    }
                }, (progressState) => {
                    if ((progressState == 10 /* SpeechProgressValue_Starting */) && (typeof viewModel.onSpeechStarting === "function")) {
                        viewModel.onSpeechStarting();
                    }
                });
            }

            ko.bindingHandlers.text.update(element, valueAccessor, allBindings, viewModel, bindingContext);
        }
    };

    ko.bindingHandlers.oobePageDefaultAction = {
        update: function (element, valueAccessor) {
            let defaultAction = ko.unwrap(valueAccessor());
            if (defaultAction) {
                function enterKeyHandler(ev) {
                    if (isEnterKeyHandlerAllowed(ev)) {
                        defaultAction();
                        return false;
                    }
                    return true; // Tells Knockout to allow the default action
                }
                element.addEventListener("keyup", enterKeyHandler);
            }
        }
    };

    ko.bindingHandlers.iframeContent = {
        update: function (element, valueAccessor, allBindings) {
            let value = ko.utils.unwrapObservable(valueAccessor());
            if (value.content && value.dir) {
                let iframeDocument = element.contentWindow.document;

                if (value.preventLinkNavigation)
                {
                    // Prevent navigation from loaded iframe content within the iframe.
                    // We do this by listening for any "load" event, and for any that occur after the initial load
                    // of HTML content in the iframe, we first redirect to "about:blank" and when that load event
                    // occurs, reload the original HTML content into the iframe again. The end result is that the link
                    // appears not to work, i.e., we never appear to navigate away from the original HTML content.
                    function loadHandler(event) {
                        if (!event.srcElement.initialLoadComplete) {
                            event.srcElement.initialLoadComplete = true;
                        }
                        else if (event.srcElement.needReload) {
                            KnockoutHelpers.loadIframeContent(event.srcElement.contentWindow.document, value);
                            event.srcElement.needReload = false;
                        }
                        else {
                            event.srcElement.needReload = true; // allow next load to complete
                            event.srcElement.src = "about:blank";
                        }
                        return true; // Tells Knockout to allow the default action
                    }
                    element.addEventListener("load", loadHandler);
                }
                KnockoutHelpers.loadIframeContent(iframeDocument, value);
            }
        }
    };

    return KnockoutHelpers;
});
