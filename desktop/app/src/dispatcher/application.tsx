/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

// Fine for app startup.
// eslint-disable-next-line flipper/no-electron-remote-imports
import {remote, ipcRenderer, IpcRendererEvent} from 'electron';
import {Store} from '../reducers/index';
import {Logger} from 'flipper-common';
import {
  importFileToStore,
  IMPORT_FLIPPER_TRACE_EVENT,
} from '../utils/exportData';
import {tryCatchReportPlatformFailures} from 'flipper-common';
import {handleDeeplink} from '../deeplink';
import {Dialog} from 'flipper-plugin';

export default (store: Store, logger: Logger) => {
  const currentWindow = remote.getCurrentWindow();
  const onFocus = () => {
    setImmediate(() => {
      store.dispatch({
        type: 'windowIsFocused',
        payload: {isFocused: true, time: Date.now()},
      });
    });
  };
  const onBlur = () => {
    setImmediate(() => {
      store.dispatch({
        type: 'windowIsFocused',
        payload: {isFocused: false, time: Date.now()},
      });
    });
  };
  currentWindow.on('focus', onFocus);
  currentWindow.on('blur', onBlur);
  window.addEventListener('beforeunload', () => {
    currentWindow.removeListener('focus', onFocus);
    currentWindow.removeListener('blur', onBlur);
  });

  // windowIsFocussed is initialized in the store before the app is fully ready.
  // So wait until everything is up and running and then check and set the isFocussed state.
  window.addEventListener('flipper-store-ready', () => {
    const isFocused = remote.getCurrentWindow().isFocused();
    store.dispatch({
      type: 'windowIsFocused',
      payload: {isFocused: isFocused, time: Date.now()},
    });
  });

  ipcRenderer.on(
    'flipper-protocol-handler',
    (_event: IpcRendererEvent, query: string) => {
      handleDeeplink(store, logger, query).catch((e) => {
        console.warn('Failed to handle deeplink', query, e);
        Dialog.alert({
          title: 'Failed to open deeplink',
          type: 'error',
          message: `Failed to handle deeplink '${query}': ${
            e.message ?? e.toString()
          }`,
        });
      });
    },
  );

  ipcRenderer.on(
    'open-flipper-file',
    (_event: IpcRendererEvent, url: string) => {
      tryCatchReportPlatformFailures(() => {
        return importFileToStore(url, store);
      }, `${IMPORT_FLIPPER_TRACE_EVENT}:Deeplink`);
    },
  );
};
