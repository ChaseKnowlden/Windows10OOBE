//
// Copyright (C) Microsoft. All rights reserved.
//
/// <disable>JS2085.EnableStrictMode</disable>
/// <reference path="error.ts" />
"use strict";
var CloudExperienceHost;
(function (CloudExperienceHost) {
    (function (ReconnectFrequency) {
        ReconnectFrequency[ReconnectFrequency["Never"] = 0] = "Never";
        ReconnectFrequency[ReconnectFrequency["Once"] = 1] = "Once";
        ReconnectFrequency[ReconnectFrequency["Always"] = 2] = "Always";
    })(CloudExperienceHost.ReconnectFrequency || (CloudExperienceHost.ReconnectFrequency = {}));
    var ReconnectFrequency = CloudExperienceHost.ReconnectFrequency;
    class CloudOverride {
        static getUrl(cloudOverride, target) {
            if (cloudOverride) {
                if ((cloudOverride.urlInt !== undefined) && (target == CloudExperienceHost.TargetEnvironment.INT)) {
                    return cloudOverride.urlInt;
                }
                else if (cloudOverride.url !== undefined) {
                    return cloudOverride.url;
                }
            }
            return undefined;
        }
    }
    CloudExperienceHost.CloudOverride = CloudOverride;
    class NavMesh {
        constructor(mesh, uriArguments) {
            this._mesh = mesh;
            this._uriArguments = uriArguments;
        }
        getStart() {
            return this.getNode(this._mesh.start);
        }
        getNode(cxid) {
            var node = this._mesh[cxid];
            return node;
        }
        addOrUpdateNode(node) {
            this._mesh[node.cxid] = node;
        }
        getErrorNode() {
            return this.getNode(this._mesh.error);
        }
        getErrorNodeName() {
            return this._mesh.error;
        }
        getNotifyOnFirstVisible() {
            return this._mesh.notifyOnFirstVisible;
        }
        getNotifyOnLastFinished() {
            // getNotifyOnLastFinished could be called when closing CXH before the mesh object is created
            return (this._mesh != null) && this._mesh.notifyOnLastFinished;
        }
        getMsaTicketContext() {
            return this._mesh.msaTicketContext;
        }
        getUriArguments() {
            return this._uriArguments;
        }
        getFrameName() {
            return this._mesh.frameName;
        }
        getInitializeExternalModalRects() {
            return this._mesh.initializeExternalModalRects;
        }
        getPersonality() {
            return this._mesh.personality ? this._mesh.personality : "CloudExperienceHost.Personality.Unspecified";
        }
        getInclusive() {
            return (this._mesh.speechCapable ? 1 : 0);
        }
        getSpeechDisabled() {
            return this._mesh.speechDisabled ? true : false;
        }
        blockLateWebAppCalls() {
            return this._mesh.blockLateWebAppCalls ? true : false;
        }
        blockEarlyExit() {
            return this._mesh.blockEarlyExit ? true : false;
        }
        checkpointsEnabled() {
            return this._mesh.checkpointsEnabled ? true : false;
        }
        isBackstackForBackNavigationSupported() {
            return this._mesh.useBackstackForBackNavigation;
        }
        isCloseToExitCxhSupported() {
            return this._mesh.useCloseToExitCxh;
        }
        getReconnectHandler() {
            return this._mesh.reconnectHandler ? this._mesh.reconnectHandler : null;
        }
        getScenarioCustomHeaders() {
            return this._mesh.scenarioCustomHeaders ? this._mesh.scenarioCustomHeaders : [];
        }
        getRestrictNavigationToAllowList() {
            return this._mesh.restrictNavigationToAllowList ? true : false;
        }
    }
    CloudExperienceHost.NavMesh = NavMesh;
})(CloudExperienceHost || (CloudExperienceHost = {}));
//# sourceMappingURL=navmesh.js.map