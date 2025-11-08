import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Event, subscribeToEventsForUser } from '../../lib/firestore/events';
import { getColors } from '../../lib/theme';

export default function EventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const unsubscribe = subscribeToEventsForUser(
      user.uid,
      (updatedEvents) => {
        setEvents(updatedEvents);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error loading events:', err);
        setError(err.message || 'Failed to load events');
        setEvents([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const renderEvent = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={[styles.eventCard, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/events/${item.id}`)}
    >
      <Text style={[styles.eventName, { color: colors.text }]}>{item.name}</Text>
      <Text style={[styles.eventDate, { color: colors.textSecondary }]}>
        {item.eventDate
          ? new Date(item.eventDate.seconds * 1000).toLocaleDateString()
          : 'No date set'}
      </Text>
      <Text style={[styles.eventMembers, { color: colors.textTertiary }]}>
        {item.members?.length || 0} member{item.members?.length !== 1 ? 's' : ''}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>My Events</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/events/create')}
        >
          <Text style={styles.addButtonText}>+ New Event</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={{ color: colors.text }}>Loading events...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.error }]}>Error: {error}</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Please check your connection and try again.
          </Text>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No events yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
            Create your first event to get started!
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  eventCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  eventName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    marginBottom: 4,
  },
  eventMembers: {
    fontSize: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 8,
    fontWeight: '600',
  },
});

