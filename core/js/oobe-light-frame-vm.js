//
// Copyright (C) Microsoft. All rights reserved.
//
let anims;
let thisAnim;

define(['lib/knockout', 'legacy/appViewManager', 'legacy/navigationManager', 'legacy/core'], (ko, appViewManager, navManager, core) => {
    ko.bindingHandlers.addFooterWebView = {
        init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
            viewModel.attachFooterWebView(element);
        }
    };

    class LiteFrameViewModel {
        constructor() {
            // Create OOBE Light specific markups
            // Need to insert a div for background into DOM App because the blur filter will not handle segmentation correctly in the frame layer
            let backgroundContainer = document.getElementsByClassName("background-image-container");
            if (backgroundContainer.length === 0) {
                backgroundContainer = document.createElement('div');
                backgroundContainer.setAttribute('class', 'background-image-container');
                document.body.insertBefore(backgroundContainer, document.body.childNodes[0]);

                let imgFolderName = "images";
                let imgFileName = "lightBackgroundTest.jpg";
                let imgFullName = "../" + imgFolderName + "/" + imgFileName;
                let imgUrl = "url(" + imgFullName + ")";
                Windows.ApplicationModel.Package.current.installedLocation.tryGetItemAsync(imgFolderName).done(imageFolder => {
                    if (imageFolder) {
                        imageFolder.tryGetItemAsync(imgFileName).done(file => {
                            if (file) {
                                backgroundContainer.style.backgroundImage = imgUrl;
                            }
                            else {
                                this.SetBackgroundImageUrlUsingTheme(backgroundContainer);
                            }
                        }, (err) => {
                            CloudExperienceHost.Telemetry.logEvent("GetBackgroundTestImageFileError", core.GetJsonFromError(error));
                        });
                    }
                    else {
                        this.SetBackgroundImageUrlUsingTheme(backgroundContainer);
                    }
                }, (err) => {
                    CloudExperienceHost.Telemetry.logEvent("GetBackgroundTestImageFolderError", core.GetJsonFromError(error));
                });
            }

            this._webViewCtrl = document.createElement('x-ms-webview');
            this._webViewCtrl.className = "content-webview";
            this._previousAnimationFile = null;

            CloudExperienceHost.Globalization.Utils.setDocumentElementLangAndDir();
            appViewManager.subscribe(this);
            appViewManager.subscribeForUpdateType(this, CloudExperienceHost.FrameViewModelUpdateType.Language);
        }

        SetBackgroundImageUrlUsingTheme(backgroundContainer) {
            // Get background image from main composer silently in case the API call failed, and then apply the background image to OOBE
            try {
                let backgroundImageUri = ApplicationTheme.AppThemeBrokeredAPI.getThemeImage(ApplicationTheme.ThemeImageType.startBackground);
                backgroundContainer.style.backgroundImage = "url(" + backgroundImageUri + ")";
            } catch (error) {
                CloudExperienceHost.Telemetry.logEvent("BackgroundThemeImageError", core.GetJsonFromError(error));
            }
        }

        dispose() {
            appViewManager.unSubscrible();
            appViewManager.unsubscribeForUpdateType(this, CloudExperienceHost.FrameViewModelUpdateType.Language);

            if (this._webViewCtrl) {
                WinJS.Utilities.empty(this._webViewCtrl);
            }

            let root = document.getElementById("_defaultRoot");
            if (root) {
                WinJS.Utilities.empty(root);
            }
        }

        setWebView(webViewCtrl) {
            this._webViewCtrl = webViewCtrl;
        }

        createWebView() {
            return this._webViewCtrl;
        }

        attachFooterWebView(parentElement) {
            if (!this._footerWebViewCtrl) {
                this._footerWebViewCtrl = document.createElement('x-ms-webview');
                this._footerWebViewCtrl.style.width = '100%';
                this._footerWebViewCtrl.style.height = '100%';
                this._footerWebViewCtrl.style.background = 'transparent';

                CloudExperienceHost.Discovery.getApiRules().done((rules) => {
                    let contractHandler = new CloudExperienceHost.ContractHandler(rules);
                    this._bridge = new CloudExperienceHost.Bridge(this._footerWebViewCtrl, contractHandler);
                    this._footerWebViewCtrl.navigate('ms-appx-web:///core/view/oobeLightFooterHost.html');

                    parentElement.appendChild(this._footerWebViewCtrl);
                });
            }
        }
        getView() {
            return document.getElementById('_view');
        }

        getContentViewBoundingRect() {
            return this.getView().getBoundingClientRect();
        }

        getChromeFooterOffset() {
            // The default frame doesn't have a chrome footer, so return 0,0
            return { x: 0, y: 0 };
        }

        update(updateType, completeDispatch, errorDispatch, updateTag) {
            let progressControl = document.getElementById("_progress");
            let progressText = document.getElementById("_progressText");
            let progressElement = document.getElementsByTagName("oobe-light-progress")[0];
            let view = this.getView();

            switch (updateType) {
                case CloudExperienceHost.FrameViewModelUpdateType.Progress:
                    
                    const displayStyle = "block";
                    document.querySelector(".content").classList.remove("dimmed");
                    progressElement.removeAttribute("aria-hidden");
                    progressControl.removeAttribute("aria-hidden");
                    progressText.removeAttribute("aria-hidden");

                    progressElement.style.display = displayStyle;

                    navManager.setDisableBackNavigation(true);

                    WinJS.UI.Animation.crossFade(progressElement, view).done(() => {
                        // We should serialize the hide/show transitions to avoid an earlier hide
                        // of the progress element stomping on a later show request, but since we don't,
                        // make sure we at least end up in the final desired state when the animation ends.
                        progressElement.style.display = displayStyle;
                        progressText.focus();

                        // Adjust the live text value so Narrator reads progress after three seconds
                        // and also on a loop every 30 seconds if progress continues to be up.
                        if (!this._progressTextTimerID) {
                            this._progressTextTimerID = setTimeout(function () {
                                progressText.textContent = progressText.textContent;
                            }, 3000);
                        }

                        if (!this._progressTextIntervalID) {
                            this._progressTextIntervalID = setInterval(function () {
                                progressText.textContent = progressText.textContent;
                            }, 30000);
                        }

                        completeDispatch();
                    }, errorDispatch);
                    

                    break;
                case CloudExperienceHost.FrameViewModelUpdateType.View:
                    
                    document.querySelector(".content").classList.remove("dimmed");
                    progressElement.setAttribute("aria-hidden", "true");
                    progressControl.setAttribute("aria-hidden", "true");
                    progressText.setAttribute("aria-hidden", "true");
                    

                    if (this._webViewCtrl) {
                        // Put the focus on the web view control on any show view 
                        // This will move focus from chrome elements into the page on navigation by voice/back button
                        this._webViewCtrl.focus();
                    }

                    if (this._progressTextTimerID) {
                        clearTimeout(this._progressTextTimerID);
                        this._progressTextTimerID = null;
                    }

                    if (this._progressTextIntervalID) {
                        clearInterval(this._progressTextIntervalID);
                        this._progressTextIntervalID = null;
                    }

                    
                    WinJS.UI.Animation.crossFade(view, progressElement).done(() => {
                        progressElement.style.display = "none"; // hide the progress element completely
                        completeDispatch();
                    }, errorDispatch);
                    

                    break;

                case CloudExperienceHost.FrameViewModelUpdateType.GraphicAnimation:
                    if (this._previousAnimationFile !== updateTag) {
                        this._previousAnimationFile = updateTag;

                        if (anims) {
                            exitAnim(anims[0]);
                        }
                        setTimeout(function () {
                            clearAnimation();
                            anims = null;
                            if (updateTag) {
                                var containers = document.querySelectorAll("#animation"); // Get all containers with animation ID
                                anims = loadAnims(containers, updateTag);
                            }
                        }, 800);
                    }
                    break;

                case CloudExperienceHost.FrameViewModelUpdateType.Dimmed:
                    // Dimming of frame not needed, as it's not currently in spec for the light frame
                    // However, if we receive a Dimmed update, progress timers should be cleared to prevent
                    // the progress text from grabbing Narrator focus.
                    if (this._progressTextTimerID) {
                        clearTimeout(this._progressTextTimerID);
                        this._progressTextTimerID = null;
                    }
                    progressText.blur();
                    completeDispatch();
                    break;
                case CloudExperienceHost.FrameViewModelUpdateType.Undimmed:
                    // Undimming of frame not needed, as there's no chrome
                    completeDispatch();
                    break;
            }
        }
    }
    return LiteFrameViewModel;
});

