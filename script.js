// This event listener ensures the entire HTML document is loaded and ready before the script runs.
// This prevents errors where the script tries to access elements that haven't been created yet.
window.onload = function () {

    // --- Firebase Setup ---
    if (!window.db || !window.firebase?.firestore) {
        console.error("Firebase is not initialized correctly. Make sure the config script is in your HTML and is correct.");
        return;
    }
    const { db } = window;
    const { collection, onSnapshot, addDoc, doc, query, orderBy } = window.firebase.firestore;
    const reviewsCollection = collection(db, "reviews");
    const productsCollection = collection(db, "products");

    // --- Gemini API ---
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=`;
    const API_KEY = ""; // Your Gemini API Key if needed

    // --- Page Elements ---
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const reviewForm = document.getElementById('review-form');
    const reviewsContainer = document.getElementById('reviews-container');
    const reviewSummary = document.getElementById('review-summary');
    const summarizeBtn = document.getElementById('summarize-btn');
    const summaryContainer = document.getElementById('summary-container');

    let allReviews = [];
    let allProducts = [];

    const MENU_THEMES = [
        'bg-green-50', 'bg-pink-100', 'bg-blue-100', 'bg-rose-100',
        'bg-yellow-100', 'bg-red-100', 'bg-orange-100', 'bg-gray-50'
    ];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(value) {
        if (!value) return 'Just now';
        if (typeof value.toDate === 'function') return value.toDate().toLocaleString();
        if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 'Just now' : parsed.toLocaleString();
    }

    function dietaryBadge(dietary) {
        if (dietary === 'Vegan') return '<span data-tooltip="Vegan">💚</span>';
        if (dietary === 'Vegetarian') return '<span data-tooltip="Vegetarian">🌿</span>';
        if (dietary === 'Halal') return '<span class="halal"></span>';
        return '';
    }

    function renderProducts() {
        if (!allProducts.length) return;

        document.querySelectorAll('main > section[id]').forEach(section => {
            const sectionProducts = allProducts
                .filter(product => product.category === section.id)
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            const legacyGrids = section.querySelectorAll('.grid:not([data-dynamic-menu-grid])');
            let dynamicGrid = section.querySelector('[data-dynamic-menu-grid]');

            if (!dynamicGrid) {
                dynamicGrid = document.createElement('div');
                dynamicGrid.dataset.dynamicMenuGrid = 'true';
                dynamicGrid.className = 'grid md:grid-cols-2 lg:grid-cols-3 gap-8';
                section.insertBefore(dynamicGrid, section.querySelector('.grid'));
            }

            if (!sectionProducts.length) {
                dynamicGrid.classList.add('hidden');
                legacyGrids.forEach(grid => grid.classList.remove('hidden'));
                return;
            }

            legacyGrids.forEach(grid => grid.classList.add('hidden'));
            dynamicGrid.classList.remove('hidden');
            dynamicGrid.innerHTML = sectionProducts.map(product => {
                const theme = MENU_THEMES.includes(product.themeClass) ? product.themeClass : 'bg-green-50';
                const image = product.image ? `
                    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"
                        class="w-full h-48 object-contain mb-4 mx-auto">` : '';
                const imageLayout = image ? 'text-center' : '';
                return `
                    <div class="${theme} p-6 rounded-lg shadow-lg menu-card ${imageLayout}">
                        ${image}
                        <h3 class="text-xl font-bold mb-2">${escapeHtml(product.name)} ${dietaryBadge(product.dietary)}</h3>
                        <p class="text-gray-600">${escapeHtml(product.ingredients)}${product.price ? `<br><span class="font-semibold text-green-700">${escapeHtml(product.price)}</span>` : ''}</p>
                    </div>`;
            }).join('');
        });
    }

    // --- Mobile Menu Logic ---
    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
        document.querySelectorAll('#mobile-menu a').forEach(link => {
            link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
        });
    }

    // --- SMOOTHER Image Slider Logic ---
    function initializeSliders() {
        document.querySelectorAll('.image-slider-wrapper').forEach(wrapper => {
            const slider = wrapper.querySelector('.image-slider');
            // This check prevents the script from crashing if a slider isn't found.
            if (!slider) {
                return;
            }

            const dotsContainer = wrapper.querySelector('.slider-dots');
            const images = slider.querySelectorAll('img');
            const imageCount = images.length;

            if (imageCount <= 1 || !dotsContainer) return;

            // --- Create Dots ---
            dotsContainer.innerHTML = '';
            for (let i = 0; i < imageCount; i++) {
                const dot = document.createElement('span');
                dot.classList.add('slider-dot');
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => {
                    const slideWidth = slider.offsetWidth;
                    slider.scrollTo({ left: i * slideWidth, behavior: 'smooth' });
                });
                dotsContainer.appendChild(dot);
            }
            const dots = dotsContainer.querySelectorAll('.slider-dot');

            // --- Update Dots on Scroll ---
            let scrollTimer = null;
            slider.addEventListener('scroll', () => {
                if (scrollTimer) clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => {
                    const slideWidth = slider.offsetWidth;
                    const currentIndex = Math.round(slider.scrollLeft / slideWidth);

                    dots.forEach((dot, index) => {
                        dot.classList.toggle('active', index === currentIndex);
                    });
                }, 100);
            });
        });
    }

    initializeSliders();


    // --- Gemini API Call ---
    async function callGeminiAPI(prompt, retries = 3, delay = 1000) {
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        try {
            const response = await fetch(`${GEMINI_API_URL}${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                if (response.status === 429 && retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return callGeminiAPI(prompt, retries - 1, delay * 2);
                }
                throw new Error(`API request failed with status ${response.status}`);
            }
            const result = await response.json();
            const candidate = result.candidates?.[0];
            return candidate?.content?.parts?.[0]?.text || "Sorry, the response was not valid.";
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            return "Sorry, I couldn't generate a response right now.";
        }
    }


    // --- Render Functions ---
    function renderReviews() {
        if (!reviewsContainer) return;

        reviewsContainer.innerHTML = allReviews.length === 0 ? '<p class="text-center text-gray-500">Be the first to leave a review!</p>' : allReviews.map(review => `
            <div class="bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-green-500 review-item">
                <div class="flex justify-between items-center mb-2 flex-wrap">
                    <h4 class="text-lg font-bold mr-4">${escapeHtml(review.name || 'Anonymous')}</h4>
                    <div class="text-yellow-500 text-xl">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                </div>
                <p class="text-gray-700 mb-4">${escapeHtml(review.text)}</p>
                <div class="text-sm text-gray-400">${formatDate(review.createdAt)}</div>
                
                <div class="mt-4 pl-4 border-l-2 border-gray-200" id="replies-${review.id}">${renderReplies(review.replies)}</div>
            </div>
        `).join('');

        updateReviewSummary();
    }

    function renderReplies(replies) {
        return (replies || []).map(reply => `
            <div class="${reply.isAdmin || reply.name === 'Admin-Bean Cafe' ? 'admin-reply' : 'bg-gray-50'} p-3 rounded-md mb-2">
                <div class="flex items-center gap-2 mb-1">
                    <p class="font-semibold ${reply.isAdmin || reply.name === 'Admin-Bean Cafe' ? 'text-green-900' : 'text-gray-800'}">${escapeHtml(reply.name || 'Anonymous')}</p>
                    ${reply.isAdmin || reply.name === 'Admin-Bean Cafe' ? '<span class="admin-reply-badge">Official response</span>' : ''}
                </div>
                <p class="text-gray-700">${escapeHtml(reply.text)}</p>
            </div>
        `).join('');
    }

    function updateReviewSummary() {
        if (!reviewSummary) return;
        if (allReviews.length === 0) {
            reviewSummary.innerHTML = '<p class="text-gray-500">No reviews yet to generate a summary.</p>';
            if (summarizeBtn) summarizeBtn.disabled = true;
            return;
        }
        if (summarizeBtn) summarizeBtn.disabled = false;
        const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let totalRatings = 0;
        allReviews.forEach(review => {
            ratingCounts[review.rating]++;
            totalRatings += review.rating;
        });
        const averageRating = (totalRatings / allReviews.length).toFixed(1);

        reviewSummary.innerHTML = `
        <div class="flex items-center justify-center mb-4">
             <span class="text-3xl font-bold text-gray-800 mr-2">${averageRating}</span>
             <div class="text-yellow-500 text-2xl">${'★'.repeat(Math.round(averageRating))}${'☆'.repeat(5 - Math.round(averageRating))}</div>
             <span class="ml-2 text-gray-500">(${allReviews.length} reviews)</span>
        </div>
        ` +
            Object.keys(ratingCounts).reverse().map(i => {
                const count = ratingCounts[i];
                const percentage = (count / allReviews.length) * 100;
                return `
                <div class="flex items-center mb-1">
                    <span class="text-sm font-medium text-yellow-500 w-12">${i} star</span>
                    <div class="w-full h-4 mx-2 bg-gray-200 rounded"><div class="h-4 bg-green-500 rounded" style="width: ${percentage}%"></div></div>
                    <span class="text-sm font-medium text-gray-500 w-8 text-right">${count}</span>
                </div>`;
            }).join('');
    }

    // --- Event Listeners & Database Interaction ---

    try {
        const q = query(reviewsCollection, orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            allReviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderReviews();
        }, (error) => {
            console.error("Error fetching reviews:", error);
            if (reviewsContainer) reviewsContainer.innerHTML = '<p class="text-center text-red-500 font-bold">Could not load reviews. Please check your connection or security rules and ensure the necessary index is created in Firestore.</p>';
        });
    } catch (error) {
        console.error("Firestore query failed:", error);
        if (reviewsContainer) reviewsContainer.innerHTML = '<p class="text-center text-red-500 font-bold">There was an error setting up the reviews listener.</p>';
    }

    onSnapshot(productsCollection, (snapshot) => {
        allProducts = snapshot.docs.map(productDoc => ({ id: productDoc.id, ...productDoc.data() }));
        renderProducts();
    }, (error) => {
        // An empty products collection is supported as a fallback to the existing menu markup.
        console.error("Error fetching managed products:", error);
    });


    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = reviewForm.querySelector('button[type="submit"]');
            const ratingInput = document.querySelector('input[name="rating"]:checked');

            if (!ratingInput) {
                alert("Please select a star rating.");
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = "Submitting...";

            const newReview = {
                name: document.getElementById('reviewer-name').value,
                rating: parseInt(ratingInput.value),
                text: document.getElementById('review-text').value,
                createdAt: serverTimestamp(),
                replies: []
            };

            try {
                await addDoc(reviewsCollection, newReview);
                reviewForm.reset();
            } catch (error) {
                console.error("Error adding review: ", error);
                alert("Sorry, there was an error submitting your review. It might be a permissions issue. Please check your security rules.");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Submit Review";
            }
        });
    }

    function attachAIFeatureHandlers() {
        if (summarizeBtn) {
            summarizeBtn.addEventListener('click', async () => {
                if (allReviews.length < 2) {
                    summaryContainer.innerHTML = '<p class="text-blue-600 font-semibold">Please add at least two reviews to create a summary.</p>';
                    return;
                }
                const originalButtonText = summarizeBtn.innerHTML;
                summarizeBtn.disabled = true;
                summarizeBtn.innerHTML = '✨ Generating...';
                summaryContainer.innerHTML = '<p class="text-gray-600 animate-pulse">Analyzing feedback...</p>';

                const reviewsText = allReviews.map(r => `${r.name} (${r.rating}/5): "${r.text}"`).join('\n');
                const prompt = `Summarize the following customer reviews for "The Bean" in a single, friendly paragraph (around 40-50 words). Highlight common themes for a potential customer, mentioning both positive and negative points if they exist. Do not use markdown.\n\nReviews:\n${reviewsText}`;
                const summary = await callGeminiAPI(prompt);

                summaryContainer.innerHTML = `<p class="text-gray-800 bg-green-100 p-4 rounded-lg border border-green-200">${summary.replace(/\n/g, '<br>')}</p>`;
                summarizeBtn.disabled = false;
                summarizeBtn.innerHTML = originalButtonText;
            });
        }
    }

    attachAIFeatureHandlers();

    // --- Scrollspy for Navigation ---
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('header nav a');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(link => {
                    link.classList.remove('nav-link-active');
                    if (link.getAttribute('href').substring(1) === entry.target.id) {
                        link.classList.add('nav-link-active');
                    }
                });
            }
        });
    }, { rootMargin: "-50% 0px -50% 0px" });

    sections.forEach(section => {
        observer.observe(section);
    });

};
