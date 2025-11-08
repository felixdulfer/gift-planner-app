import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  subscribeToWishlist,
  addItemToWishlist,
  deleteWishlistItem,
  markItemAsPurchased,
  deleteWishlist,
  Wishlist,
  WishlistItem,
} from '../../lib/firestore/wishlists';
import {
  getAssignmentForWishlist,
  updateAssignmentStatus,
} from '../../lib/firestore/assignments';

export default function WishlistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemLink, setItemLink] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const unsubscribe = subscribeToWishlist(id, (wishlistData) => {
      setWishlist(wishlistData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const handleAddItem = async () => {
    if (!itemName.trim() || !id) return;

    try {
      await addItemToWishlist(id, {
        name: itemName.trim(),
        description: itemDescription.trim() || undefined,
        link: itemLink.trim() || undefined,
        price: itemPrice ? parseFloat(itemPrice) : undefined,
      });
      setItemName('');
      setItemDescription('');
      setItemLink('');
      setItemPrice('');
      setShowAddItem(false);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleMarkPurchased = async (itemId: string) => {
    if (!id || !user) return;

    Alert.alert(
      'Mark as Purchased',
      'Are you sure you want to mark this item as purchased?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Purchased',
          onPress: async () => {
            try {
              await markItemAsPurchased(id, itemId, user.uid);
              
              // Update assignment status if this wishlist has an assignment
              try {
                const assignment = await getAssignmentForWishlist(id);
                if (assignment && assignment.status === 'pending') {
                  await updateAssignmentStatus(assignment.id, 'purchased');
                }
              } catch (assignmentError) {
                // Assignment update is optional, don't fail the whole operation
                console.error('Error updating assignment:', assignmentError);
              }
              
              // Wishlist will update automatically via real-time listener
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!id) return;

    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWishlistItem(id, itemId);
              // Wishlist will update automatically via real-time listener
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteWishlist = async () => {
    if (!id) return;

    Alert.alert(
      'Delete Wishlist',
      'Are you sure you want to delete this wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWishlist(id);
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading wishlist...</Text>
      </View>
    );
  }

  if (!wishlist) {
    return (
      <View style={styles.center}>
        <Text>Wishlist not found</Text>
      </View>
    );
  }

  const isCreator = wishlist.createdBy === user?.uid;

  const renderItem = ({ item }: { item: WishlistItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.purchasedBy && (
          <View style={styles.purchasedBadge}>
            <Text style={styles.purchasedText}>Purchased</Text>
          </View>
        )}
      </View>
      {item.description && (
        <Text style={styles.itemDescription}>{item.description}</Text>
      )}
      {item.link && (
        <Text style={styles.itemLink} numberOfLines={1}>
          {item.link}
        </Text>
      )}
      {item.price && (
        <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
      )}
      {!item.purchasedBy && (
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.purchaseButton}
            onPress={() => handleMarkPurchased(item.id)}
          >
            <Text style={styles.purchaseButtonText}>Mark as Purchased</Text>
          </TouchableOpacity>
          {isCreator && (
            <TouchableOpacity
              style={styles.deleteItemButton}
              onPress={() => handleDeleteItem(item.id)}
            >
              <Text style={styles.deleteItemButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.wishlistName}>{wishlist.name}</Text>
        {isCreator && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteWishlist}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      {isCreator && (
        <View style={styles.addSection}>
          {!showAddItem ? (
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => setShowAddItem(true)}
            >
              <Text style={styles.addItemButtonText}>+ Add Item</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addItemForm}>
              <TextInput
                style={styles.input}
                placeholder="Item name *"
                value={itemName}
                onChangeText={setItemName}
              />
              <TextInput
                style={styles.input}
                placeholder="Description (optional)"
                value={itemDescription}
                onChangeText={setItemDescription}
                multiline
              />
              <TextInput
                style={styles.input}
                placeholder="Link (optional)"
                value={itemLink}
                onChangeText={setItemLink}
                keyboardType="url"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Price (optional)"
                value={itemPrice}
                onChangeText={setItemPrice}
                keyboardType="decimal-pad"
              />
              <View style={styles.addItemActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowAddItem(false);
                    setItemName('');
                    setItemDescription('');
                    setItemLink('');
                    setItemPrice('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleAddItem}
                >
                  <Text style={styles.saveButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={wishlist.items || []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No items yet</Text>
            {isCreator && (
              <Text style={styles.emptySubtext}>
                Add items to this wishlist
              </Text>
            )}
          </View>
        }
      />
    </View>
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wishlistName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  addItemButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addItemButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addItemForm: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  addItemActions: {
    flexDirection: 'row',
    gap: 12,
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
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  itemCard: {
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  purchasedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  purchasedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  itemLink: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  purchaseButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  deleteItemButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  deleteItemButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  empty: {
    padding: 32,
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
});

