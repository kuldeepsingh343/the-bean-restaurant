function toggleMenu() {
    document.querySelector("nav ul").classList.toggle("active");
}

// Handle reviews
const reviewForm = document.getElementById("reviewForm");
const reviewsList = document.getElementById("reviewsList");

reviewForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const name = document.getElementById("reviewerName").value;
    const text = document.getElementById("reviewText").value;

    const reviewDiv = document.createElement("div");
    reviewDiv.classList.add("review");
    reviewDiv.innerHTML = `<strong>${name}</strong><p>${text}</p>`;

    // Reply form
    const replyForm = document.createElement("form");
    replyForm.innerHTML = `
      <input type="text" placeholder="Your Name" required />
      <input type="text" placeholder="Write a reply..." required />
      <button type="submit">Reply</button>
    `;

    replyForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const replyName = replyForm.querySelector("input:nth-child(1)").value;
        const replyText = replyForm.querySelector("input:nth-child(2)").value;
        const replyDiv = document.createElement("div");
        replyDiv.classList.add("reply");
        replyDiv.innerHTML = `<strong>${replyName}</strong><p>${replyText}</p>`;
        reviewDiv.appendChild(replyDiv);
        replyForm.reset();
    });

    reviewDiv.appendChild(replyForm);
    reviewsList.appendChild(reviewDiv);

    reviewForm.reset();
});
