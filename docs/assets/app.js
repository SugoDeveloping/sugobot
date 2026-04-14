const body = document.body;
const mobileToggle = document.getElementById("mobileToggle");
const searchInput = document.getElementById("searchInput");
const navLinks = Array.from(document.querySelectorAll("#sidebarNav a"));
const sections = Array.from(document.querySelectorAll(".doc-section"));
const searchItems = Array.from(document.querySelectorAll("[data-search-item]"));
const revealItems = Array.from(document.querySelectorAll(".reveal"));

function normalize(value) {
  return (value || "").toLowerCase().trim();
}

function updateActiveLink() {
  const scrollPosition = window.scrollY + 160;
  let currentId = sections.find(section => !section.classList.contains("is-hidden"))?.id;

  for (const section of sections) {
    if (section.classList.contains("is-hidden")) continue;
    if (section.offsetTop <= scrollPosition) currentId = section.id;
  }

  navLinks.forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === `#${currentId}`);
  });
}

function closeNav() {
  body.classList.remove("nav-open");
}

function runSearch() {
  const query = normalize(searchInput.value);

  searchItems.forEach(item => {
    if (!query) {
      item.classList.remove("is-hidden");
      return;
    }
    const haystack = normalize(`${item.dataset.searchItem} ${item.textContent}`);
    item.classList.toggle("is-hidden", !haystack.includes(query));
  });

  sections.forEach(section => {
    const ownText = normalize(`${section.dataset.searchSection} ${section.textContent}`);
    const visibleChild = Array.from(section.querySelectorAll("[data-search-item]"))
      .some(item => !item.classList.contains("is-hidden"));
    const shouldShow = !query || ownText.includes(query) || visibleChild;
    section.classList.toggle("is-hidden", !shouldShow);
  });

  navLinks.forEach(link => {
    const target = document.querySelector(link.getAttribute("href"));
    link.classList.toggle("is-hidden", target?.classList.contains("is-hidden"));
  });

  updateActiveLink();
}

mobileToggle?.addEventListener("click", () => {
  body.classList.toggle("nav-open");
});

navLinks.forEach(link => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 940) closeNav();
  });
});

searchInput?.addEventListener("input", runSearch);
window.addEventListener("scroll", updateActiveLink, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth > 940) closeNav();
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("visible");
    observer.unobserve(entry.target);
  });
}, { threshold: 0.14 });

revealItems.forEach(item => observer.observe(item));
updateActiveLink();
