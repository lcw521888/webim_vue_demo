import { imConnectListener } from './imConnectListener';
import { imReviceMessageListener } from './imReciveMessageListener';
import { imPresenceListener } from './imPresenceListener';
import { imContactListener } from './imContactListener';
import { imGroupListener } from './imGroupListener';
import { imReadAckListener } from './imReadAckListener';
import { imMultiDeviceListener } from './imMultiDeviceListener';
/* mount all listener */
export const mountAllEMListener = () => {
  const { mountConnectEventListener } = imConnectListener();
  mountConnectEventListener();
  const { mountPresenceEventListener } = imPresenceListener();
  mountPresenceEventListener();
  const { mountReviceMessageEventListener } = imReviceMessageListener();
  mountReviceMessageEventListener();
  const { mountContactEventListener } = imContactListener();
  mountContactEventListener();
  const { mountGroupEventListener } = imGroupListener();
  mountGroupEventListener();
  const { mountReadAckEventListener } = imReadAckListener();
  mountReadAckEventListener();
  const { mountMultiDeviceEventListener } = imMultiDeviceListener();
  mountMultiDeviceEventListener();
};
export {
  imConnectListener,
  imPresenceListener,
  imReviceMessageListener,
  imContactListener,
  imGroupListener,
  imReadAckListener,
  imMultiDeviceListener,
};
