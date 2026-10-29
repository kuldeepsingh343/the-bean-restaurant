import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  arrayUnion,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDDVRldSnkvXdFt7Q4ibhUgg_5pZctH1oQ",
  authDomain: "the-bean-reviews-366e8.firebaseapp.com",
  projectId: "the-bean-reviews-366e8",
  storageBucket: "the-bean-reviews-366e8.appspot.com",
  messagingSenderId: "892550821737",
  appId: "1:892550821737:web:6c4fb2806933c931bc2ff8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ADMIN_REPLY_NAME = 'Admin-Bean Cafe';
const THEMES = ['bg-green-50', 'bg-pink-100', 'bg-blue-100', 'bg-rose-100', 'bg-yellow-100', 'bg-red-100', 'bg-orange-100', 'bg-gray-50'];
const CATEGORIES = [
  ['breakfast', 'Breakfast All Day'],
  ['coffee', 'Coffee + Tea'],
  ['specialties', 'Bean Specialties'],
  ['plant-based', 'Plant Based'],
  ['quesadillas', 'Quesadillas'],
  ['salads', 'Salads'],
  ['smoothies', 'Smoothies & Shakes'],
  ['cold-beverages', 'Cold Beverages'],
  ['snacks', 'Snacks & Sides']
];

const loginPanel = document.getElementById('login-panel');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const adminMessage = document.getElementById('admin-message');
const productForm = document.getElementById('product-form');
const productsList = document.getElementById('products-list');
const reviewsList = document.getElementById('admin-reviews');
const categorySelect = document.getElementById('product-category');
const cancelProductButton = document.getElementById('cancel-product');
const imageUploadInput = document.getElementById('product-image-upload');
const imageUploadStatus = document.getElementById('image-upload-status');

let currentUser = null;
let products = [];
let reviews = [];
let unsubscribeProducts = null;
let unsubscribeReviews = null;

categorySelect.innerHTML = CATEGORIES.map(([id, label]) => `<option value="${id}">${label}</option>`).join('');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.className = `text-sm ${isError ? 'text-red-600' : 'text-green-700'}`;
}

function formatDate(value) {
  if (!value) return 'Just now';
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Just now' : parsed.toLocaleString();
}

function categoryLabel(category) {
  return CATEGORIES.find(([id]) => id === category)?.[1] || category;
}

function resetProductForm() {
  productForm.reset();
  document.getElementById('product-id').value = '';
  document.getElementById('product-theme').value = 'bg-green-50';
  document.getElementById('product-order').value = '0';
  document.getElementById('product-image-path').value = '';
  imageUploadInput.value = '';
  imageUploadStatus.textContent = '';
  cancelProductButton.classList.add('hidden');
}

