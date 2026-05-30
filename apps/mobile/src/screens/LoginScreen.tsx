import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';

import { resolveApiErrorMessage, SUPPORTED_LOCALES, type SupportedLocale } from '@logx/i18n';

import { apiClient } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useLocaleStore } from '../stores/localeStore';

interface Props {
  onLogin: () => void;
}

const localeLabels: Record<SupportedLocale, string> = {
  pt: 'PT',
  es: 'ES',
  en: 'EN',
};

export function LoginScreen({ onLogin }: Props) {
  const { t } = useTranslation();
  const { setAuth } = useAuthStore();
  const { locale, setLocale } = useLocaleStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.errorGeneric'), t('auth.enterEmailPassword'));
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { accessToken, user } = res.data.data;

      await SecureStore.setItemAsync('accessToken', accessToken);
      setAuth(user, accessToken);
      onLogin();
    } catch (err) {
      const axiosErr = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const message = axiosErr.response?.data
        ? resolveApiErrorMessage(axiosErr.response.data, locale)
        : t('auth.invalidCredentials');
      Alert.alert(t('mobile.loginFailed'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.localeRow}>
        {SUPPORTED_LOCALES.map((loc) => (
          <TouchableOpacity
            key={loc}
            style={[styles.localeBtn, locale === loc && styles.localeBtnActive]}
            onPress={() => void setLocale(loc)}
          >
            <Text style={[styles.localeBtnText, locale === loc && styles.localeBtnTextActive]}>
              {localeLabels[loc]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.card}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>L</Text>
          </View>
          <Text style={styles.appName}>{t('common.appName')}</Text>
          <Text style={styles.appSubtitle}>{t('mobile.driverApp')}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="driver@company.com"
            placeholderTextColor="#9ca3af"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  localeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  localeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  localeBtnActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  localeBtnText: {
    color: '#bfdbfe',
    fontWeight: '700',
    fontSize: 12,
  },
  localeBtnTextActive: {
    color: '#1e3a8a',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  appSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  form: {},
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
