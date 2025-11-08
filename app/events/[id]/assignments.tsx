import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { getUserData, UserData } from '../../../lib/auth';
import {
    Assignment,
    createAssignment,
    deleteAssignment,
    subscribeToAssignmentsForEvent,
} from '../../../lib/firestore/assignments';
import {
    Event,
    subscribeToEvent,
} from '../../../lib/firestore/events';
import {
    subscribeToWishlistsForEvent,
    Wishlist,
} from '../../../lib/firestore/wishlists';

interface AssignmentWithDetails extends Assignment {
  wishlistName?: string;
  assignedToName?: string;
}

export default function EventAssignmentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [rawAssignments, setRawAssignments] = useState<Assignment[]>([]);
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [members, setMembers] = useState<Map<string, UserData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWishlistId, setSelectedWishlistId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Enrich assignments when raw assignments, wishlists, or members change
  useEffect(() => {
    const enrichAssignments = async () => {
      const enriched: AssignmentWithDetails[] = await Promise.all(
        rawAssignments.map(async (assignment) => {
          const wishlist = wishlists.find((w) => w.id === assignment.wishlistId);
          const assignedToData = members.get(assignment.assignedTo);
          return {
            ...assignment,
            wishlistName: wishlist?.name,
            assignedToName: assignedToData?.displayName || assignment.assignedTo,
          };
        })
      );
      setAssignments(enriched);
      setLoading(false);
    };

    enrichAssignments();
  }, [rawAssignments, wishlists, members]);

  useEffect(() => {
    if (!id || !user) return;

    setLoading(true);
    
    // Subscribe to event
    const unsubscribeEvent = subscribeToEvent(id, (eventData) => {
      setEvent(eventData);
      
      // Load member details when event updates
      if (eventData?.members) {
        loadMemberDetails(eventData.members);
      }
    });

    // Subscribe to wishlists
    const unsubscribeWishlists = subscribeToWishlistsForEvent(id, (wishlistsData) => {
      setWishlists(wishlistsData);
    });

    // Subscribe to assignments
    const unsubscribeAssignments = subscribeToAssignmentsForEvent(id, (assignmentsData) => {
      setRawAssignments(assignmentsData);
    });

    return () => {
      unsubscribeEvent();
      unsubscribeWishlists();
      unsubscribeAssignments();
    };
  }, [id, user]);

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

  const handleCreateAssignment = async () => {
    if (!selectedWishlistId || !selectedUserId || !id || !user) {
      Alert.alert('Error', 'Please select both a wishlist and a user');
      return;
    }

    // Check if user is assigning to themselves
    if (selectedUserId === user.uid) {
      Alert.alert('Error', 'You cannot assign a wishlist to yourself');
      return;
    }

    try {
      await createAssignment(id, selectedWishlistId, selectedUserId, user.uid);
      Alert.alert('Success', 'Assignment created!');
      setShowAssignModal(false);
      setSelectedWishlistId('');
      setSelectedUserId('');
      // Data will update automatically via real-time listeners
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    Alert.alert(
      'Delete Assignment',
      'Are you sure you want to delete this assignment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAssignment(assignmentId);
              // Data will update automatically via real-time listeners
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const isCreator = event?.createdBy === user?.uid;
  const unassignedWishlists = wishlists.filter(
    (w) => !assignments.some((a) => a.wishlistId === w.id)
  );
  const availableMembers = event?.members?.filter(
    (memberId) => memberId !== user?.uid
  ) || [];

  const renderAssignment = ({ item }: { item: AssignmentWithDetails }) => (
    <View style={styles.assignmentCard}>
      <View style={styles.assignmentHeader}>
        <View style={styles.assignmentInfo}>
          <Text style={styles.wishlistName}>{item.wishlistName || 'Unknown'}</Text>
          <Text style={styles.assignedTo}>
            Assigned to: {item.assignedToName || item.assignedTo}
          </Text>
          <Text style={styles.status}>
            Status: {item.status === 'purchased' ? '✅ Purchased' : '⏳ Pending'}
          </Text>
        </View>
        {isCreator && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteAssignment(item.id)}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Assignments</Text>
        {isCreator && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAssignModal(true)}
          >
            <Text style={styles.addButtonText}>+ Assign</Text>
          </TouchableOpacity>
        )}
      </View>

      {showAssignModal && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Assignment</Text>

            <Text style={styles.modalLabel}>Wishlist</Text>
            {unassignedWishlists.length === 0 ? (
              <Text style={styles.emptyText}>No unassigned wishlists</Text>
            ) : (
              <View style={styles.selectContainer}>
                {unassignedWishlists.map((wishlist) => (
                  <TouchableOpacity
                    key={wishlist.id}
                    style={[
                      styles.selectOption,
                      selectedWishlistId === wishlist.id && styles.selectOptionSelected,
                    ]}
                    onPress={() => setSelectedWishlistId(wishlist.id)}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        selectedWishlistId === wishlist.id && styles.selectOptionTextSelected,
                      ]}
                    >
                      {wishlist.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.modalLabel}>Assign To</Text>
            {availableMembers.length === 0 ? (
              <Text style={styles.emptyText}>No available members</Text>
            ) : (
              <View style={styles.selectContainer}>
                {availableMembers.map((memberId) => {
                  const memberData = members.get(memberId);
                  return (
                    <TouchableOpacity
                      key={memberId}
                      style={[
                        styles.selectOption,
                        selectedUserId === memberId && styles.selectOptionSelected,
                      ]}
                      onPress={() => setSelectedUserId(memberId)}
                    >
                      <Text
                        style={[
                          styles.selectOptionText,
                          selectedUserId === memberId && styles.selectOptionTextSelected,
                        ]}
                      >
                        {memberData?.displayName || memberId}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAssignModal(false);
                  setSelectedWishlistId('');
                  setSelectedUserId('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateAssignment}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <Text>Loading assignments...</Text>
        </View>
      ) : assignments.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No assignments yet</Text>
          {isCreator && (
            <Text style={styles.emptySubtext}>
              Assign wishlists to members to get started!
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={assignments}
          renderItem={renderAssignment}
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
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
  assignmentCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  assignmentInfo: {
    flex: 1,
  },
  wishlistName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  assignedTo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  selectContainer: {
    gap: 8,
    maxHeight: 150,
  },
  selectOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  selectOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

