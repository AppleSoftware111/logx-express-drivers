import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiClient } from '../services/api';
import { getCurrentLocation } from '../services/gpsService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const getPodDraftKey = (executionId: string, stopId: string) => `podDraft:${executionId}:${stopId}`;

interface Props {
  executionId: string;
  stopId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PODCaptureScreen({ executionId, stopId, onSuccess, onCancel }: Props) {
  const { t } = useTranslation();
  const { isOnline } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'idle' | 'camera'>('idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(getPodDraftKey(executionId, stopId));
      if (!raw) return;

      try {
        const draft = JSON.parse(raw) as {
          photoUri?: string | null;
          receiverName?: string;
          notes?: string;
        };
        setPhotoUri(draft.photoUri ?? null);
        setReceiverName(draft.receiverName ?? '');
        setNotes(draft.notes ?? '');
      } catch {
        // Ignore invalid persisted drafts.
      }
    })();
  }, [executionId, stopId]);

  useEffect(() => {
    void AsyncStorage.setItem(
      getPodDraftKey(executionId, stopId),
      JSON.stringify({ photoUri, receiverName, notes })
    );
  }, [executionId, stopId, photoUri, receiverName, notes]);

  const takePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(t('common.errorTitle'), t('mobile.cameraPermissionDenied'));
      }
      return;
    }
    setMode('camera');
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) {
      setPhotoUri(photo.uri);
      setMode('idle');
    }
  };

  const handleSubmit = async () => {
    if (!isOnline) {
      Alert.alert(t('common.errorTitle'), t('mobile.offlinePodSubmit'));
      return;
    }

    if (!photoUri && !receiverName.trim()) {
      Alert.alert(t('common.errorTitle'), t('mobile.podValidation'));
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();

      if (photoUri) {
        const fileInfo = await FileSystem.getInfoAsync(photoUri);
        if (fileInfo.exists) {
          formData.append('photo', {
            uri: photoUri,
            type: 'image/jpeg',
            name: 'pod-photo.jpg',
          } as unknown as Blob);
        }
      }

      if (receiverName) formData.append('receiverName', receiverName);
      if (notes) formData.append('deliveryNotes', notes);

      if (photoUri) {
        await apiClient.post(`/pod/${executionId}/stops/${stopId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Complete the stop
      const currentLocation = await getCurrentLocation();
      await apiClient.post(`/executions/${executionId}/stops/${stopId}/complete`, {
        receiverName,
        deliveryNotes: notes,
        deliveryLat: currentLocation?.coords.latitude,
        deliveryLng: currentLocation?.coords.longitude,
      });

      await AsyncStorage.removeItem(getPodDraftKey(executionId, stopId));

      Alert.alert(t('common.successSaved'), t('mobile.podSuccess'), [
        { text: 'OK', onPress: onSuccess },
      ]);
    } catch (err) {
      Alert.alert(t('common.errorTitle'), t('mobile.podSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'camera') {
    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.captureBtn} onPress={capturePhoto} />
            <TouchableOpacity style={styles.cancelCameraBtn} onPress={() => setMode('idle')}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>{t('mobile.proofOfDelivery')}</Text>
        <Text style={styles.subtitle}>{t('mobile.captureReceiverInfo')}</Text>
      </View>

      {!isOnline && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningBannerText}>{t('mobile.offlinePodSubmit')}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('common.photo')}</Text>
        {photoUri ? (
          <View>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <TouchableOpacity
              style={[styles.btn, { marginTop: 8 }]}
              onPress={() => setPhotoUri(null)}
            >
              <Text style={styles.btnText}>{t('mobile.retakePhoto')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.photoBtn]} onPress={takePhoto}>
            <Text style={[styles.btnText, { color: '#2563eb' }]}>📷 {t('mobile.takePhoto')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('mobile.receiverInformation')}</Text>

        <Text style={styles.fieldLabel}>{t('mobile.receiverName')}</Text>
        <TextInput
          style={styles.input}
          value={receiverName}
          onChangeText={setReceiverName}
          placeholder={t('mobile.receiverNamePlaceholder')}
          placeholderTextColor="#9ca3af"
        />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t('common.notes')}</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('mobile.notesPlaceholder')}
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>✅ {t('mobile.completeStop')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#16a34a',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#bbf7d0',
    marginTop: 4,
  },
  warningBanner: {
    margin: 12,
    marginBottom: 0,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  warningBannerText: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  btn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  photoBtn: {
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    backgroundColor: '#eff6ff',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: 32,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  cameraControls: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 48,
    gap: 16,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cancelCameraBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
  },
});
