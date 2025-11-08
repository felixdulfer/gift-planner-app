import { useState, createElement } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  useColorScheme,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { createEvent } from '../../lib/firestore/events';
import { getColors } from '../../lib/theme';

export default function CreateEventScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const [tempDate, setTempDate] = useState<Date>(new Date());

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate) {
        setEventDate(selectedDate);
      }
    } else {
      // iOS: update temp date as user scrolls
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleConfirmDate = () => {
    setEventDate(tempDate);
    setShowDatePicker(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an event name');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to create an event');
      return;
    }

    setLoading(true);
    try {
      const eventId = await createEvent(name.trim(), user.uid, eventDate || undefined);
      router.replace(`/events/${eventId}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Event</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>
      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Event Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.borderLight, color: colors.text }]}
            placeholder="e.g., Christmas 2025"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

        <Text style={[styles.label, { color: colors.text }]}>Event Date (Optional)</Text>
        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          onPress={() => {
            setTempDate(eventDate || new Date());
            setShowDatePicker(true);
          }}
        >
          <Text style={[styles.dateButtonText, { color: colors.text }]}>
            {eventDate
              ? eventDate.toLocaleDateString()
              : 'Select a date'}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <View style={styles.datePickerContainer}>
            {Platform.OS === 'web' ? (
              createElement('input', {
                type: 'date',
                value: tempDate.toISOString().split('T')[0],
                min: new Date().toISOString().split('T')[0],
                onChange: (e: any) => {
                  if (e.target.value) {
                    const selectedDate = new Date(e.target.value + 'T00:00:00');
                    setTempDate(selectedDate);
                    setEventDate(selectedDate);
                    setShowDatePicker(false);
                  }
                },
                style: {
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: `1px solid ${colors.borderLight}`,
                  borderRadius: '8px',
                  backgroundColor: colors.surface,
                  color: colors.text,
                  cursor: 'pointer',
                },
              })
            ) : (
              <>
                {Platform.OS === 'ios' && (
                  <View style={[styles.datePickerActions, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(false)}
                      style={styles.datePickerButton}
                    >
                      <Text style={[styles.datePickerButtonText, { color: colors.primary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleConfirmDate}
                      style={styles.datePickerButton}
                    >
                      <Text style={[styles.datePickerButtonText, styles.datePickerButtonConfirm, { color: colors.primary }]}>
                        Confirm
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                />
              </>
            )}
          </View>
        )}

        {eventDate && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setEventDate(null)}
          >
            <Text style={[styles.clearButtonText, { color: colors.primary }]}>Clear date</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Event</Text>
          )}
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  backButtonPlaceholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  dateButtonText: {
    fontSize: 16,
  },
  clearButton: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  clearButtonText: {
    fontSize: 14,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
  },
  datePickerButton: {
    padding: 8,
  },
  datePickerButtonText: {
    fontSize: 16,
  },
  datePickerButtonConfirm: {
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

