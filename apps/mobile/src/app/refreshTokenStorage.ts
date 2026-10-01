import * as Keychain from 'react-native-keychain';

const SERVICE = 'kotgambit.refresh-token';
// Keychain stores a login/password pair, only the password is the secret here
const USERNAME = 'refresh-token';

/** The refresh token lives in the Android Keystore through Keychain, never in AsyncStorage or the store. */
export async function getRefreshToken(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: SERVICE });
  return credentials ? credentials.password : null;
}

export async function saveRefreshToken(token: string): Promise<void> {
  await Keychain.setGenericPassword(USERNAME, token, { service: SERVICE });
}

export async function clearRefreshToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
