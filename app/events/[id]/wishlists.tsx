import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { subscribeToWishlistsForEvent, Wishlist } from '../../../lib/firestore/wishlists';

export default function EventWishlistsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const unsubscribe = subscribeToWishlistsForEvent(id, (updatedWishlists) => {
      setWishlists(updatedWishlists);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const renderWishlist = ({ item }: { item: Wishlist }) => (
    <TouchableOpacity
      style={styles.wishlistCard}
      onPress={() => router.push(`/wishlists/${item.id}`)}
    >
      <Text style={styles.wishlistName}>{item.name}</Text>
      <Text style={styles.itemCount}>
        {item.items?.length || 0} item{item.items?.length !== 1 ? 's' : ''}
      </Text>
      <Text style={styles.purchasedCount}>
        {item.items?.filter((i) => i.purchasedBy).length || 0} purchased
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Wishlists</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push(`/wishlists/create?eventId=${id}`)}
        >
          <Text style={styles.addButtonText}>+ New Wishlist</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text>Loading wishlists...</Text>
        </View>
      ) : wishlists.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No wishlists yet</Text>
          <Text style={styles.emptySubtext}>
            Create a wishlist to get started!
          </Text>
        </View>
      ) : (
        <FlatList
          data={wishlists}
          renderItem={renderWishlist}
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
  wishlistCard: {
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
  wishlistName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  purchasedCount: {
    fontSize: 12,
    color: '#4CAF50',
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
});

