import {
  DEFAULT_EASEMOB_APPKEY,
  DEFAULT_EASEMOB_REST_URL,
  DEFAULT_EASEMOB_SOCKET_URL,
} from '@/IM/config';

export const IM_ENVIRONMENTS = {
  TKE: 'TKE',
  DEV: 'DEV',
  NGI: 'NGI',
};

export const IM_ENV_OPTIONS = [
  { label: 'TKE', value: IM_ENVIRONMENTS.TKE },
  { label: 'DEV', value: IM_ENVIRONMENTS.DEV },
  { label: 'NGI', value: IM_ENVIRONMENTS.NGI },
];

const BASE_ENV_CONFIG = {
  environment: IM_ENVIRONMENTS.NGI,
  appKey: DEFAULT_EASEMOB_APPKEY,
  isPrivate: false,
  imServer: '',
  port: '',
  restServer: '',
};

const PRIVATE_ENV_DEFAULTS = {
  appKey: DEFAULT_EASEMOB_APPKEY,
  isPrivate: true,
  imServer: DEFAULT_EASEMOB_SOCKET_URL,
  port: '',
  restServer: DEFAULT_EASEMOB_REST_URL,
};

const ENV_PRIVATE_CONFIGS = {
  [IM_ENVIRONMENTS.TKE]: {
    appKey: 'easemob-demo#qatkeflink',
    restServer: 'https://tke-sdb-a1.easemob.com',
    imServer: 'tke-sdb-im-api-wechat.easemob.com/websocket',
  },
  [IM_ENVIRONMENTS.DEV]: {
    appKey: 'easemob-demo#sdk111',
    restServer: 'https://a1-hsb.easemob.com',
    imServer: 'im-api-new-hsb.easemob.com/websocket',
  },
};

export function createImEnvironmentConfig(environment) {
  const env = environment || IM_ENVIRONMENTS.NGI;

  if (env === IM_ENVIRONMENTS.NGI) {
    return {
      ...BASE_ENV_CONFIG,
      environment: IM_ENVIRONMENTS.NGI,
      isPrivate: false,
    };
  }

  return {
    ...BASE_ENV_CONFIG,
    ...PRIVATE_ENV_DEFAULTS,
    ...ENV_PRIVATE_CONFIGS[env],
    environment: env,
  };
}

export function normalizeImEnvironmentConfig(config = {}) {
  const environment = config.environment || IM_ENVIRONMENTS.NGI;
  return {
    ...createImEnvironmentConfig(environment),
    ...config,
    environment,
    isPrivate:
      environment === IM_ENVIRONMENTS.NGI ? false : config.isPrivate ?? true,
  };
}
