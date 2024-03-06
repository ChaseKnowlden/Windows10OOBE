//
// Copyright (C) Microsoft. All rights reserved.
//

"use strict";

define([], () => {
    class bootstrapStatusSubcategoryViewModel {
        constructor(
            resourceStrings, // [optional] resource strings
            sessionUtilities, // [optional] session utilities
            id, // [mandatory] subcategory ID (not displayed)
            title, // [mandatory] Title is mandatory, even for silent subcategories.
            isParallelizableAction, // is subcategory action parallelizable with its immediate predecessor and successor?
            getDispositionAction, // callback returning subcategory's disposition (e.g., visible, silent, etc.)
            asyncAction) {  // subcategory action

            // Private member variables
            this.resourceStrings = resourceStrings;
            this.sessionUtilities = sessionUtilities;
            this.asyncAction = asyncAction;
            this.id = id;
            this.title = title;
            this.getDispositionAction = getDispositionAction;
            this.actionIsParallelizable = isParallelizableAction;
            this.actionResult = {
                actionSucceeded: false,
                statusMessage: null
            };
            this.asyncActionPromise = null;
            this.asyncActionPromiseCancelled = false;
            this.setSubcategoryStateCallbackAsync = null;

            let invalidParameter = null;
            if (null === title) {
                invalidParameter = "title";
            } else if (null === getDispositionAction) {
                invalidParameter = "getDispositionAction";
            } else if (null === asyncAction) {
                invalidParameter = "asyncAction";
            }

            if (invalidParameter !== null) {
                throw this.sessionUtilities.formatMessage(`Invalid value for bootstrapStatusSubcategoryViewModel constructor parameter '${invalidParameter}'.`);
            }
        }

        // bootstrapStatusSubcategoryViewModel interface methods

        getId() {
            return this.id;
        }

        getTitle() {
            return this.title;
        }

        isParallelizableAction() {
            return this.actionIsParallelizable;
        }

        setUiElement(uiElement) {
            this.uiElement = uiElement;
        }

        getUiElement() {
            return this.uiElement;
        }

        getActionResult() {
            return this.actionResult;
        }

        getDisposition() {
            return this.getDispositionAction();
        }

        startActionAsync(progressCallbackAsync, setSubcategoryStateCallbackAsync) {
            return new WinJS.Promise((completeDispatch, errorDispatch, progressDispatch) => {
                // Promise initialization handler

                return setSubcategoryStateCallbackAsync(this.sessionUtilities.SUBCATEGORY_STATE_IN_PROGRESS).then(() => {
                    this.asyncActionPromise = this.asyncAction(progressCallbackAsync);
                    return this.asyncActionPromise;
                }).then((result) => {
                    if (!this.asyncActionPromiseCancelled) {
                        return setSubcategoryStateCallbackAsync(result.actionResultState).then(() => {
                            this.actionResult = result;
                            completeDispatch(this.actionResult);

                            return WinJS.Promise.as(true);
                        });
                    }
                });
            },
            () => {
                this.asyncActionPromiseCancelled = true;

                this.actionResult = this.sessionUtilities.createActionResult(
                    this.sessionUtilities.SUBCATEGORY_STATE_FAILED,
                    this.resourceStrings["BootstrapPageStatusFailed"]);

                this.sessionUtilities.logInfoEvent(`Subcategory status: ${this.getTitle()} is cancelled.`);
                if (this.asyncActionPromise !== null) {
                    this.asyncActionPromise.cancel();
                }

                return setSubcategoryStateCallbackAsync(this.sessionUtilities.SUBCATEGORY_STATE_CANCELLED);
            });
        }
    }

    return bootstrapStatusSubcategoryViewModel;
});
