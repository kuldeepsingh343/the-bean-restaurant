function toggleMenu() {
    const nav = document.getElementById("nav-menu");
    nav.style.display = nav.style.display === "block" ? "none" : "block";
}

const form = document.getElementById("review-form");
const reviewList = document.getElementById("review-list");

form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("reviewer-name").value;
    const text = document.getElementById("review-text").value;

    const reviewDiv = document.createElement("div");
    reviewDiv.classList.add("review");
    reviewDiv.innerHTML = `<strong>${name}</strong><p>${text}</p>`;

    // Reply form
    const replyForm = document.createElement("form");
    replyForm.classList.add("reply-form");
    replyForm.innerHTML = `
      <input type="text" placeholder="Your Name" required>
      <input type="text" placeholder="Your Reply" required>
      <button type="submit">Reply</button>
    `;
    reviewDiv.appendChild(replyForm);

    const replyList = document.createElement("div");
    reviewDiv.appendChild(replyList);

    replyForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const replyName = replyForm.querySelector("input:nth-child(1)").value;
        const replyText = replyForm.querySelector("input:nth-child(2)").value;

        const replyDiv = document.createElement("div");
        replyDiv.classList.add("reply");
        replyDiv.innerHTML = `<strong>${replyName}</strong>: ${replyText}`;
        replyList.appendChild(replyDiv);

        replyForm.reset();
    });

    reviewList.appendChild(reviewDiv);
    form.reset();
});
function toggleMenu() {
    const nav = document.getElementById("nav-menu");
    nav.style.display = nav.style.display === "block" ? "none" : "block";
}

const form = document.getElementById("review-form");
const reviewList = document.getElementById("review-list");

form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("reviewer-name").value;
    const text = document.getElementById("review-text").value;

    const reviewDiv = document.createElement("div");
    reviewDiv.classList.add("review");
    reviewDiv.innerHTML = `<strong>${name}</strong><p>${text}</p>`;

    // Reply form
    const replyForm = document.createElement("form");
    replyForm.classList.add("reply-form");
    replyForm.innerHTML = `
    <input type="text" placeholder="Your Name" required>
    <input type="text" placeholder="Your Reply" required>
    <button type="submit">Reply</button>
  `;
    reviewDiv.appendChild(replyForm);

    const replyList = document.createElement("div");
    reviewDiv.appendChild(replyList);

    replyForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const replyName = replyForm.querySelector("input:nth-child(1)").value;
        const replyText = replyForm.querySelector("input:nth-child(2)").value;

        const replyDiv = document.createElement("div");
        replyDiv.classList.add("reply");
        replyDiv.innerHTML = `<strong>${replyName}</strong>: ${replyText}`;
        replyList.appendChild(replyDiv);

        replyForm.reset();
    });

    reviewList.appendChild(reviewDiv);
    form.reset();
});