function renderProducts() {
  if (!products.length) {
    productsList.innerHTML = '<p class="md:col-span-2 lg:col-span-3 text-gray-500">No products yet. Use “Import existing menu” to bring in the current dishes.</p>';
    return;
  }

  productsList.innerHTML = [...products]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(product => `
      <article class="border border-gray-200 rounded-xl p-4 flex flex-col justify-between">
        <div>
          ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="w-full h-32 object-contain mb-3">` : ''}
          <p class="text-xs text-green-700 font-semibold uppercase">${escapeHtml(categoryLabel(product.category))}</p>
          <h3 class="text-lg font-bold">${escapeHtml(product.name)}</h3>
          <p class="text-sm text-gray-600 mt-1">${escapeHtml(product.ingredients)}</p>
          <p class="font-semibold text-green-700 mt-2">${escapeHtml(product.price || 'Price not set')}</p>
        </div>
        <div class="flex gap-2 mt-4">
          <button class="edit-product text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg" data-id="${product.id}">Edit</button>
          <button class="delete-product text-sm bg-red-50 text-red-700 hover:bg-red-100 px-3 py-2 rounded-lg" data-id="${product.id}">Remove</button>
        </div>
      </article>
    `).join('');
}

function renderReviews() {
  if (!reviews.length) {
    reviewsList.innerHTML = '<p class="text-gray-500">No customer reviews yet.</p>';
    return;
  }

  reviewsList.innerHTML = reviews.map(review => `
    <article class="border border-gray-200 rounded-xl p-5">
      <div class="flex flex-wrap justify-between gap-3">
        <div>
          <h3 class="font-bold">${escapeHtml(review.name || 'Anonymous')}</h3>
          <p class="text-yellow-500">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</p>
        </div>
        <span class="text-sm text-gray-500">${formatDate(review.createdAt)}</span>
      </div>
      <p class="mt-3 text-gray-700">${escapeHtml(review.text)}</p>
      <div class="mt-4 pl-4 border-l-2 border-gray-200 space-y-2">
        ${(review.replies || []).map(reply => `
          <div class="${reply.isAdmin || reply.name === ADMIN_REPLY_NAME ? 'admin-reply' : 'bg-gray-50'} p-3 rounded-md">
            <p class="font-semibold">${escapeHtml(reply.name || 'Anonymous')}</p>
            <p class="text-gray-700">${escapeHtml(reply.text)}</p>
          </div>
        `).join('')}
      </div>
      <form class="admin-reply-form mt-4 flex flex-col sm:flex-row gap-2" data-review-id="${review.id}">
        <input name="reply" required placeholder="Write the official response..." class="flex-grow p-3 border border-gray-300 rounded-lg">
        <button class="bg-green-700 hover:bg-green-800 text-white font-semibold px-4 py-2 rounded-lg" type="submit">Reply as Admin</button>
      </form>
    </article>
  `).join('');
}

function parseLegacyProducts(html) {
  const documentFromPage = new DOMParser().parseFromString(html, 'text/html');
  const pricePattern = /\d+\s*oz\s*:?\s*\$\d+(?:\.\d{2})?|\$\d+(?:\.\d{2})?/gi;
  const imported = [];

  documentFromPage.querySelectorAll('main > section[id]').forEach(section => {
    const category = section.id;
    const sectionTitle = section.querySelector(':scope > h2')?.textContent.trim() || category;
    section.querySelectorAll('.menu-card').forEach(card => {
      const heading = card.querySelector('h3, h4');
      if (!heading) return;

      const cardText = card.textContent.replace(/\s+/g, ' ').trim();
      const prices = [...cardText.matchAll(pricePattern)].map(match => match[0].replace(/\s+/g, ' ').trim());
      const uniquePrices = [...new Set(prices)];
      const name = heading.textContent
        .replace(pricePattern, '')
        .replace(/[🌿💚]/g, '')
        .replace(/\s+-\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      const paragraph = card.querySelector('p');
      const ingredients = (paragraph?.textContent || 'See menu details.')
        .replace(pricePattern, '')
        .replace(/\s+/g, ' ')
        .trim();
      const textForLabels = card.textContent.toLowerCase();
      const dietary = textForLabels.includes('vegan') ? 'Vegan'
        : textForLabels.includes('vegetarian') ? 'Vegetarian'
          : textForLabels.includes('halal') ? 'Halal' : '';
      const themeClass = [...card.classList].find(className => THEMES.includes(className)) || 'bg-green-50';

      imported.push({
        name,
        ingredients: ingredients || 'See menu details.',
        price: uniquePrices.join(' | '),
        category,
        categoryTitle: sectionTitle,
        dietary,
        image: card.querySelector('img')?.getAttribute('src') || '',
        themeClass,
        sortOrder: imported.length,
        createdAt: serverTimestamp()
      });
    });
  });

  return imported.filter(product => product.name);
}

async function importExistingMenu() {
  const existing = await getDocs(collection(db, 'products'));
  if (existing.size && !window.confirm(`There are already ${existing.size} products. Importing again will create duplicates. Continue?`)) return;

  const response = await fetch(`index.html?menu-source=${Date.now()}`);
  if (!response.ok) throw new Error('Could not read the current menu page.');
  const imported = parseLegacyProducts(await response.text());
  if (!imported.length) throw new Error('No menu cards were found to import.');

  for (const product of imported) {
    await addDoc(collection(db, 'products'), product);
  }
  showMessage(adminMessage, `Imported ${imported.length} existing menu products successfully.`);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxSide = 900;
      const scale = Math.min(1, maxSide / image.width, maxSide / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const compressedImage = canvas.toDataURL('image/jpeg', 0.78);
      if (compressedImage.length > 700000) {
        reject(new Error('This image is still too large after compression. Please choose a smaller image.'));
        return;
      }
      resolve(compressedImage);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The selected image could not be read.'));
    };
    image.src = objectUrl;
  });
}

async function resolveProductImage() {
  const selectedFile = imageUploadInput.files?.[0];
  const typedImage = document.getElementById('product-image').value.trim();

  if (!selectedFile) {
    return typedImage;
  }

  if (!selectedFile.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (selectedFile.size > 10 * 1024 * 1024) {
    throw new Error('The original image must be 10 MB or smaller.');
  }

  imageUploadStatus.textContent = 'Compressing image...';
  const compressedImage = await compressImage(selectedFile);
  imageUploadStatus.textContent = 'Image ready. It will be used instead of the URL.';
  return compressedImage;
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  showMessage(loginMessage, 'Signing in...');

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error(error);
    showMessage(loginMessage, 'Login failed. Check the email, password, and Firebase Authentication setup.', true);
  }
});

document.getElementById('logout').addEventListener('click', () => signOut(auth));
document.getElementById('import-menu').addEventListener('click', async () => {
  try {
    showMessage(adminMessage, 'Importing the existing menu...');
    await importExistingMenu();
  } catch (error) {
    console.error(error);
    showMessage(adminMessage, error.message || 'The menu could not be imported.', true);
  }
});

productForm.addEventListener('submit', async event => {
  event.preventDefault();
  const productId = document.getElementById('product-id').value;
  const saveButton = productForm.querySelector('button[type="submit"]');

  try {
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    const image = await resolveProductImage();
    const product = {
      name: document.getElementById('product-name').value.trim(),
      ingredients: document.getElementById('product-ingredients').value.trim(),
      price: document.getElementById('product-price').value.trim(),
      category: document.getElementById('product-category').value,
      dietary: document.getElementById('product-dietary').value,
      image,
      themeClass: THEMES.includes(document.getElementById('product-theme').value) ? document.getElementById('product-theme').value : 'bg-green-50',
      sortOrder: Number(document.getElementById('product-order').value) || 0
    };

    if (productId) {
      await updateDoc(doc(db, 'products', productId), product);
      showMessage(adminMessage, 'Product updated.');
    } else {
      await addDoc(collection(db, 'products'), { ...product, createdAt: serverTimestamp() });
      showMessage(adminMessage, 'Product added.');
    }
    resetProductForm();
  } catch (error) {
    console.error(error);
    showMessage(adminMessage, error.message || 'Could not save the product. Check Firebase Storage and Firestore rules.', true);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save product';
  }
});

cancelProductButton.addEventListener('click', resetProductForm);

productsList.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  const product = products.find(item => item.id === button.dataset.id);
  if (!product) return;

  if (button.classList.contains('edit-product')) {
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name || '';
    document.getElementById('product-ingredients').value = product.ingredients || '';
    document.getElementById('product-price').value = product.price || '';
    document.getElementById('product-category').value = product.category || 'breakfast';
    document.getElementById('product-dietary').value = product.dietary || '';
    document.getElementById('product-image').value = product.image || '';
    document.getElementById('product-image-path').value = '';
    imageUploadInput.value = '';
    imageUploadStatus.textContent = '';
    document.getElementById('product-theme').value = THEMES.includes(product.themeClass) ? product.themeClass : 'bg-green-50';
    document.getElementById('product-order').value = product.sortOrder || 0;
    cancelProductButton.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (button.classList.contains('delete-product') && window.confirm(`Remove “${product.name}” from the menu?`)) {
    try {
      await deleteDoc(doc(db, 'products', product.id));
      showMessage(adminMessage, 'Product removed.');
    } catch (error) {
      console.error(error);
      showMessage(adminMessage, 'Could not remove the product.', true);
    }
  }
});

reviewsList.addEventListener('submit', async event => {
  const form = event.target.closest('.admin-reply-form');
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector('input[name="reply"]');
  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'Posting...';

  try {
    await updateDoc(doc(db, 'reviews', form.dataset.reviewId), {
      replies: arrayUnion({
        name: ADMIN_REPLY_NAME,
        text: input.value.trim(),
        isAdmin: true,
        createdAt: new Date().toISOString()
      })
    });
    form.reset();
    showMessage(adminMessage, 'Official reply posted.');
  } catch (error) {
    console.error(error);
    showMessage(adminMessage, 'Could not post the reply. Check the admin Firestore rule.', true);
  } finally {
    button.disabled = false;
    button.textContent = 'Reply as Admin';
  }
});

onAuthStateChanged(auth, async user => {
  if (unsubscribeProducts) unsubscribeProducts();
  if (unsubscribeReviews) unsubscribeReviews();
  currentUser = user;

  if (!user) {
    loginPanel.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    return;
  }

  try {
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    if (!adminDoc.exists()) {
      await signOut(auth);
      showMessage(loginMessage, `This account is not authorized. Add an admins/${user.uid} document in Firestore first.`, true);
      return;
    }

    loginPanel.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    document.getElementById('admin-email').textContent = user.email || user.uid;
    showMessage(adminMessage, 'Admin access granted.');

    unsubscribeProducts = onSnapshot(collection(db, 'products'), snapshot => {
      products = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderProducts();
    });
    unsubscribeReviews = onSnapshot(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')), snapshot => {
      reviews = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderReviews();
    });
  } catch (error) {
    console.error(error);
    showMessage(loginMessage, 'Could not verify admin access. Publish the updated Firestore rules first.', true);
    await signOut(auth);
  }
});
