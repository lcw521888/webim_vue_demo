import {
  IM_ENVIRONMENTS,
  IM_ENV_OPTIONS,
  normalizeImEnvironmentConfig,
} from '@/views/Login/components/CustomImConfig/imEnvPresets';
import {
  DEFAULT_EASEMOB_APPKEY,
  DEFAULT_EASEMOB_REST_URL,
  DEFAULT_EASEMOB_SOCKET_URL,
  fixRestUrl,
  fixSocketUrl,
} from '@/IM/config';

function parseJSONSafe(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getEnvironmentLabel(environment) {
  return (
    IM_ENV_OPTIONS.find((item) => item.value === environment)?.label ||
    environment ||
    IM_ENVIRONMENTS.NGI
  );
}

export function getCurrentImEnvironmentInfo() {
  const savedConfig =
    typeof window === 'undefined'
      ? {}
      : parseJSONSafe(window.localStorage.getItem('webimConfig'), {});
  const normalizedConfig = normalizeImEnvironmentConfig(savedConfig);
  const environment = normalizedConfig.environment || IM_ENVIRONMENTS.NGI;
  const isCustomConfigEnabled =
    typeof window !== 'undefined' &&
    parseJSONSafe(
      window.localStorage.getItem('IM_IS_OPEN_CUSTOM_SERVER_CONFIG'),
      false,
    );

  return {
    environment,
    label: getEnvironmentLabel(environment),
    appKey: normalizedConfig.appKey || DEFAULT_EASEMOB_APPKEY,
    apiUrl: normalizedConfig.restServer
      ? fixRestUrl(normalizedConfig.restServer)
      : fixRestUrl(DEFAULT_EASEMOB_REST_URL),
    socketUrl: normalizedConfig.imServer
      ? fixSocketUrl(normalizedConfig.imServer)
      : fixSocketUrl(DEFAULT_EASEMOB_SOCKET_URL),
    isPrivate: normalizedConfig.isPrivate === true,
    isCustomConfigEnabled: isCustomConfigEnabled === true,
  };
}
