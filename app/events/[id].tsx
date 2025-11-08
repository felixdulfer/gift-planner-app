import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getUserData, UserData } from '../../lib/auth';
import {
    deleteEvent,
    Event,
    inviteUserToEvent,
    removeMemberFromEvent,
    subscribeToEvent,
} from '../../lib/firestore/events';

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [members, setMembers] = useState<Map<string, UserData>>(new Map());

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const unsubscribe = subscribeToEvent(id, (eventData) => {
      setEvent(eventData);
      
      // Load member details when event updates
      if (eventData?.members) {
        loadMemberDetails(eventData.members);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const loadMemberDetails = async (memberIds: string[]) => {
    const memberMap = new Map<string, UserData>();
    for (const memberId of memberIds) {
      try {
        const userData = await getUserData(memberId);
        if (userData) {
          memberMap.set(memberId, userData);
        }
      } catch (error) {
        console.error(`Error loading user ${memberId}:`, error);
      }
    }
    setMembers(memberMap);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !user || !id) return;

    setInviting(true);
    try {
      await inviteUserToEvent(id, inviteEmail.trim(), user.uid);
      if (Platform.OS === 'web') {
        window.alert('Success: Invitation sent!');
      } else {
        Alert.alert('Success', 'Invitation sent!');
      }
      setInviteEmail('');
    } catch (error: any) {
      if (Platform.OS === 'web') {
        window.alert(`Error: ${error.message}`);
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to delete this event?'
      );
      if (confirmed) {
        try {
          await deleteEvent(id);
          router.back();
        } catch (error: any) {
          window.alert(`Error: ${error.message}`);
        }
      }
    } else {
      Alert.alert(
        'Delete Event',
        'Are you sure you want to delete this event?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteEvent(id);
                router.back();
              } catch (error: any) {
                Alert.alert('Error', error.message);
              }
            },
          },
        ]
      );
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!id) return;

    const memberData = members.get(memberId);
    const memberName = memberData?.displayName || memberData?.email || 'this member';

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Are you sure you want to remove ${memberName} from this event?`
      );
      if (confirmed) {
        try {
          await removeMemberFromEvent(id, memberId);
        } catch (error: any) {
          window.alert(`Error: ${error.message}`);
        }
      }
    } else {
      Alert.alert(
        'Remove Member',
        `Are you sure you want to remove ${memberName} from this event?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeMemberFromEvent(id, memberId);
              } catch (error: any) {
                Alert.alert('Error', error.message);
              }
            },
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text>Event not found</Text>
      </View>
    );
  }

  const isCreator = event.createdBy === user?.uid;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.eventName}>{event.name}</Text>
            {event.eventDate && (
              <Text style={styles.eventDate}>
                {new Date(event.eventDate.seconds * 1000).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>
      </View>
      <ScrollView>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members ({event.members?.length || 0})</Text>
        <View style={styles.membersList}>
          {event.members?.map((memberId) => {
            const memberData = members.get(memberId);
            const canRemove = isCreator && memberId !== event.createdBy;
            return (
              <View key={memberId} style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {memberData?.displayName || 'Loading...'}
                  </Text>
                  <Text style={styles.memberEmail}>
                    {memberData?.email || memberId}
                  </Text>
                </View>
                {canRemove && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveMember(memberId)}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {isCreator && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite User</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.inviteInput}
              placeholder="Email address"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.inviteButton, inviting && styles.buttonDisabled]}
              onPress={handleInvite}
              disabled={inviting}
            >
              {inviting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.inviteButtonText}>Invite</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {event.invitations?.filter((inv) => inv.status === 'pending').length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Invitations</Text>
          {event.invitations
            ?.filter((inv) => inv.status === 'pending')
            .map((inv, index) => (
              <View key={index} style={styles.invitationItem}>
                <Text style={styles.invitationEmail}>{inv.email}</Text>
                <Text style={styles.invitationStatus}>{inv.status}</Text>
              </View>
            ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/events/${id}/wishlists`)}
        >
          <Text style={styles.actionButtonText}>View Wishlists</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/events/${id}/assignments`)}
        >
          <Text style={styles.actionButtonText}>View Assignments</Text>
        </TouchableOpacity>

        {isCreator && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>Delete Event</Text>
          </TouchableOpacity>
        )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerText: {
    flex: 1,
  },
  eventName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  membersList: {
    gap: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inviteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inviteButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  inviteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  invitationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  invitationEmail: {
    fontSize: 14,
    color: '#333',
  },
  invitationStatus: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

