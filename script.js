// Toggle mobile menu
document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('nav-links').classList.toggle('show');
});

// Load existing reviews
const reviewsList = document.getElementById('reviews-list');
let reviews = JSON.parse(localStorage.getItem('reviews')) || [];

function displayReviews() {
    reviewsList.innerHTML = '';
    reviews.forEach(r => {
        const div = document.createElement('div');
        div.className = 'review';
        div.innerHTML = `<strong>${r.name}</strong><p>${r.text}</p>`;
        reviewsList.appendChild(div);
    });
}
displayReviews();

// Handle review submission
document.getElementById('review-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('reviewer-name').value;
    const text = document.getElementById('review-text').value;
    if (name && text) {
        reviews.push({ name, text });
        localStorage.setItem('reviews', JSON.stringify(reviews));
        displayReviews();
        e.target.reset();
    }
});
