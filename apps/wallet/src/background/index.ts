// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { lte } from 'semver';
import Browser from 'webextension-polyfill';

import { LOCK_ALARM_NAME } from './Alarms';
import Permissions from './Permissions';
import { Connections } from './connections';
import Keyring from './keyring';
import { openInNewTab } from '_shared/utils';
import { MSG_CONNECT } from '_src/content-script/keep-bg-alive';

Browser.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
    if (reason === 'install') {
        openInNewTab();
    } else if (
        reason === 'update' &&
        previousVersion &&
        lte(previousVersion, '0.1.1')
    ) {
        // clear everything in the storage
        // mainly done to clear the mnemonic that was stored
        // as plain text
        await Browser.storage.local.clear();
    }
});

const connections = new Connections();

Permissions.permissionReply.subscribe((permission) => {
    if (permission) {
        connections.notifyForPermissionReply(permission);
    }
});

Keyring.on('lockedStatusUpdate', (isLocked: boolean) => {
    connections.notifyForLockedStatusUpdate(isLocked);
});

Browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === LOCK_ALARM_NAME) {
        Keyring.lock();
    }
});

Keyring.on('lockedStatusUpdate', async (isLocked) => {
    if (!isLocked) {
        const allTabs = await Browser.tabs.query({});
        for (const aTab of allTabs) {
            if (aTab.id) {
                try {
                    await Browser.tabs.sendMessage(aTab.id, MSG_CONNECT);
                } catch (e) {
                    // not all tabs have the cs installed
                }
            }
        }
    }
});
