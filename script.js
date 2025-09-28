document.addEventListener('DOMContentLoaded', () => {

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=`;
    const API_KEY = "";

    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    menuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    const mobileNavLinks = document.querySelectorAll('#mobile-menu a');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
        });
    });

    const reviewForm = document.getElementById('review-form');
    const reviewsContainer = document.getElementById('reviews-container');
    const reviewSummary = document.getElementById('review-summary');
    const summarizeBtn = document.getElementById('summarize-btn');
    const summaryContainer = document.getElementById('summary-container');

    let reviews = JSON.parse(localStorage.getItem('restaurantReviews')) || [];

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

    function renderReviews() {
        if (!reviewsContainer) return; // Defensive check
        reviewsContainer.innerHTML = reviews.length === 0 ? '<p class="text-center text-gray-500">No reviews yet.</p>' : reviews.map((review, index) => `
            <div class="bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-green-500 review-item">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-bold">${review.name.replace(/</g, "&lt;")}</h4>
                    <div class="text-yellow-500">${'&#9733;'.repeat(review.rating)}${'&#9734;'.repeat(5 - review.rating)}</div>
                </div>
                <p class="text-gray-600 mb-4">${review.text.replace(/</g, "&lt;")}</p>
                <div class="text-sm text-gray-400">${review.date}</div>
                <div class="mt-4 pl-4 border-l-2 border-gray-200" id="replies-${index}">${renderReplies(review.replies || [])}</div>
                <form class="reply-form mt-4" data-review-index="${index}">
                     <div class="flex gap-2">
                        <input type="text" placeholder="Your Name" class="w-1/3 p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-400" required>
                        <input type="text" placeholder="Write a reply..." class="flex-grow p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-400" required>
                        <button type="submit" class="bg-gray-200 text-gray-700 font-semibold py-2 px-3 rounded-lg hover:bg-gray-300 text-sm transition">Reply</button>
                    </div>
                </form>
                <div class="mt-2 text-right">
                    <button class="suggest-reply-btn bg-green-100 text-green-800 text-xs font-semibold py-1 px-3 rounded-full hover:bg-green-200 transition" 
                        data-review-text="${review.text.replace(/"/g, '&quot;')}" 
                        data-review-rating="${review.rating}">
                        <span class="mr-1">✨</span> Suggest Reply
                    </button>
                </div>
            </div>
        `).join('');
        updateReviewSummary();
        attachReplyHandlers();
        attachAIFeatureHandlers();
    }

    function renderReplies(replies) {
        return replies.map(reply => `
            <div class="bg-gray-50 p-3 rounded-md mb-2">
                <p class="font-semibold text-gray-800">${reply.name.replace(/</g, "&lt;")}</p>
                <p class="text-gray-600">${reply.text.replace(/</g, "&lt;")}</p>
            </div>
        `).join('');
    }

    function updateReviewSummary() {
        if (!reviewSummary) return; // Defensive check
        if (reviews.length === 0) {
            reviewSummary.innerHTML = '<p class="text-gray-500">No reviews yet. Be the first!</p>';
            return;
        }
        const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(review => { ratingCounts[review.rating]++; });
        reviewSummary.innerHTML = Object.keys(ratingCounts).reverse().map(i => {
            const count = ratingCounts[i];
            const percentage = (count / reviews.length) * 100;
            return `
                <div class="flex items-center mb-1">
                    <span class="text-sm font-medium text-yellow-500 w-12">${i} star</span>
                    <div class="w-full h-4 mx-2 bg-gray-200 rounded"><div class="h-4 bg-green-500 rounded" style="width: ${percentage}%"></div></div>
                    <span class="text-sm font-medium text-gray-500 w-8 text-right">${count}</span>
                </div>`;
        }).join('');
    }

    if (reviewForm) {
        reviewForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const ratingInput = document.querySelector('input[name="rating"]:checked');
            if (!ratingInput) { alert("Please select a star rating."); return; }
            const newReview = {
                name: document.getElementById('reviewer-name').value,
                rating: parseInt(ratingInput.value),
                text: document.getElementById('review-text').value,
                date: new Date().toLocaleDateString(),
                replies: []
            };
            reviews.unshift(newReview);
            localStorage.setItem('restaurantReviews', JSON.stringify(reviews));
            renderReviews();
            reviewForm.reset();
            document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);
        });
    }


    function attachReplyHandlers() {
        document.querySelectorAll('.reply-form').forEach(form => {
            if (form.dataset.listener) return;
            form.dataset.listener = 'true';
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                const reviewIndex = this.dataset.reviewIndex;
                if (!reviews[reviewIndex].replies) reviews[reviewIndex].replies = [];
                reviews[reviewIndex].replies.push({
                    name: this.querySelector('input[type="text"]').value,
                    text: this.querySelectorAll('input[type="text"]')[1].value
                });
                localStorage.setItem('restaurantReviews', JSON.stringify(reviews));
                renderReviews();
            });
        });
    }

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
                const prompt = `A customer left the following review for "The Bean":\n\nRating: ${btn.dataset.reviewRating} stars\nReview: "${btn.dataset.reviewText}"\n\nDraft a short, polite, professional response under 30 words. Thank positive reviewers. Apologize to negative ones. Do not sign with a name.`;
                const suggestedReply = await callGeminiAPI(prompt);
                replyInput.value = suggestedReply.replace(/"/g, '');
                btn.disabled = false;
                btn.innerHTML = originalButtonText;
            });
        });
    }

    if (summarizeBtn) {
        summarizeBtn.addEventListener('click', async () => {
            if (reviews.length < 2) {
                summaryContainer.innerHTML = '<p class="text-blue-600 font-semibold">Please add at least two reviews to create a summary.</p>';
                return;
            }
            const originalButtonText = summarizeBtn.innerHTML;
            summarizeBtn.disabled = true;
            summarizeBtn.innerHTML = '✨ Generating...';
            summaryContainer.innerHTML = '<p class="text-gray-600 animate-pulse">Analyzing feedback...</p>';
            const reviewsText = reviews.map(r => `${r.name} (${r.rating}/5): "${r.text}"`).join('\n');
            const prompt = `Summarize the following customer reviews for "The Bean" in a single, friendly paragraph. Highlight common themes for a potential customer. No markdown.\n\nReviews:\n${reviewsText}`;
            const summary = await callGeminiAPI(prompt);
            summaryContainer.innerHTML = `<p class="text-gray-800 bg-green-100 p-4 rounded-lg border border-green-200">${summary.replace(/\n/g, '<br>')}</p>`;
            summarizeBtn.disabled = false;
            summarizeBtn.innerHTML = originalButtonText;
        });
    }


    renderReviews();

    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('header nav a');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            if (pageYOffset >= section.offsetTop - 120) { current = section.getAttribute('id'); }
        });
        navLinks.forEach(link => {
            link.classList.remove('nav-link-active');
            if (link.getAttribute('href').includes(current)) { link.classList.add('nav-link-active'); }
        });
    });

});

