import type { CheckoutResponse } from '@kotgambit/contracts';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { CloseIcon } from '../../shared/ui/icons';
import { IconButton } from '../../shared/ui/IconButton';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, shashka, size, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';
import { classifyNavigation, isPaymentPageUrl, isReturnUrl } from './paymentUrls';

const HEADER = 56;
const CAT = 110;

interface CheckoutScreenProps {
  checkout: CheckoutResponse;
  /** The learner is back on our page, or says they paid: the server is asked what became of the payment. */
  onReturn: () => void;
  onClose: () => void;
}

/**
 * The payment page of the provider inside our frame. The card is typed on the provider's page, the app never
 * sees it. Nothing here confirms a payment: coming back only makes the app ask the server (PLAN.md 6.8).
 */
export function CheckoutScreen({ checkout, onReturn, onClose }: CheckoutScreenProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const web = useRef<WebView<unknown>>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [bank, setBank] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  // A page that is not the provider's is never loaded, whatever the server was told to send
  const trusted = isPaymentPageUrl(checkout.confirmationUrl);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setExitOpen(true);
      return true;
    });
    return () => subscription.remove();
  }, []);

  const openInBrowser = () => {
    setMenuOpen(false);
    void Linking.openURL(checkout.confirmationUrl).catch(() => setFailed(true));
  };

  function handleRequest(request: { url: string }): boolean {
    const navigation = classifyNavigation(request.url, checkout.returnUrl);
    if (navigation.kind === 'load') return true;
    if (navigation.kind === 'return') {
      onReturn();
      return false;
    }
    if (navigation.kind === 'external') {
      // Banks and the SBP open their own apps. If none answers the page the bank gave is opened in the browser
      void Linking.openURL(navigation.url)
        .then(() => setBank(true))
        .catch(() => {
          if (navigation.fallback) void Linking.openURL(navigation.fallback);
          else setFailed(true);
        });
    }
    return false;
  }

  const hostLine = (() => {
    try {
      return new URL(checkout.confirmationUrl).hostname;
    } catch {
      return '';
    }
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          height: HEADER,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          paddingHorizontal: space[2],
          backgroundColor: colors.surface,
          borderBottomWidth: 2,
          borderBottomColor: colors.line,
        }}
      >
        <IconButton quiet label={t('premium.close')} onPress={() => setExitOpen(true)}>
          <CloseIcon color={colors.text} />
        </IconButton>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[typography.h3, { color: colors.text }]}>
            {t('billing.pay.title')}
          </Text>
          <Text style={[typography.caption, { color: colors.text2 }]}>{`🔒 ${hostLine}`}</Text>
        </View>
        <IconButton quiet label={t('billing.pay.menu')} onPress={() => setMenuOpen(true)}>
          <Text style={[typography.h2, { color: colors.text }]}>⋮</Text>
        </IconButton>
      </View>
      {loading && !failed && <View style={{ height: 3, backgroundColor: colors.brand }} />}

      {!trusted || failed ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[3],
            padding: screenPadding,
          }}
        >
          <Mascot mood="oops" size={CAT} dark={scheme === 'dark'} />
          <Text
            accessibilityRole="header"
            style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
          >
            {t('billing.pay.error.title')}
          </Text>
          <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
            {t('billing.pay.error.text')}
          </Text>
          {trusted && (
            <Button
              label={t('billing.pay.error.retry')}
              onPress={() => {
                setFailed(false);
                setLoading(true);
                web.current?.reload();
              }}
            />
          )}
          {trusted && (
            <Button
              variant="secondary"
              label={t('billing.pay.openBrowser')}
              onPress={openInBrowser}
            />
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* The type parameter works around the library's default, which makes every prop `never` */}
          <WebView<unknown>
            ref={web}
            source={{ uri: checkout.confirmationUrl }}
            // Only https is loaded. Banks' own apps are opened by `handleRequest`, never by the page
            originWhitelist={['https://*']}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess={false}
            allowUniversalAccessFromFileURLs={false}
            allowFileAccessFromFileURLs={false}
            mixedContentMode="never"
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={handleRequest}
            // Android does not ask `onShouldStartLoadWithRequest` about every redirect, so the address is also watched here
            onNavigationStateChange={(navigation: WebViewNavigation) => {
              if (isReturnUrl(navigation.url, checkout.returnUrl)) onReturn();
            }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
          />
          {loading && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                alignItems: 'center',
                gap: space[2],
                padding: space[4],
                backgroundColor: colors.bg,
              }}
            >
              <Mascot mood="thinking" size={CAT} dark={scheme === 'dark'} animate />
              <Text style={[typography.h3, { color: colors.text }]}>
                {t('billing.pay.loading')}
              </Text>
              <Text style={[typography.small, { color: colors.text2, textAlign: 'center' }]}>
                {t('billing.pay.loadingText')}
              </Text>
            </View>
          )}
        </View>
      )}

      {bank && (
        <View
          style={{
            gap: space[2],
            margin: screenPadding,
            marginBottom: insets.bottom + screenPadding,
            padding: space[4],
            borderRadius: radius.card,
            borderWidth: shashka.border,
            borderColor: colors.edge,
            backgroundColor: colors.skyTint,
          }}
        >
          <Text accessibilityRole="header" style={[typography.h3, { color: colors.skyText }]}>
            {t('billing.pay.bank.title')}
          </Text>
          <Text style={[typography.small, { color: colors.text }]}>
            {t('billing.pay.bank.text')}
          </Text>
          <Button label={t('billing.pay.bank.paid')} onPress={onReturn} />
          <Button
            variant="secondary"
            label={t('billing.pay.bank.other')}
            onPress={() => setBank(false)}
          />
        </View>
      )}

      {menuOpen && (
        <BottomSheet label={t('billing.pay.menu')} onClose={() => setMenuOpen(false)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('billing.pay.openBrowser')}
            onPress={openInBrowser}
            style={{ minHeight: size.tapMin, alignSelf: 'stretch', justifyContent: 'center' }}
          >
            <Text style={[typography.button, { color: colors.text }]}>
              {t('billing.pay.openBrowser')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('billing.pay.reload')}
            onPress={() => {
              setMenuOpen(false);
              setFailed(false);
              web.current?.reload();
            }}
            style={{ minHeight: size.tapMin, alignSelf: 'stretch', justifyContent: 'center' }}
          >
            <Text style={[typography.button, { color: colors.text }]}>
              {t('billing.pay.reload')}
            </Text>
          </Pressable>
        </BottomSheet>
      )}

      {exitOpen && (
        <BottomSheet label={t('billing.pay.exit.title')} onClose={() => setExitOpen(false)}>
          <Mascot mood="oops" size={72} dark={scheme === 'dark'} />
          <Text
            accessibilityRole="header"
            style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
          >
            {t('billing.pay.exit.title')}
          </Text>
          <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
            {t('billing.pay.exit.text')}
          </Text>
          <Button large label={t('billing.pay.exit.stay')} onPress={() => setExitOpen(false)} />
          <Button variant="danger" label={t('billing.pay.exit.leave')} onPress={onClose} />
        </BottomSheet>
      )}
    </View>
  );
}
