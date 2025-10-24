import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { posts } from '@/constants/content';
import { setUserSession, type UserSession } from '@/lib/user-session';

const THEME = {
  primary: '#6e0aa4',
  accent: '#240f2aff',
  muted: '#64748b',
  surface: '#ffffff',
  border: 'rgba(226,232,240,0.8)',
  backdrop: '#f4f6fb',
};

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyINN, setCompanyINN] = useState('');
  const [accountType, setAccountType] = useState<'user' | 'company'>('user');

  const isRegister = mode === 'register';
  const isCompany = accountType === 'company';

  const sampleFavorites = useMemo(() => posts.slice(0, 3).map(post => post.id), []);
  const sampleLiked = useMemo(() => posts.slice(1, 4).map(post => post.id), []);
  const sampleFollowing = useMemo(
    () =>
      posts.slice(0, 5).map(post => ({
        id: post.id,
        name: post.user,
        handle: post.userHandle,
        avatar: post.userAvatar,
        description: post.bio,
      })),
    []
  );

  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (!isRegister || (isCompany ? companyName.trim().length > 0 : name.trim().length > 0));

  const handleSubmit = () => {
    if (!canSubmit) {
      Alert.alert('Пожалуйста, заполните все поля', 'Укажите почту, пароль и имя, чтобы продолжить.');
      return;
    }

    Keyboard.dismiss();

    const primaryName =
      (isRegister ? (isCompany ? companyName.trim() : name.trim()) : name.trim()) ||
      email.trim().split('@')[0] ||
      'Гость';

    const normalizedHandle =
      email.trim().split('@')[0]?.replace(/[^a-z0-9_]/gi, '').toLowerCase() || `user${Date.now()}`;

    const session: UserSession = {
      id: `user-${Date.now()}`,
      name: primaryName,
      email: email.trim(),
      handle: normalizedHandle,
      avatar: `https://i.pravatar.cc/200?u=${encodeURIComponent(email.trim() || primaryName)}`,
      accountType,
      favorites: sampleFavorites,
      liked: sampleLiked,
      following: sampleFollowing,
    };

    setUserSession(session);
    router.replace('/profile');
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: mode === 'login' ? 'Вход в аккаунт' : 'Создать аккаунт',
          headerTransparent: true,
          headerTintColor: THEME.accent,
          headerBackTitle: 'Назад',
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Добро пожаловать!</Text>
            </View>

            <View style={styles.accountTypeWrapper}>
              <Text style={styles.accountTypeLabel}>
                {isRegister ? 'Тип аккаунта' : 'Войти как'}
              </Text>
              <View style={styles.accountTypeRow}>
                <TouchableOpacity
                  style={[styles.accountTypeChip, accountType === 'user' && styles.accountTypeChipActive]}
                  onPress={() => setAccountType('user')}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={accountType === 'user' ? 'person' : 'person-outline'}
                    size={16}
                    color={accountType === 'user' ? '#fff' : THEME.accent}
                  />
                  <Text
                    style={[
                      styles.accountTypeText,
                      accountType === 'user' && styles.accountTypeTextActive,
                    ]}
                  >
                    Пользователь
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.accountTypeChip, accountType === 'company' && styles.accountTypeChipActive]}
                  onPress={() => setAccountType('company')}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={accountType === 'company' ? 'business' : 'business-outline'}
                    size={16}
                    color={accountType === 'company' ? '#fff' : THEME.accent}
                  />
                  <Text
                    style={[
                      styles.accountTypeText,
                      accountType === 'company' && styles.accountTypeTextActive,
                    ]}
                  >
                    Юр. лицо
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {!isCompany && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Логин</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="TurboIvan2007"
                  style={styles.input}
                  placeholderTextColor={THEME.muted}
                />
              </View>
            )}

            {isRegister && isCompany && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Имя организации</Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder='ООО "Рога и Копыта"'
                  style={styles.input}
                  placeholderTextColor={THEME.muted}
                />
              </View>
            )}

            {isCompany && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>ИНН</Text>
                <TextInput
                  value={companyINN}
                  onChangeText={setCompanyINN}
                  placeholder='1234567890'
                  style={styles.input}
                  placeholderTextColor={THEME.muted}
                />
              </View>
            )}

            {isRegister && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ivanivanov2007@email.ru"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  placeholderTextColor={THEME.muted}
                />
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Пароль</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Введите пароль"
                secureTextEntry
                style={styles.input}
                placeholderTextColor={THEME.muted}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
              activeOpacity={0.55}
              onPress={handleSubmit}
            >
              <Text style={styles.primaryButtonText}>{isRegister ? 'Зарегистрироваться' : 'Войти'}</Text>
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <TouchableOpacity onPress={() => setMode(isRegister ? 'login' : 'register')}>
                <Text style={styles.switchLink}>{isRegister ? 'Войти' : 'Зарегистрироваться'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#351f3b',
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: THEME.surface,
    borderRadius: 26,
    padding: 26,
    gap: 16,
    shadowColor: '#cf3abb',
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    elevation: 16,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  avatarWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: THEME.accent,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: THEME.muted,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: THEME.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fbfcff',
    fontSize: 15,
    color: THEME.accent,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.primary,
  },
  primaryButton: {
    backgroundColor: THEME.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#b325ebff',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.border,
  },
  separatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.muted,
    textTransform: 'uppercase',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  switchLabel: {
    fontSize: 14,
    color: THEME.muted,
  },
  switchLink: {
    padding: 8,
    backgroundColor: THEME.primary,
    color: "#FFF",
    fontWeight: 600,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#b325ebff',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  accountTypeRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderRadius: 20,
    padding: 6,
  },
  accountTypeWrapper: {
    gap: 8,
  },
  accountTypeLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: THEME.accent,
    textTransform: 'uppercase',
  },
  accountTypeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  accountTypeChipActive: {
    backgroundColor: THEME.primary,
  },
  accountTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.accent,
  },
  accountTypeTextActive: {
    color: '#fff',
  },
});
