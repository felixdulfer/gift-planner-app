import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useInvitations } from '../../contexts/InvitationsContext';
import { logOut } from '../../lib/auth';
import {
  EventWithInvitation,
  acceptInvitation,
  rejectInvitation,
} from '../../lib/firestore/events';
import { getColors } from '../../lib/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, userData } = useAuth();
  const { pendingInvitations } = useInvitations();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const handleAcceptInvitation = async (event: EventWithInvitation) => {
    if (!user?.uid || !user?.email) return;

    try {
      await acceptInvitation(event.id, user.uid, user.email!);
      router.push(`/events/${event.id}`);
    } catch (error: any) {
      if (Platform.OS === 'web') {
        alert(`Error: ${error.message}`);
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  const handleRejectInvitation = async (event: EventWithInvitation) => {
    if (!user?.email) return;

    const confirmMessage = `Do you want to reject the invitation to "${event.name}"?`;
    
    // Use window.confirm on web, Alert.alert on native
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        try {
          await rejectInvitation(event.id, user.email!);
          alert('Success! Invitation rejected.');
        } catch (error: any) {
          alert(`Error: ${error.message}`);
        }
      }
    } else {
      Alert.alert(
        'Reject Invitation',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              try {
                await rejectInvitation(event.id, user.email!);
                Alert.alert('Success', 'Invitation rejected');
              } catch (error: any) {
                Alert.alert('Error', error.message);
              }
            },
          },
        ]
      );
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      router.replace('/(auth)/login');
    } catch (error: any) {
      console.error('Logout error:', error);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userData?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>
          {userData?.displayName || 'User'}
        </Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
      </View>

      {pendingInvitations.length > 0 && (
        <View style={[styles.invitationsCard, { backgroundColor: colors.surface, borderColor: colors.error }]}>
          <View style={[styles.invitationsHeader, { borderBottomColor: colors.errorBorder }]}>
            <View style={styles.invitationsTitleContainer}>
              <Ionicons name="mail-unread" size={24} color={colors.error} />
              <Text style={[styles.invitationsTitle, { color: colors.error }]}>
                Pending Invitations ({pendingInvitations.length})
              </Text>
            </View>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{pendingInvitations.length}</Text>
            </View>
          </View>
          {pendingInvitations.map((event) => (
            <View key={event.id} style={[styles.invitationItem, { backgroundColor: colors.invitationBackground, borderColor: colors.invitationBorder }]}>
              <View style={styles.invitationIconContainer}>
                <Ionicons name="calendar" size={32} color={colors.primary} />
              </View>
              <View style={styles.invitationInfo}>
                <Text style={[styles.invitationEventName, { color: colors.text }]}>{event.name}</Text>
                {event.eventDate && (
                  <View style={styles.invitationDateRow}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.invitationEventDate, { color: colors.textSecondary }]}>
                      {new Date(event.eventDate.seconds * 1000).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.invitationActions}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAcceptInvitation(event)}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectButton, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={() => handleRejectInvitation(event)}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  <Text style={[styles.rejectButtonText, { color: colors.textSecondary }]}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
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
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
  },
  invitationsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(255, 59, 48, 0.2)',
      },
      default: {
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  invitationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
  },
  invitationsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  invitationsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  badgeContainer: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  invitationItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  invitationIconContainer: {
    marginRight: 12,
  },
  invitationInfo: {
    flex: 1,
    marginBottom: 0,
  },
  invitationEventName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  invitationDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  invitationEventDate: {
    fontSize: 14,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

