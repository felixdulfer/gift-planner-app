import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import {
  EventWithInvitation,
  subscribeToEventsWithPendingInvitations,
} from '../lib/firestore/events';

// Lazy-load expo-notifications to avoid errors in Expo Go (SDK 53+)
// This function only loads the module when actually called, not at module load time
let notificationsModule: typeof import('expo-notifications') | null = null;
let notificationsLoadAttempted = false;

function getNotifications() {
  // Only try to load once
  if (notificationsLoadAttempted) {
    return notificationsModule;
  }
  
  notificationsLoadAttempted = true;
  
  // Check if we're in Expo Go - if so, skip loading entirely
  // Constants.executionEnvironment can be: 'bare', 'standalone', 'storeClient', 'standard'
  // 'standard' typically means Expo Go
  const isExpoGo = Constants.executionEnvironment === 'standard';
  
  if (isExpoGo) {
    console.log('Running in Expo Go, notifications disabled (not supported in SDK 53+)');
    return null;
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require('expo-notifications') as typeof import('expo-notifications');
    return notificationsModule;
  } catch (error) {
    console.log('expo-notifications not available, notifications will be disabled');
    return null;
  }
}

interface InvitationsContextType {
  pendingInvitations: EventWithInvitation[];
  invitationCount: number;
}

const InvitationsContext = createContext<InvitationsContextType>({
  pendingInvitations: [],
  invitationCount: 0,
});

export const useInvitations = () => useContext(InvitationsContext);

export function InvitationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pendingInvitations, setPendingInvitations] = useState<EventWithInvitation[]>([]);
  const previousCountRef = useRef(0);

  useEffect(() => {
    if (!user?.email) {
      setPendingInvitations([]);
      previousCountRef.current = 0;
      return;
    }

    // Configure notification handler and request permissions (only on native platforms and if notifications are available)
    if (Platform.OS !== 'web') {
      const Notifications = getNotifications();
      if (Notifications) {
        try {
          // Configure notification handler
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });
        } catch (error) {
          console.log('Failed to set notification handler:', error);
        }

        // Request notification permissions
        const requestPermissions = async () => {
          try {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') {
              console.log('Notification permissions not granted');
            }
          } catch (error) {
            console.log('Error requesting notification permissions:', error);
          }
        };
        requestPermissions();
      }
    }

    const unsubscribe = subscribeToEventsWithPendingInvitations(
      user.email,
      (events) => {
        const newCount = events.length;
        const oldCount = previousCountRef.current;

        // Show notification when new invitations arrive (only on native platforms and if notifications are available)
        if (Platform.OS !== 'web') {
          const Notifications = getNotifications();
          if (Notifications) {
            if (newCount > oldCount && oldCount > 0) {
              const newInvites = newCount - oldCount;
              Notifications.scheduleNotificationAsync({
                content: {
                  title: 'New Invitation' + (newInvites > 1 ? 's' : ''),
                  body:
                    newInvites === 1
                      ? `You've been invited to "${events[events.length - 1].name}"`
                      : `You have ${newInvites} new event invitation${newInvites > 1 ? 's' : ''}`,
                  sound: true,
                  badge: newCount,
                },
                trigger: null, // Show immediately
              }).catch((error) => {
                console.log('Error scheduling notification:', error);
              });
            } else if (newCount > 0 && oldCount === 0) {
              // First time seeing invitations
              Notifications.scheduleNotificationAsync({
                content: {
                  title: 'New Invitation' + (newCount > 1 ? 's' : ''),
                  body:
                    newCount === 1
                      ? `You've been invited to "${events[0].name}"`
                      : `You have ${newCount} new event invitation${newCount > 1 ? 's' : ''}`,
                  sound: true,
                  badge: newCount,
                },
                trigger: null,
              }).catch((error) => {
                console.log('Error scheduling notification:', error);
              });
            }

            // Update app badge
            Notifications.setBadgeCountAsync(newCount).catch((error) => {
              console.log('Error setting badge count:', error);
            });
          }
        }

        setPendingInvitations(events);
        previousCountRef.current = newCount;
      },
      (error) => {
        console.error('Error loading invitations:', error);
        setPendingInvitations([]);
        previousCountRef.current = 0;
        // Clear badge (only on native platforms and if notifications are available)
        if (Platform.OS !== 'web') {
          const Notifications = getNotifications();
          if (Notifications) {
            Notifications.setBadgeCountAsync(0).catch((err) => {
              console.log('Error clearing badge count:', err);
            });
          }
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.email]);

  return (
    <InvitationsContext.Provider
      value={{
        pendingInvitations,
        invitationCount: pendingInvitations.length,
      }}
    >
      {children}
    </InvitationsContext.Provider>
  );
}