function clearAnimation() {
    if (thisAnim) {
        bodymovin.destroy(thisAnim.name);
        thisAnim = null;
    }
}

// Function to load all bodymovin animations and assign event listeners to each
function loadAnims(containerList, fileName) {
    let len = containerList.length,
        i = len,
        animList = [];

    for (i; i--;) {
        let idx = len - 1 - i,
            element = containerList[idx],
            file = fileName,
            name = file.replace(/$.json/, ""),
            params = {
                assetsPath: "../images/",
                container: element,
                renderer: "svg",
                name: name,
                loop: false,
                autoplay: false,
                path: "../images/" + file
            };
        thisAnim = bodymovin.loadAnimation(params);

        // Add events to this animation
        thisAnim.addEventListener('DOMLoaded', function () {
            parent = element.parentNode; // TODO: I think I might be able to just use container[idx]
            enterAnim(anims[idx], false);
            // Add event listeners to the container of this animation element
            // Mouse over event
            //            parent.addEventListener("mouseover", function () {
            //                enterAnim(anims[idx], false)
            //            }, false);
            //            // Mouse down event
            //            parent.addEventListener("mousedown", function () {
            //                playAnim(anims[idx], false)
            //            }, false);
        });
        animList.push(thisAnim); // Add the loaded animation to the animList array
    }
    return animList;
}

function enterAnim(anim, loop) {
    if (anim.isPaused) {
        anim.loop = loop;
        anim.playSegments([0, 120], true);
    }
}

function exitAnim(anim) {
    if (anim.isPaused) {
        anim.loop = false;
        anim.playSegments([180, 210], false);
    }
}

function pauseAnim(anim) {
    if (!anim.isPaused) {
        anim.loop = false;
    }
}
