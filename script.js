document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Setup ---
    // Note: db and firestore functions are initialized in index.html and attached to the window object
    if (!window.db || !window.firebase?.firestore) {
        console.error("Firebase is not initialized. Make sure you have pasted your firebaseConfig in index.html and that all Firebase scripts are loaded.");
        const reviewsContainer = document.getElementById('reviews-container');
        if (reviewsContainer) {
            reviewsContainer.innerHTML = '<p class="text-center text-red-500 font-bold">Error: Could not connect to the review database. Please contact the site administrator.</p>';
        }
        return;
    }
    const { db } = window;
    const { collection, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, query, orderBy } = window.firebase.firestore;
    const reviewsCollection = collection(db, "reviews");

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

    let allReviews = []; // Local cache of reviews from the database

    // --- Mobile Menu Logic ---
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }
    document.querySelectorAll('#mobile-menu a').forEach(link => {
        link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
    });

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
                if (response.status === 429 && retries > 0) { // Exponential backoff for rate limiting
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
                    <h4 class="text-lg font-bold mr-4">${review.name ? review.name.replace(/</g, "&lt;") : 'Anonymous'}</h4>
                    <div class="text-yellow-500 text-xl">${'&#9733;'.repeat(review.rating)}${'&#9734;'.repeat(5 - review.rating)}</div>
                </div>
                <p class="text-gray-700 mb-4">${review.text ? review.text.replace(/</g, "&lt;") : ''}</p>
                <div class="text-sm text-gray-400">${review.createdAt ? new Date(review.createdAt.seconds * 1000).toLocaleString() : 'Just now'}</div>
                
                <div class="mt-4 pl-4 border-l-2 border-gray-200" id="replies-${review.id}">${renderReplies(review.replies)}</div>
                
                <form class="reply-form mt-4" data-review-id="${review.id}">
                     <div class="flex gap-2">
                        <input type="text" placeholder="Your Name" class="w-1/3 p-2 border border-gray-300 rounded-lg text-sm" required>
                        <input type="text" placeholder="Write a reply..." class="flex-grow p-2 border border-gray-300 rounded-lg text-sm" required>
                        <button type="submit" class="bg-gray-200 text-gray-700 font-semibold py-2 px-3 rounded-lg hover:bg-gray-300 text-sm">Reply</button>
                    </div>
                </form>

                <div class="mt-3 text-right">
                    <button class="suggest-reply-btn bg-green-100 text-green-800 text-xs font-semibold py-1 px-3 rounded-full hover:bg-green-200 transition" 
                        data-review-text="${review.text ? review.text.replace(/"/g, '&quot;') : ''}" 
                        data-review-rating="${review.rating}">
                        ✨ Suggest Reply
                    </button>
                </div>
            </div>
        `).join('');

        updateReviewSummary();
        attachReplyHandlers();
        attachAIFeatureHandlers();
    }

    function renderReplies(replies) {
        return (replies || []).map(reply => `
            <div class="bg-gray-50 p-3 rounded-md mb-2">
                <p class="font-semibold text-gray-800">${reply.name ? reply.name.replace(/</g, "&lt;") : 'Anonymous'}</p>
                <p class="text-gray-700">${reply.text ? reply.text.replace(/</g, "&lt;") : ''}</p>
            </div>
        `).join('');
    }

    function updateReviewSummary() {
        if (!reviewSummary) return;
        if (allReviews.length === 0) {
            reviewSummary.innerHTML = '<p class="text-gray-500">No reviews yet to generate a summary.</p>';
            summarizeBtn.disabled = true;
            return;
        }
        summarizeBtn.disabled = false;
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
             <div class="text-yellow-500 text-2xl">${'&#9733;'.repeat(Math.round(averageRating))}${'&#9734;'.repeat(5 - Math.round(averageRating))}</div>
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

    // 1. LISTEN for real-time updates from Firestore
    try {
        const q = query(reviewsCollection, orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            allReviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderReviews();
        }, (error) => {
            console.error("Error fetching reviews:", error);
            reviewsContainer.innerHTML = '<p class="text-center text-red-500 font-bold">Could not load reviews. Please check your connection or security rules.</p>';
        });
    } catch (error) {
        console.error("Firestore query failed:", error);
        reviewsContainer.innerHTML = '<p class="text-center text-red-500 font-bold">There was an error setting up the reviews listener.</p>';
    }


    // 2. SUBMIT a new review to Firestore
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
                document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);
            } catch (error) {
                console.error("Error adding review: ", error);
                alert("Sorry, there was an error submitting your review.");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Submit Review";
            }
        });
    }

    // 3. ADD a reply to an existing review in Firestore
    function attachReplyHandlers() {
        document.querySelectorAll('.reply-form').forEach(form => {
            if (form.dataset.listener) return;
            form.dataset.listener = 'true';

            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                const reviewId = this.dataset.reviewId;
                const reviewToUpdate = allReviews.find(r => r.id === reviewId);
                const replyButton = this.querySelector('button[type="submit"]');

                if (reviewToUpdate) {
                    replyButton.disabled = true;

                    const newReply = {
                        name: this.querySelector('input[type="text"]').value,
                        text: this.querySelectorAll('input[type="text"]')[1].value
                    };

                    const updatedReplies = [...(reviewToUpdate.replies || []), newReply];
                    const reviewRef = doc(db, "reviews", reviewId);

                    try {
                        await updateDoc(reviewRef, { replies: updatedReplies });
                        // No need to reset form, onSnapshot will re-render
                    } catch (error) {
                        console.error("Error adding reply: ", error);
                        alert("Sorry, couldn't add your reply.");
                        replyButton.disabled = false;
                    }
                }
            });
        });
    }

    // --- AI Feature Handlers (Remain mostly the same) ---
    function attachAIFeatureHandlers() {
        document.querySelectorAll('.suggest-reply-btn').forEach(button => {
            if (button.dataset.listenerAttached) return;
            button.dataset.listenerAttached = 'true';
            button.addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const replyInput = btn.closest('.review-item').querySelector('.reply-form input:nth-of-type(2)');
                if (!replyInput) return;

                const originalButtonText = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '✨ Thinking...';

                const prompt = `A customer left the following review for "The Bean":\n\nRating: ${btn.dataset.reviewRating} stars\nReview: "${btn.dataset.reviewText}"\n\nDraft a short, polite, professional response under 30 words. Thank positive reviewers or apologize to negative ones. Do not sign with a name.`;
                const suggestedReply = await callGeminiAPI(prompt);

                replyInput.value = suggestedReply.replace(/"/g, ''); // Remove quotes from Gemini response
                btn.disabled = false;
                btn.innerHTML = originalButtonText;
            });
        });
    }

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

});

