import React, {useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import {Colors} from 'react-native/Libraries/NewAppScreen';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const mockProducts: Product[] = [
  {id: '1', name: 'Product 1', price: 10.99, stock: 50},
  {id: '2', name: 'Product 2', price: 15.99, stock: 30},
  {id: '3', name: 'Product 3', price: 8.99, stock: 100},
  {id: '4', name: 'Product 4', price: 25.99, stock: 20},
];

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [currentScreen, setCurrentScreen] = useState<'pos' | 'inventory' | 'reports'>('pos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
    flex: 1,
  };

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? {...item, quantity: item.quantity + 1}
            : item
        );
      } else {
        return [...prevCart, {product, quantity: 1}];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId ? {...item, quantity} : item
      )
    );
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const checkout = () => {
    // Here you would integrate with your backend API
    alert(`Total: $${getTotalPrice().toFixed(2)}\nOrder completed!`);
    setCart([]);
  };

  const filteredProducts = mockProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderPOS = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PeachyFL POS</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.mainContent}>
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>Products</Text>
          <FlatList
            data={filteredProducts}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.productItem}
                onPress={() => addToCart(item)}
              >
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
                <Text style={styles.productStock}>Stock: {item.stock}</Text>
              </TouchableOpacity>
            )}
            numColumns={2}
          />
        </View>

        <View style={styles.cartSection}>
          <Text style={styles.sectionTitle}>Cart</Text>
          <FlatList
            data={cart}
            keyExtractor={item => item.product.id}
            renderItem={({item}) => (
              <View style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName}>{item.product.name}</Text>
                  <Text style={styles.cartItemPrice}>
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                  >
                    <Text style={styles.quantityButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
                  >
                    <Text style={styles.quantityButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          <View style={styles.cartTotal}>
            <Text style={styles.totalText}>Total: ${getTotalPrice().toFixed(2)}</Text>
            <TouchableOpacity
              style={[styles.checkoutButton, cart.length === 0 && styles.checkoutButtonDisabled]}
              onPress={checkout}
              disabled={cart.length === 0}
            >
              <Text style={styles.checkoutButtonText}>Checkout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  const renderInventory = () => (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Inventory Management</Text>
      <Text style={styles.comingSoon}>Coming Soon...</Text>
    </View>
  );

  const renderReports = () => (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Reports</Text>
      <Text style={styles.comingSoon}>Coming Soon...</Text>
    </View>
  );

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'pos' && styles.navButtonActive]}
          onPress={() => setCurrentScreen('pos')}
        >
          <Text style={[styles.navButtonText, currentScreen === 'pos' && styles.navButtonTextActive]}>
            POS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'inventory' && styles.navButtonActive]}
          onPress={() => setCurrentScreen('inventory')}
        >
          <Text style={[styles.navButtonText, currentScreen === 'inventory' && styles.navButtonTextActive]}>
            Inventory
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'reports' && styles.navButtonActive]}
          onPress={() => setCurrentScreen('reports')}
        >
          <Text style={[styles.navButtonText, currentScreen === 'reports' && styles.navButtonTextActive]}>
            Reports
          </Text>
        </TouchableOpacity>
      </View>

      {currentScreen === 'pos' && renderPOS()}
      {currentScreen === 'inventory' && renderInventory()}
      {currentScreen === 'reports' && renderReports()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  productsSection: {
    flex: 1,
    marginRight: 8,
  },
  cartSection: {
    flex: 1,
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  productItem: {
    flex: 1,
    margin: 4,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  productPrice: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
    marginTop: 4,
  },
  productStock: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cartItemPrice: {
    fontSize: 12,
    color: '#666',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 30,
    height: 30,
    backgroundColor: '#007AFF',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantityText: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartTotal: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  checkoutButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#ccc',
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navigation: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    padding: 8,
  },
  navButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  navButtonActive: {
    backgroundColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  navButtonTextActive: {
    color: 'white',
  },
  comingSoon: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
  },
});

export default App; 