import { useState } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { createEvent } from '../../lib/firestore/events';

export default function CreateEventScreen() {
  const router = useRouter();
  const { user } = useAuth();
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Event</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>
      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          <Text style={styles.label}>Event Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Christmas 2025"
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

        <Text style={styles.label}>Event Date (Optional)</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => {
            setTempDate(eventDate || new Date());
            setShowDatePicker(true);
          }}
        >
          <Text style={styles.dateButtonText}>
            {eventDate
              ? eventDate.toLocaleDateString()
              : 'Select a date'}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <View style={styles.datePickerContainer}>
            {Platform.OS === 'ios' && (
              <View style={styles.datePickerActions}>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.datePickerButton}
                >
                  <Text style={styles.datePickerButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmDate}
                  style={styles.datePickerButton}
                >
                  <Text style={[styles.datePickerButtonText, styles.datePickerButtonConfirm]}>
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
          </View>
        )}

        {eventDate && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setEventDate(null)}
          >
            <Text style={styles.clearButtonText}>Clear date</Text>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  clearButtonText: {
    color: '#007AFF',
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  datePickerButton: {
    padding: 8,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#007AFF',
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

