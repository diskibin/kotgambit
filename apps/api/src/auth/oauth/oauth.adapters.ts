import type { OAuthProviderId } from '@kotgambit/contracts';
import type { AppConfig } from '../../config/config.module.js';
import { GoogleProvider } from './google.provider.js';
import type { OAuthAdapters, OAuthProviderAdapter } from './oauth-provider.js';
import { VkProvider } from './vk.provider.js';
import { YandexProvider } from './yandex.provider.js';

/** An adapter exists only for a provider whose keys are set, so the rest answer 404 and get no button. */
export function buildAdapters({ oauth }: Pick<AppConfig, 'oauth'>): OAuthAdapters {
  const adapters = new Map<OAuthProviderId, OAuthProviderAdapter>();
  if (oauth.google) adapters.set('google', new GoogleProvider(oauth.google));
  if (oauth.yandex) adapters.set('yandex', new YandexProvider(oauth.yandex));
  if (oauth.vk) adapters.set('vk', new VkProvider(oauth.vk));
  return adapters;
}
