import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
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
import { getColors } from '../../lib/theme';

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [members, setMembers] = useState<Map<string, UserData>>(new Map());
  const loadingMembersRef = useRef<Set<string>>(new Set());

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
    setMembers((prevMembers) => {
      const memberMap = new Map(prevMembers);
      
      // Remove members that are no longer in the event
      for (const [memberId] of memberMap) {
        if (!memberIds.includes(memberId)) {
          memberMap.delete(memberId);
        }
      }
      
      // Load missing members asynchronously
      const membersToLoad = memberIds.filter(
        (id) => !memberMap.has(id) && !loadingMembersRef.current.has(id)
      );
      
      for (const memberId of membersToLoad) {
        loadingMembersRef.current.add(memberId);
        
        getUserData(memberId)
          .then((userData) => {
            if (userData) {
              setMembers((prevMembers) => {
                const updatedMap = new Map(prevMembers);
                updatedMap.set(memberId, userData);
                return updatedMap;
              });
            } else {
              // User document doesn't exist - try to get email from invitation
              // This will be handled by the fallback in the render
              setMembers((prevMembers) => {
                const updatedMap = new Map(prevMembers);
                // Set a placeholder so we don't keep trying to load
                updatedMap.set(memberId, {
                  email: '',
                  displayName: '',
                  createdAt: new Date(),
                });
                return updatedMap;
              });
            }
          })
          .catch((error) => {
            console.error(`Error loading user ${memberId}:`, error);
            // Set placeholder on error too so we don't keep retrying
            setMembers((prevMembers) => {
              const updatedMap = new Map(prevMembers);
              updatedMap.set(memberId, {
                email: '',
                displayName: '',
                createdAt: new Date(),
              });
              return updatedMap;
            });
          })
          .finally(() => {
            loadingMembersRef.current.delete(memberId);
          });
      }
      
      return memberMap;
    });
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
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" />
        <Text style={{ color: colors.text }}>Loading event...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Event not found</Text>
      </View>
    );
  }

  const isCreator = event.createdBy === user?.uid;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.eventName, { color: colors.text }]}>{event.name}</Text>
            {event.eventDate && (
              <Text style={[styles.eventDate, { color: colors.textSecondary }]}>
                {new Date(event.eventDate.seconds * 1000).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>
      </View>
      <ScrollView>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Members ({event.members?.length || 0})</Text>
        <View style={styles.membersList}>
          {event.members?.map((memberId) => {
            const memberData = members.get(memberId);
            const canRemove = isCreator && memberId !== event.createdBy;
            
            // Try to find email from accepted invitation if user data is not available
            // We'll use the first accepted invitation as a fallback (imperfect but better than nothing)
            const acceptedInvitations = event.invitations?.filter(inv => inv.status === 'accepted') || [];
            const fallbackEmail = acceptedInvitations.length > 0 ? acceptedInvitations[0].email : null;
            
            // Determine display name and email
            const displayName = memberData?.displayName || 
              (memberData?.email ? memberData.email.split('@')[0] : null) ||
              (fallbackEmail ? fallbackEmail.split('@')[0] : null) ||
              (memberId.length > 20 ? memberId.substring(0, 8) + '...' : memberId);
            const displayEmail = memberData?.email || fallbackEmail || memberId;
            
            return (
              <View key={memberId} style={[styles.memberItem, { backgroundColor: colors.surfaceSecondary }]}>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.text }]}>
                    {displayName}
                  </Text>
                  <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
                    {displayEmail}
                  </Text>
                </View>
                {canRemove && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveMember(memberId)}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {isCreator && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Invite User</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={[styles.inviteInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight, color: colors.text }]}
              placeholder="Email address"
              placeholderTextColor={colors.textTertiary}
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
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Pending Invitations</Text>
          {event.invitations
            ?.filter((inv) => inv.status === 'pending')
            .map((inv, index) => (
              <View key={index} style={[styles.invitationItem, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.invitationEmail, { color: colors.text }]}>{inv.email}</Text>
                <Text style={[styles.invitationStatus, { color: colors.textSecondary }]}>{inv.status}</Text>
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
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
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
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 16,
  },
  section: {
    padding: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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
    borderRadius: 8,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
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
    borderRadius: 8,
    marginBottom: 8,
  },
  invitationEmail: {
    fontSize: 14,
  },
  invitationStatus: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  emptyText: {
    fontSize: 14,
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

