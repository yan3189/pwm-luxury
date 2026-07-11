// ========== FILE: src/services/cartService.js ==========
// Service untuk mengelola cart di localStorage (dengan event real-time)
// DS001: Import fungsi hitung diskon dari priceUtils
import { calculateDiscountedPrice } from '../utils/priceUtils';

const CART_KEY = 'pwm_cart'

/**
 * Ambil cart dari localStorage
 */
export function getCart() {
  const cart = localStorage.getItem(CART_KEY)
  return cart ? JSON.parse(cart) : { store_id: null, items: [] }
}

/**
 * Simpan cart ke localStorage dan trigger event
 */
export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  window.dispatchEvent(new Event('cart-updated'))
}

/**
 * Kosongkan cart
 */
export function clearCart() {
  localStorage.removeItem(CART_KEY)
  window.dispatchEvent(new Event('cart-updated'))
}

/**
 * Tambah item ke cart (dengan validasi store)
 */
export function addToCart(product, quantity = 1, confirmCallback) {
  const cart = getCart()
  const newStoreId = product.store_id

  if (!cart.store_id) {
    cart.store_id = newStoreId
    cart.items = []
  }

  if (cart.store_id !== newStoreId) {
    if (confirmCallback && confirmCallback()) {
      cart.store_id = newStoreId
      cart.items = []
    } else {
      return false
    }
  }

  // DS001: Hitung harga diskon menggunakan fungsi dari priceUtils
  const discountedPrice = product.has_discount && product.discount_value
    ? calculateDiscountedPrice(product.price, product.has_discount, product.discount_value)
    : product.price

  const existingIndex = cart.items.findIndex(item => item.product_id === product.id)

  if (existingIndex !== -1) {
    cart.items[existingIndex].quantity += quantity
  } else {
    cart.items.push({
      product_id: product.id,
      store_id: product.store_id,
      name: product.name,
      original_price: product.price,
      discounted_price: discountedPrice,
      discount_value: product.discount_value || 0,  // DS001: simpan nilai diskon mentah
      quantity: quantity,
      image_url: product.image_url
    })
  }

  saveCart(cart)
  return true
}

/**
 * Update quantity item di cart
 */
export function updateCartItemQuantity(productId, quantity) {
  const cart = getCart()
  const itemIndex = cart.items.findIndex(item => item.product_id === productId)
  if (itemIndex !== -1) {
    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1)
    } else {
      cart.items[itemIndex].quantity = quantity
    }
  }
  if (cart.items.length === 0) {
    cart.store_id = null
  }
  saveCart(cart)
  return cart
}

/**
 * Hapus item dari cart
 */
export function removeCartItem(productId) {
  const cart = getCart()
  cart.items = cart.items.filter(item => item.product_id !== productId)
  if (cart.items.length === 0) {
    cart.store_id = null
  }
  saveCart(cart)
  return cart
}

/**
 * Hitung subtotal cart
 */
export function getCartSubtotal(cart) {
  return cart.items.reduce((sum, item) => sum + (item.discounted_price * item.quantity), 0)
}

/**
 * Jumlah item unik
 */
export function getCartItemCount(cart) {
  return cart.items.length
}

/**
 * Total quantity semua item
 */
export function getCartTotalQuantity(cart) {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0)
}