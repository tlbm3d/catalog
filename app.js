const CATALOG_URL = "content/catalogo.json";
const INSTAGRAM_URL = "https://www.instagram.com/tlbm.3d/";

const money = value =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

let catalog = { categories: [], products: [] };
let cart = [];
let activeCategory = "Todos";
let searchTerm = "";

const searchInput = document.getElementById("productSearch");
const clearSearch = document.getElementById("clearSearch");
const grid = document.getElementById("productGrid");
const filters = document.getElementById("categoryFilters");
const template = document.getElementById("productTemplate");

async function loadCatalog() {
  try {
    const response = await fetch(
      `${CATALOG_URL}?v=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Não foi possível carregar o catálogo.");
    }

    catalog = await response.json();
    catalog.categories ||= [];
    catalog.products ||= [];

    renderFilters();
    renderProducts();

  } catch (error) {
    grid.innerHTML =
      '<div class="empty-state">Não foi possível carregar o catálogo agora. Tente atualizar a página.</div>';

    document.getElementById("productCount").textContent =
      "Catálogo indisponível";

    console.error(error);
  }
}

function renderFilters() {
  const names = [
    "Todos",
    ...catalog.categories
      .map(c => typeof c === "string" ? c : c.name)
      .filter(Boolean)
  ];

  filters.innerHTML = "";

  names.forEach(name => {
    const button = document.createElement("button");

    button.className =
      "filter-button" +
      (name === activeCategory ? " active" : "");

    button.textContent = name;

    button.addEventListener("click", () => {
      activeCategory = name;
      renderFilters();
      renderProducts();
    });

    filters.appendChild(button);
  });
}

// Remove acentos, pontuação e diferenças entre maiúsculas e minúsculas.
function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Calcula a distância entre duas palavras.
// Também reconhece letras que foram digitadas na ordem errada.
function editDistance(a, b) {
  const matrix = Array.from(
    { length: a.length + 1 },
    () => Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(
          matrix[i][j],
          matrix[i - 2][j - 2] + 1
        );
      }
    }
  }

  return matrix[a.length][b.length];
}

// Compara duas palavras e retorna uma pontuação de semelhança.
function wordSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;

  if (
    a.length >= 4 &&
    (a.startsWith(b) || b.startsWith(a))
  ) {
    return 0.88;
  }

  // Evita correspondências aleatórias com palavras muito curtas.
  if (Math.min(a.length, b.length) < 3) {
    return 0;
  }

  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

// Calcula o quanto a pesquisa combina com determinado produto.
function productSearchScore(product, query) {
  const queryWords = normalizeText(query)
    .split(/\s+/)
    .filter(Boolean);

  if (!queryWords.length) return 1;

  const searchable = normalizeText(
    `${product.name || ""} ${product.description || ""} ${product.category || ""}`
  )
    .split(/\s+/)
    .filter(Boolean);

  if (!searchable.length) return 0;

  const scores = queryWords.map(word =>
    Math.max(
      ...searchable.map(candidate =>
        wordSimilarity(word, candidate)
      ),
      0
    )
  );

  const matched = scores.filter(score => score >= 0.55);

  // Exige que pelo menos 60% das palavras pesquisadas combinem.
  if (matched.length / queryWords.length < 0.6) {
    return 0;
  }

  return (
    matched.reduce((sum, score) => sum + score, 0) /
    queryWords.length
  );
}

function renderProducts() {
  const visibleProducts = catalog.products.filter(product =>
    product.active !== false &&
    (
      activeCategory === "Todos" ||
      product.category === activeCategory
    )
  );

  const query = searchTerm.trim();

  const products = query
    ? visibleProducts
        .map(product => ({
          product,
          score: productSearchScore(product, query)
        }))
        .filter(result => result.score >= 0.55)
        .sort((a, b) => b.score - a.score)
        .map(result => result.product)
    : visibleProducts;

  grid.innerHTML = "";

  document.getElementById("productCount").textContent = query
    ? `${products.length} ${
        products.length === 1 ? "resultado" : "resultados"
      }`
    : `${products.length} ${
        products.length === 1 ? "produto" : "produtos"
      }`;

  if (!products.length) {
    const message = query
      ? `Nenhum produto encontrado para “${query}”. Tente outra escrita ou confira se há produtos em outra categoria.`
      : (
          catalog.products.length
            ? "Nenhum produto nesta categoria por enquanto."
            : "Estamos preparando nosso catálogo! Em breve teremos novidades."
        );

    grid.innerHTML = `
      <div class="empty-state">
        ${message}<br>
        Você também pode solicitar uma impressão personalizada pelo Instagram.
      </div>
    `;

    return;
  }

  products.forEach(product => {
    const card =
      template.content.firstElementChild.cloneNode(true);

    const img = card.querySelector("img");

    img.src = product.image || "";
    img.alt = product.name || "Produto TLBM 3D";

    if (!product.image) {
      img.style.display = "none";
    }

    card.querySelector(".product-category").textContent =
      product.category || "Geral";

    card.querySelector(".product-name").textContent =
      product.name || "Produto";

    card.querySelector(".product-description").textContent =
      product.description || "";

    card.querySelector(".product-price").textContent =
      money(product.price);

    card.querySelector(".add-button").addEventListener(
      "click",
      () => addToCart(product)
    );

    grid.appendChild(card);
  });
}

// Atualiza os resultados enquanto o cliente digita.
searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value;
  clearSearch.hidden = !searchTerm;
  renderProducts();
});

// Limpa a pesquisa.
clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  searchTerm = "";
  clearSearch.hidden = true;

  renderProducts();
  searchInput.focus();
});

// Adiciona produtos ao carrinho.
function addToCart(product) {
  const item = cart.find(
    i =>
      i.name === product.name &&
      i.price === Number(product.price)
  );

  if (item) {
    item.quantity++;
  } else {
    cart.push({
      name: product.name,
      price: Number(product.price) || 0,
      quantity: 1
    });
  }

  renderCart();
  openCart();
}

// Atualiza a exibição do carrinho.
function renderCart() {
  const items = document.getElementById("cartItems");

  items.innerHTML = "";

  if (!cart.length) {
    items.innerHTML =
      '<p class="muted">Seu carrinho está vazio.</p>';
  }

  cart.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cart-row";

    const info = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = item.name;

    const line = document.createElement("small");
    line.textContent =
      `${money(item.price)} cada • ${money(item.price * item.quantity)}`;

    const remove = document.createElement("button");
    remove.className = "remove-item";
    remove.textContent = "Remover";

    remove.addEventListener("click", () => {
      cart.splice(index, 1);
      renderCart();
    });

    info.append(name, line, remove);

    const qty = document.createElement("div");
    qty.className = "quantity";

    const minus = document.createElement("button");
    minus.textContent = "−";
    minus.setAttribute(
      "aria-label",
      "Diminuir quantidade"
    );

    minus.addEventListener("click", () => {
      item.quantity--;

      if (item.quantity <= 0) {
        cart.splice(index, 1);
      }

      renderCart();
    });

    const count = document.createElement("span");
    count.textContent = item.quantity;

    const plus = document.createElement("button");
    plus.textContent = "+";
    plus.setAttribute(
      "aria-label",
      "Aumentar quantidade"
    );

    plus.addEventListener("click", () => {
      item.quantity++;
      renderCart();
    });

    qty.append(minus, count, plus);
    row.append(info, qty);
    items.appendChild(row);
  });

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  document.getElementById("cartSubtotal").textContent =
    money(total);

  document.getElementById("cartCount").textContent =
    cart.reduce((sum, item) => sum + item.quantity, 0);

  document.getElementById("checkoutButton").disabled =
    !cart.length;
}

// Abre e fecha o carrinho.
function openCart() {
  document.getElementById("cartPanel").classList.add("open");

  document.getElementById("cartPanel").setAttribute(
    "aria-hidden",
    "false"
  );

  document.getElementById("cartBackdrop").hidden = false;
}

function closeCart() {
  document.getElementById("cartPanel").classList.remove("open");

  document.getElementById("cartPanel").setAttribute(
    "aria-hidden",
    "true"
  );

  document.getElementById("cartBackdrop").hidden = true;
}

document.getElementById("openCart").addEventListener(
  "click",
  openCart
);

document.getElementById("closeCart").addEventListener(
  "click",
  closeCart
);

document.getElementById("cartBackdrop").addEventListener(
  "click",
  closeCart
);

// Copia o pedido e abre o Instagram.
document.getElementById("checkoutButton").addEventListener(
  "click",
  async () => {
    const lines = cart.map(item =>
      `• ${item.quantity}x ${item.name} — ${money(item.price)} cada = ${money(item.price * item.quantity)}`
    );

    const total = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const message =
      `Olá! Gostaria de fazer um pedido na TLBM 3D.\n\n` +
      `MEU PEDIDO:\n${lines.join("\n")}\n\n` +
      `Subtotal dos produtos: ${money(total)}\n\n` +
      `Entrega: a combinar (local combinado, Uber Envios ou Correios).\n\n` +
      `Aguardo confirmação sobre disponibilidade, frete, pagamento e prazo.`;

    const status = document.getElementById("copyStatus");

    try {
      await navigator.clipboard.writeText(message);

      status.textContent =
        "Pedido copiado! Cole a mensagem na conversa do Instagram.";

    } catch (error) {
      const area = document.createElement("textarea");

      area.value = message;
      document.body.appendChild(area);

      area.select();

      const copied = document.execCommand("copy");

      area.remove();

      status.textContent = copied
        ? "Pedido copiado! Cole a mensagem no Instagram."
        : "Não foi possível copiar automaticamente. Tente novamente.";
    }

    window.open(INSTAGRAM_URL, "_blank", "noopener");
  }
);

// Inicia o carregamento do catálogo.
loadCatalog();
