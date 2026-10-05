import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { empty, json, mockApi } from '../src/test/mockApi';

beforeEach(async () => {
  await Keychain.resetGenericPassword();
  mockApi({
    'GET /users/me': () => empty(401),
    'POST /auth/refresh': () => empty(401),
    'GET /auth/oauth/providers': () => json({ providers: [] }),
  });
});

afterEach(() => jest.restoreAllMocks());

describe('the documents', () => {
  it('opens the offer and the privacy policy of the site from the sign-in', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    render(<App store={makeStore()} />);
    fireEvent.press(await screen.findByRole('button', { name: 'У меня уже есть аккаунт' }));

    fireEvent.press(await screen.findByText('оферту'));
    expect(open).toHaveBeenLastCalledWith('http://10.0.2.2:5173/offer');
    fireEvent.press(screen.getByText('политику конфиденциальности'));
    expect(open).toHaveBeenLastCalledWith('http://10.0.2.2:5173/privacy');
  });
});
