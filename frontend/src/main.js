// TrustLance frontend — single page, vanilla JS.
//
// Flow of the file:
//   1. state          : everything the UI shows
//   2. render*()      : state -> HTML (no blockchain calls inside)
//   3. actions        : button clicks -> transactions (chain.js)
//   4. event log      : contract events, refreshed at every new block
//   5. init()         : wiring
import "@fontsource/source-serif-4/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";

import { ethers } from "ethers";
import { icons } from "./icons.js";
import {
  deployment, readContract, readProvider, CHAIN_ID,
  hasMetaMask, connectWallet, switchToLocalNetwork,
  fetchMissions, fetchEscrowBalance, sendTx, timeTravel, explainError,
} from "./chain.js";
import { hashText, hashFile, saveText, getText, saveFileMeta, getFileMeta, importSeed } from "./offchain.js";
import { esc, short, eth, accountIndex, sameAddress, date, clock, duration, toDatetimeLocal } from "./format.js";

const REVIEW_PERIOD = 3 * 24 * 60 * 60; // must match TrustLance.REVIEW_PERIOD

const $ = (selector) => document.querySelector(selector);

// ===========================================================================
// 1. State
// ===========================================================================

const state = {
  account: null,        // connected MetaMask address
  chainId: null,        // MetaMask network
  missions: [],         // from fetchMissions()
  balance: 0n,          // ETH held by the contract
  blockNumber: 0,
  timeOffset: 0,        // chain clock - wall clock (grows after "+3 j")
  events: [],           // decoded contract events, newest first
  filter: "all",
  demo: false,          // show every action, even the forbidden ones
  open: new Set(),      // expanded mission ids
  busy: null,           // { key, stage } while a transaction is running
  nodeDown: false,
};

const isArbiter = () => !!deployment && sameAddress(state.account, deployment.arbiter);
const wrongNetwork = () => state.account && state.chainId !== CHAIN_ID;
const chainNow = () => Math.floor(Date.now() / 1000) + state.timeOffset;

// Display data for each status
const STATUS_UI = {
  Open:      { label: "Ouverte",   tone: "open" },
  Accepted:  { label: "Acceptée",  tone: "progress" },
  Delivered: { label: "Livrée",    tone: "review" },
  Completed: { label: "Payée",     tone: "done" },
  Cancelled: { label: "Annulée",   tone: "muted" },
  Disputed:  { label: "En litige", tone: "alert" },
  Resolved:  { label: "Arbitrée",  tone: "done" },
};

// ===========================================================================
// 2. Rendering
// ===========================================================================

/** "0xf39F…2266" + "#0" tag for Hardhat test accounts. */
function addressTag(address, { you = true } = {}) {
  if (!address) return `<span class="addr addr-empty">—</span>`;
  const idx = accountIndex(address);
  const me = you && sameAddress(address, state.account);
  return `<span class="addr" title="${esc(address)}">${idx >= 0 ? `<b>#${idx}</b>` : ""}${short(address)}${me ? `<em>vous</em>` : ""}</span>`;
}

function renderChainbar() {
  if (!deployment) {
    $("#chainbar").innerHTML = `<span class="chain-item chain-warn">${icons("triangle-alert")}Contrat non déployé</span>`;
    return;
  }
  $("#chainbar").innerHTML = state.nodeDown
    ? `<span class="chain-item chain-warn">${icons("unplug")}Nœud Hardhat injoignable sur 127.0.0.1:8545</span>`
    : `
      <span class="chain-item"><span class="dot dot-live"></span>Hardhat Local <span class="muted">31337</span></span>
      <span class="chain-item mono">Bloc ${state.blockNumber}</span>
      <span class="chain-item" title="Heure de la blockchain (block.timestamp)">${icons("clock")}<span class="mono">${date(chainNow())}</span></span>
      <button class="chain-item chain-btn" data-action="copy" data-value="${deployment.address}" title="Copier l'adresse du contrat">
        ${icons("file-code")}<span class="mono">${short(deployment.address)}</span>
      </button>
      <button class="chain-item chain-btn" data-action="time-travel" title="Démo locale : avance l'horloge du nœud de 3 jours">
        ${icons("fast-forward")}+3 jours
      </button>`;
}

function renderWallet() {
  const el = $("#wallet");
  if (!state.account) {
    el.innerHTML = `<button class="btn btn-primary" data-action="connect">${icons("wallet")}<span>Connecter MetaMask</span></button>`;
    return;
  }
  if (wrongNetwork()) {
    el.innerHTML = `<button class="btn btn-warn" data-action="switch-network">${icons("triangle-alert")}<span>Passer sur Hardhat Local</span></button>`;
    return;
  }
  const role = isArbiter()
    ? `<span class="role role-arbiter">${icons("scale")}Arbitre</span>`
    : `<span class="role">${icons("user")}Utilisateur</span>`;
  el.innerHTML = `<div class="account">${role}${addressTag(state.account, { you: false })}</div>`;
}

function renderSummary() {
  const n = state.missions.length;
  const open = state.missions.filter((m) => m.status === "Open").length;
  const disputes = state.missions.filter((m) => m.status === "Disputed").length;
  const parts = [
    `${n} mission${n > 1 ? "s" : ""}`,
    `<b class="mono">${eth(state.balance)} ETH</b> en séquestre`,
    `${open} ouverte${open > 1 ? "s" : ""}`,
  ];
  if (disputes) parts.push(`<span class="text-alert">${disputes} litige${disputes > 1 ? "s" : ""}${isArbiter() ? " à arbitrer" : ""}</span>`);
  $("#ledger-summary").innerHTML = parts.join('<span class="sep">·</span>');
}

const FILTERS = [
  { key: "all", label: "Toutes", test: () => true },
  { key: "open", label: "Ouvertes", test: (m) => m.status === "Open" },
  { key: "mine", label: "Mes missions", test: (m) => sameAddress(m.client, state.account) || sameAddress(m.freelancer, state.account) },
  { key: "disputed", label: "Litiges", test: (m) => m.status === "Disputed" },
];

function renderFilters() {
  $("#filters").innerHTML = FILTERS.map((f) => {
    const count = state.missions.filter(f.test).length;
    return `<button class="filter ${state.filter === f.key ? "is-active" : ""}" data-action="filter" data-value="${f.key}">
      ${f.label}<span class="count">${count}</span></button>`;
  }).join("");
}

/** Steps shown in the progress track, depending on the branch taken. */
function stepsFor(status) {
  if (status === "Cancelled") return { steps: ["Ouverte", "Annulée"], current: 1 };
  if (status === "Disputed" || status === "Resolved") {
    return { steps: ["Ouverte", "Acceptée", "Livrée", "Litige", "Arbitrée"], current: status === "Disputed" ? 3 : 4 };
  }
  const order = ["Open", "Accepted", "Delivered", "Completed"];
  return { steps: ["Ouverte", "Acceptée", "Livrée", "Payée"], current: order.indexOf(status) };
}

function renderTrack(m) {
  const { steps, current } = stepsFor(m.status);
  const final = ["Completed", "Cancelled", "Resolved"].includes(m.status);
  return `<ol class="track">${steps.map((s, i) => {
    const cls = i < current || (i === current && final) ? "is-done" : i === current ? "is-current" : "";
    return `<li class="${cls}"><span>${s}</span></li>`;
  }).join("")}</ol>`;
}

/**
 * Buttons for a mission. `allowed` = what the connected account may do
 * (same rules as the contract). In demo mode the others are shown too.
 */
function actionsFor(m) {
  const me = state.account;
  const isClient = sameAddress(me, m.client);
  const isFreelancer = sameAddress(me, m.freelancer);
  const s = m.status;

  const all = [
    { action: "accept",  label: "Accepter",              icon: "handshake",   style: "primary", allowed: s === "Open" && !!me && !isClient },
    { action: "cancel",  label: "Annuler et rembourser", icon: "ban",         style: "ghost",   allowed: s === "Open" && isClient },
    { action: "deliver", label: "Livrer le travail",     icon: "upload",      style: "primary", allowed: s === "Accepted" && isFreelancer },
    { action: "approve", label: "Approuver et payer",    icon: "hand-coins",  style: "primary", allowed: s === "Delivered" && isClient },
    { action: "claim",   label: "Réclamer le paiement",  icon: "hourglass",   style: "default", allowed: s === "Delivered" && isFreelancer },
    { action: "dispute", label: "Ouvrir un litige",      icon: "shield-alert", style: "ghost",  allowed: s === "Delivered" && (isClient || isFreelancer) },
    { action: "resolve", label: "Arbitrer",              icon: "gavel",       style: "primary", allowed: s === "Disputed" && isArbiter() },
  ];
  return { allowed: all.filter((a) => a.allowed), forbidden: all.filter((a) => !a.allowed) };
}

function actionButton(m, a, extraClass = "") {
  const key = `${m.id}:${a.action}`;
  const busy = state.busy?.key === key;
  const stageLabel = { simulate: "Simulation…", sign: "Signature MetaMask…", mining: "Confirmation…" }[state.busy?.stage];
  return `<button class="btn btn-${a.style} ${extraClass}" data-action="${a.action}" data-id="${m.id}" ${state.busy ? "disabled" : ""}>
    ${busy ? icons("loader", "spin") : icons(a.icon)}<span>${busy ? stageLabel : a.label}</span></button>`;
}

/** Off-chain description with integrity check against the on-chain hash. */
function renderDescription(m) {
  const text = getText(m.descriptionHash);
  if (text === null) {
    return `<p class="desc desc-missing">${icons("eye-off")}Texte non disponible dans ce navigateur. Seule son empreinte est publique.</p>`;
  }
  const ok = hashText(text) === m.descriptionHash;
  return `<p class="desc">${esc(text)}</p>
    <span class="integrity ${ok ? "is-ok" : "is-bad"}">${icons(ok ? "shield-check" : "shield-alert")}
      ${ok ? "Empreinte vérifiée : le texte correspond au hash on-chain" : "Le texte ne correspond pas au hash on-chain"}</span>`;
}

function renderDeliverable(m) {
  if (!m.deliverableHash) return `<span class="muted">Pas encore livré</span>`;
  const file = getFileMeta(m.deliverableHash);
  const text = getText(m.deliverableHash);
  const label = file ? `${icons("file-check")}${esc(file.name)}` : text !== null ? `${icons("type")}Texte livré` : "";
  return `${label ? `<span class="deliv-label">${label}</span>` : ""}
    <button class="hash" data-action="copy" data-value="${m.deliverableHash}" title="Copier">${short(m.deliverableHash, 10, 8)}</button>
    <button class="link-btn" data-action="verify" data-id="${m.id}">Vérifier un fichier</button>`;
}

/** Timing line: deadline countdown or review period. */
function timingNote(m) {
  const now = chainNow();
  if (m.status === "Open" || m.status === "Accepted") {
    const left = m.deadline - now;
    return left > 0
      ? `${icons("calendar-clock")}Livraison attendue avant le ${date(m.deadline)} <span class="muted">(${duration(left)})</span>`
      : `<span class="text-alert">${icons("calendar-clock")}Échéance dépassée depuis ${duration(-left)}</span>`;
  }
  if (m.status === "Delivered") {
    const left = m.deliveredAt + REVIEW_PERIOD - now;
    return left > 0
      ? `${icons("hourglass")}Revue du client : encore ${duration(left)} avant la réclamation automatique`
      : `<span class="text-ok">${icons("hourglass")}Période de revue écoulée : le freelance peut réclamer le paiement</span>`;
  }
  return "";
}

function renderMission(m) {
  const ui = STATUS_UI[m.status];
  const open = state.open.has(m.id);
  const { allowed, forbidden } = actionsFor(m);
  const isClient = sameAddress(state.account, m.client);
  const isFreelancer = sameAddress(state.account, m.freelancer);
  const myRole = isClient ? "Client" : isFreelancer ? "Freelance" : null;
  const needsMe = allowed.length > 0;

  return `
  <article class="mission ${open ? "is-open" : ""}" data-tone="${ui.tone}">
    <button class="mission-head" data-action="toggle" data-id="${m.id}" aria-expanded="${open}">
      <span class="m-id mono">${String(m.id).padStart(2, "0")}</span>
      <span class="m-main">
        <span class="m-title">${esc(m.title)}</span>
        <span class="m-sub">${addressTag(m.client)}<span class="arrow">${icons("arrow-right")}</span>${addressTag(m.freelancer)}</span>
      </span>
      <span class="m-meta">
        ${myRole ? `<span class="chip">${myRole}</span>` : ""}
        ${needsMe ? `<span class="chip chip-action" title="Une action vous attend">À vous</span>` : ""}
      </span>
      <span class="m-amount mono">${eth(m.amount)}<small>ETH</small></span>
      <span class="stamp stamp-${ui.tone}">${ui.label}</span>
      <span class="m-chevron">${icons("chevron-down")}</span>
    </button>

    ${open ? `
    <div class="mission-body">
      ${renderTrack(m)}
      <div class="m-grid">
        <section class="m-desc">
          <h4>Description <em>hors-chaîne</em></h4>
          ${renderDescription(m)}
        </section>
        <dl class="m-facts">
          <div><dt>Client</dt><dd>${addressTag(m.client)}</dd></div>
          <div><dt>Freelance</dt><dd>${addressTag(m.freelancer)}</dd></div>
          <div><dt>Échéance</dt><dd class="mono">${date(m.deadline)}</dd></div>
          <div><dt>Livré le</dt><dd class="mono">${m.deliveredAt ? date(m.deliveredAt) : "—"}</dd></div>
          <div class="wide"><dt>Hash description</dt><dd><button class="hash" data-action="copy" data-value="${m.descriptionHash}" title="Copier">${short(m.descriptionHash, 10, 8)}</button></dd></div>
          <div class="wide"><dt>Hash livrable</dt><dd class="deliv">${renderDeliverable(m)}</dd></div>
        </dl>
      </div>
      ${timingNote(m) ? `<p class="timing">${timingNote(m)}</p>` : ""}
      <div class="m-actions">
        ${allowed.map((a) => actionButton(m, a)).join("")}
        ${!allowed.length && !state.demo ? `<span class="muted small">${state.account ? "Aucune action disponible pour votre compte." : "Connectez MetaMask pour agir sur cette mission."}</span>` : ""}
      </div>
      ${state.demo && forbidden.length ? `
      <div class="m-actions m-actions-demo">
        <span class="demo-label">${icons("flask-conical")}Mode démo, normalement masqué&nbsp;:</span>
        ${forbidden.map((a) => actionButton(m, { ...a, style: "demo" })).join("")}
      </div>` : ""}
    </div>` : ""}
  </article>`;
}

function renderLedger() {
  const el = $("#ledger");
  if (!deployment) {
    el.innerHTML = emptyState("file-code", "Contrat non déployé",
      "Lancez <code>npx hardhat node</code>, puis <code>npm run deploy</code> à la racine du projet. La page se recharge seule.");
    return;
  }
  if (state.nodeDown) {
    el.innerHTML = emptyState("unplug", "Nœud injoignable", "Démarrez <code>npx hardhat node</code> puis rechargez la page.");
    return;
  }
  const filter = FILTERS.find((f) => f.key === state.filter);
  const list = state.missions.filter(filter.test);
  el.innerHTML = list.length
    ? list.map(renderMission).join("")
    : emptyState("inbox", "Aucune mission ici", state.missions.length ? "Changez de filtre pour voir les autres missions." : "Publiez la première mission avec le formulaire.");
}

function emptyState(icon, title, text) {
  return `<div class="empty">${icons(icon)}<h3>${title}</h3><p>${text}</p></div>`;
}

function renderForm() {
  const foot = $("#create-foot");
  const submit = $("#create-submit");
  const busy = state.busy?.key === "create";
  submit.disabled = !!state.busy || !deployment;
  submit.innerHTML = busy
    ? `${icons("loader", "spin")}<span>${{ simulate: "Simulation…", sign: "Signature MetaMask…", mining: "Confirmation…" }[state.busy.stage]}</span>`
    : `${icons("lock")}<span>Bloquer les fonds et publier</span>`;
  foot.textContent = !state.account ? "Connectez MetaMask pour publier une mission." : "";
}

// --- Event log -------------------------------------------------------------

const EVENT_UI = {
  MissionCreated:   { icon: "lock",         label: "Mission créée" },
  MissionCancelled: { icon: "ban",          label: "Mission annulée" },
  MissionAccepted:  { icon: "handshake",    label: "Mission acceptée" },
  WorkDelivered:    { icon: "upload",       label: "Travail livré" },
  PaymentReleased:  { icon: "hand-coins",   label: "Paiement libéré" },
  DisputeOpened:    { icon: "shield-alert", label: "Litige ouvert" },
  DisputeResolved:  { icon: "gavel",        label: "Litige arbitré" },
};

function eventDetail(e) {
  const a = e.args;
  switch (e.name) {
    case "MissionCreated":   return `<b class="mono">${eth(a.amount)} ETH</b> bloqués par ${addressTag(a.client)}`;
    case "MissionCancelled": return `<b class="mono">${eth(a.refund)} ETH</b> remboursés à ${addressTag(a.client)}`;
    case "MissionAccepted":  return `par ${addressTag(a.freelancer)}`;
    case "WorkDelivered":    return `hash <span class="mono">${short(a.deliverableHash, 8, 6)}</span>`;
    case "PaymentReleased":  return `<b class="mono">${eth(a.amount)} ETH</b> versés à ${addressTag(a.freelancer)}${a.autoClaimed ? " (réclamation après 3 jours)" : ""}`;
    case "DisputeOpened":    return `par ${addressTag(a.openedBy)}`;
    case "DisputeResolved": {
      const pct = Number(a.freelancerShareBps) / 100;
      return `${pct} % / ${100 - pct} % — <b class="mono">${eth(a.freelancerAmount)}</b> freelance, <b class="mono">${eth(a.clientAmount)}</b> client`;
    }
    default: return "";
  }
}

function renderLog() {
  const el = $("#log");
  if (!state.events.length) {
    el.innerHTML = `<li class="log-empty">Aucun événement. Les événements émis par le contrat apparaîtront ici dès leur minage.</li>`;
    return;
  }
  el.innerHTML = state.events.map((e) => {
    const ui = EVENT_UI[e.name] ?? { icon: "radio", label: e.name };
    return `<li class="log-item ${e.fresh ? "is-fresh" : ""}" data-event="${e.name}">
      <span class="log-icon">${icons(ui.icon)}</span>
      <div class="log-body">
        <p class="log-title"><span>${ui.label}</span><span class="mono">#${e.args.id}</span></p>
        <p class="log-detail">${eventDetail(e)}</p>
        <p class="log-meta mono"><span>${e.name}</span><span>bloc ${e.blockNumber}</span><span>${e.timestamp ? clock(e.timestamp) : ""}</span></p>
      </div>
    </li>`;
  }).join("");
}

// --- Notices (red error box / green confirmation) --------------------------

function notify({ kind, title, reason, explanation }) {
  const el = document.createElement("div");
  el.className = `notice notice-${kind}`;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.innerHTML = `
    <span class="notice-icon">${icons(kind === "error" ? "circle-alert" : "circle-check")}</span>
    <div class="notice-body">
      <p class="notice-title">${esc(title)}</p>
      ${reason ? `<p class="notice-reason"><span>revert</span><code>"${esc(reason)}"</code></p>` : ""}
      ${explanation ? `<p class="notice-text">${esc(explanation)}</p>` : ""}
    </div>
    <button class="notice-close" aria-label="Fermer">${icons("x")}</button>`;
  el.querySelector(".notice-close").onclick = () => el.remove();
  $("#notices").prepend(el);
  // Errors stay until closed (needed for the demo); successes fade out.
  if (kind !== "error") setTimeout(() => el.remove(), 6000);
}

const showError = (err) => notify({ kind: "error", ...explainError(err) });

function renderAll() {
  const live = $("#live-indicator");
  live.classList.toggle("is-down", state.nodeDown || !deployment);
  live.lastChild.textContent = state.nodeDown || !deployment ? "hors ligne" : `bloc ${state.blockNumber}`;
  renderChainbar();
  renderWallet();
  renderSummary();
  renderFilters();
  renderLedger();
  renderForm();
  renderLog();
}

// ===========================================================================
// 3. Actions
// ===========================================================================

/** Wraps a transaction: busy state, error box, success notice, refresh. */
async function runTx(key, method, args, overrides, successText) {
  if (!state.account) return showError(new Error("Connectez d'abord MetaMask."));
  if (wrongNetwork()) return showError(new Error("MetaMask n'est pas sur le réseau Hardhat Local (chainId 31337)."));

  state.busy = { key, stage: "simulate" };
  renderAll();
  let receipt = null;
  try {
    receipt = await sendTx(state.account, method, args, overrides, (stage) => {
      state.busy = { key, stage };
      renderLedger();
      renderForm();
    });
  } catch (err) {
    showError(err);
  }
  state.busy = null;
  await refresh(); // update the list first, then confirm
  if (receipt) {
    notify({ kind: "success", title: successText, explanation: `Transaction minée dans le bloc ${receipt.blockNumber}.` });
  }
  return receipt;
}

async function onConnect() {
  try {
    const { account, chainId } = await connectWallet();
    state.account = account;
    state.chainId = chainId;
    renderAll();
  } catch (err) {
    showError(err);
  }
}

async function onCreate(event) {
  event.preventDefault();
  const form = event.target;
  const title = form.title.value.trim();
  const description = form.description.value.trim();

  // Front-end parsing only. Business rules (amount > 0, deadline in the
  // future) are deliberately left to the contract so its errors are visible.
  let value;
  try {
    value = ethers.parseEther(form.amount.value.trim().replace(",", ".") || "0");
  } catch {
    return showError(new Error("Montant invalide : utilisez un nombre, par exemple 0.25"));
  }
  const deadline = form.deadline.value ? Math.floor(new Date(form.deadline.value).getTime() / 1000) : 0;

  // Off-chain: keep the text locally, send only its fingerprint.
  const descriptionHash = hashText(description);
  saveText(descriptionHash, description);

  const receipt = await runTx("create", "createMission", [title, descriptionHash, deadline], { value }, "Mission publiée, fonds bloqués");
  if (receipt) {
    form.reset();
    form.deadline.value = toDatetimeLocal(chainNow() + 7 * 86400);
    updateDescriptionHash();
  }
}

function updateDescriptionHash() {
  const text = $("#create-form").description.value.trim();
  $("#description-hash").textContent = short(hashText(text), 10, 8);
}

const findMission = (id) => state.missions.find((m) => m.id === id);

async function onMissionAction(action, id) {
  const m = findMission(id);
  const key = `${id}:${action}`;
  switch (action) {
    case "accept":  return runTx(key, "acceptMission", [id], {}, `Mission #${id} acceptée`);
    case "cancel":  return runTx(key, "cancelMission", [id], {}, `Mission #${id} annulée, client remboursé`);
    case "approve": return runTx(key, "approveWork", [id], {}, `Travail approuvé, ${eth(m.amount)} ETH versés`);
    case "claim":   return runTx(key, "claimPayment", [id], {}, `Paiement réclamé, ${eth(m.amount)} ETH reçus`);
    case "dispute": return runTx(key, "openDispute", [id], {}, `Litige ouvert sur la mission #${id}`);
    case "deliver": return openHashDialog(m, "deliver");
    case "verify":  return openHashDialog(m, "verify");
    case "resolve": return openResolveDialog(m);
  }
}

// --- Dialogs ---------------------------------------------------------------

const dialog = $("#dialog");

function closeDialog() {
  dialog.close();
  dialog.innerHTML = "";
}

/**
 * Deliver (send a hash) or Verify (compare a file with the on-chain hash).
 * The user picks a file or types a text; the keccak256 is computed live.
 */
function openHashDialog(m, mode) {
  const deliver = mode === "deliver";
  dialog.innerHTML = `
    <form method="dialog" class="dialog-inner" id="hash-form">
      <header class="dialog-head">
        <div>
          <p class="eyebrow">Mission #${m.id}</p>
          <h2>${deliver ? "Livrer le travail" : "Vérifier un livrable"}</h2>
          <p>${deliver
            ? "Le fichier reste chez vous : seule son empreinte keccak256 est inscrite dans le contrat. Le client pourra la comparer au fichier reçu."
            : "Déposez le fichier reçu du freelance : son empreinte est comparée à celle enregistrée on-chain."}</p>
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Fermer">${icons("x")}</button>
      </header>

      <div class="segmented" role="tablist">
        <button type="button" role="tab" class="is-active" data-tab="file">${icons("file-up")}Fichier</button>
        <button type="button" role="tab" data-tab="text">${icons("type")}Texte</button>
      </div>

      <label class="dropzone" data-pane="file">
        <input type="file" name="file" />
        ${icons("upload")}
        <span class="dz-title">Choisir ou glisser un fichier</span>
        <span class="dz-sub">Le hash est calculé dans le navigateur, rien n'est envoyé.</span>
      </label>
      <label class="field" data-pane="text" hidden>
        <span class="field-label">Texte du livrable</span>
        <textarea name="text" rows="5" placeholder="Ex. lien du dépôt GitHub + numéro de commit"></textarea>
      </label>

      <div class="hash-out">
        <span class="field-label">Empreinte keccak256</span>
        <code id="hash-value">—</code>
        ${!deliver ? `<p class="hash-compare" id="hash-compare"></p>` : ""}
      </div>

      <footer class="dialog-foot">
        <button type="button" class="btn btn-ghost" data-close>Fermer</button>
        ${deliver ? `<button type="submit" class="btn btn-primary" id="hash-submit">${icons("send")}<span>Envoyer l'empreinte</span></button>` : ""}
      </footer>
    </form>`;
  hydrateIcons(dialog);

  const form = dialog.querySelector("#hash-form");
  let current = { hash: null, file: null, text: null };

  const show = async () => {
    const tab = form.querySelector("[data-tab].is-active").dataset.tab;
    const file = form.file.files[0];
    const text = form.text.value;
    current = { hash: null, file: null, text: null };
    if (tab === "file" && file) current = { hash: await hashFile(file), file, text: null };
    if (tab === "text" && text.trim()) current = { hash: hashText(text), file: null, text };

    form.querySelector("#hash-value").textContent = current.hash ?? "—";
    form.querySelector(".dz-title").textContent = file ? file.name : "Choisir ou glisser un fichier";

    const compare = form.querySelector("#hash-compare");
    if (compare) {
      const ok = current.hash && current.hash === m.deliverableHash;
      compare.className = `hash-compare ${current.hash ? (ok ? "is-ok" : "is-bad") : ""}`;
      compare.innerHTML = !current.hash ? "" : ok
        ? `${icons("shield-check")}Identique au hash on-chain : c'est bien le fichier livré.`
        : `${icons("shield-alert")}Différent du hash on-chain (${short(m.deliverableHash, 8, 6)}).`;
      hydrateIcons(compare);
    }
  };

  form.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) {
      form.querySelectorAll("[data-tab]").forEach((t) => t.classList.toggle("is-active", t === tab));
      form.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab.dataset.tab));
      show();
    }
    if (e.target.closest("[data-close]")) closeDialog();
  });
  form.file.addEventListener("change", show);
  form.text.addEventListener("input", show);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!deliver) return;
    // An empty hash is sent as 0x00..00 on purpose: the contract rejects it.
    const hash = current.hash ?? ethers.ZeroHash;
    if (current.file) saveFileMeta(hash, current.file);
    if (current.text) saveText(hash, current.text);
    closeDialog();
    await runTx(`${m.id}:deliver`, "deliverWork", [m.id, hash], {}, `Livrable de la mission #${m.id} enregistré`);
  });

  dialog.showModal();
}

/** Arbiter: choose the freelancer's share (basis points) with a slider. */
function openResolveDialog(m) {
  dialog.innerHTML = `
    <form method="dialog" class="dialog-inner" id="resolve-form">
      <header class="dialog-head">
        <div>
          <p class="eyebrow">Mission #${m.id} · ${eth(m.amount)} ETH en jeu</p>
          <h2>Arbitrer le litige</h2>
          <p>Répartissez les fonds bloqués entre le freelance et le client. La décision est définitive.</p>
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Fermer">${icons("x")}</button>
      </header>

      <div class="split">
        <div class="split-side"><span>Freelance</span><b class="mono" id="split-f"></b><small id="split-fp"></small></div>
        <div class="split-side split-right"><span>Client</span><b class="mono" id="split-c"></b><small id="split-cp"></small></div>
      </div>
      <input type="range" name="share" min="0" max="10000" step="500" value="5000" class="range" aria-label="Part du freelance en points de base" />
      <div class="presets">
        ${[0, 2500, 5000, 7500, 10000].map((v) => `<button type="button" class="btn btn-ghost btn-sm" data-preset="${v}">${v / 100} %</button>`).join("")}
      </div>
      <p class="field-hint mono" id="split-bps"></p>

      <footer class="dialog-foot">
        <button type="button" class="btn btn-ghost" data-close>Fermer</button>
        <button type="submit" class="btn btn-primary">${icons("gavel")}<span>Rendre la décision</span></button>
      </footer>
    </form>`;
  hydrateIcons(dialog);

  const form = dialog.querySelector("#resolve-form");
  const update = () => {
    const bps = BigInt(form.share.value);
    const toFreelancer = (m.amount * bps) / 10000n; // same formula as the contract
    form.querySelector("#split-f").textContent = `${eth(toFreelancer)} ETH`;
    form.querySelector("#split-c").textContent = `${eth(m.amount - toFreelancer)} ETH`;
    form.querySelector("#split-fp").textContent = `${Number(bps) / 100} %`;
    form.querySelector("#split-cp").textContent = `${100 - Number(bps) / 100} %`;
    form.querySelector("#split-bps").textContent = `resolveDispute(${m.id}, ${bps})`;
    form.share.style.setProperty("--fill", `${Number(bps) / 100}%`);
  };
  form.share.addEventListener("input", update);
  form.addEventListener("click", (e) => {
    const preset = e.target.closest("[data-preset]");
    if (preset) { form.share.value = preset.dataset.preset; update(); }
    if (e.target.closest("[data-close]")) closeDialog();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const bps = Number(form.share.value);
    closeDialog();
    await runTx(`${m.id}:resolve`, "resolveDispute", [m.id, bps], {}, `Litige #${m.id} arbitré`);
  });
  update();
  dialog.showModal();
}

// ===========================================================================
// 4. Chain data + event log
// ===========================================================================

const blockTimes = new Map();
async function blockTime(n) {
  if (!blockTimes.has(n)) blockTimes.set(n, (await readProvider.getBlock(n)).timestamp);
  return blockTimes.get(n);
}

let lastLogBlock = 0;

/** Reads the contract events between two blocks and adds them to the log. */
async function pullEvents(fromBlock, toBlock, fresh) {
  if (toBlock < fromBlock) return;
  const logs = await readContract.queryFilter("*", fromBlock, toBlock);
  const decoded = await Promise.all(logs.filter((l) => l.eventName).map(async (l) => ({
    key: `${l.transactionHash}:${l.index}`,
    name: l.eventName,
    args: l.args,
    blockNumber: l.blockNumber,
    timestamp: await blockTime(l.blockNumber),
    fresh,
  })));
  const known = new Set(state.events.map((e) => e.key));
  const added = decoded.filter((e) => !known.has(e.key)).reverse();
  state.events.forEach((e) => (e.fresh = false));
  state.events = [...added, ...state.events].slice(0, 200);
  lastLogBlock = toBlock;
}

/** Re-reads missions, balance and clock from the node. */
async function refresh() {
  if (!deployment) return renderAll();
  try {
    const [missions, balance, block] = await Promise.all([fetchMissions(), fetchEscrowBalance(), readProvider.getBlock("latest")]);
    state.missions = missions;
    state.balance = balance;
    state.blockNumber = block.number;
    state.timeOffset = Math.max(0, block.timestamp - Math.floor(Date.now() / 1000));
    state.nodeDown = false;
  } catch (err) {
    console.error(err);
    state.nodeDown = true;
  }
  renderAll();
}

/** Called by ethers at every new block mined on the node. */
async function onBlock(blockNumber) {
  // Flash the "en direct" dot: it only moves when a block really arrives.
  const live = $("#live-indicator");
  live.classList.add("is-tick");
  setTimeout(() => live.classList.remove("is-tick"), 500);
  try {
    await pullEvents(lastLogBlock + 1, blockNumber, true);
  } catch (err) {
    console.error(err);
  }
  await refresh();
}

// ===========================================================================
// 5. Init
// ===========================================================================

/** Replaces <i data-lucide> placeholders (static HTML) with SVG icons. */
function hydrateIcons(root = document) {
  root.querySelectorAll("i[data-lucide]").forEach((i) => {
    i.outerHTML = icons(i.dataset.lucide);
  });
}

function wireEvents() {
  // One delegated click handler for every [data-action] button.
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || btn.closest("dialog")) return;
    const { action, id, value } = btn.dataset;

    switch (action) {
      case "connect": return onConnect();
      case "switch-network":
        try { await switchToLocalNetwork(); } catch (err) { showError(err); }
        return;
      case "toggle": {
        const n = Number(id);
        state.open.has(n) ? state.open.delete(n) : state.open.add(n);
        return renderLedger();
      }
      case "filter":
        state.filter = value;
        renderFilters();
        return renderLedger();
      case "copy":
        e.stopPropagation();
        try { await navigator.clipboard.writeText(value); notify({ kind: "success", title: "Copié", explanation: value }); } catch { /* clipboard blocked */ }
        return;
      case "time-travel":
        try {
          await timeTravel(3 * 24 * 60 * 60);
          notify({ kind: "success", title: "Horloge avancée de 3 jours", explanation: "Un bloc a été miné avec le nouvel horodatage." });
        } catch (err) { showError(err); }
        return;
      default:
        if (id) return onMissionAction(action, Number(id));
    }
  });

  const form = $("#create-form");
  form.addEventListener("submit", onCreate);
  form.description.addEventListener("input", updateDescriptionHash);

  $("#demo-toggle").addEventListener("change", (e) => {
    state.demo = e.target.checked;
    renderLedger();
  });

  dialog.addEventListener("close", () => (dialog.innerHTML = ""));

  // MetaMask account / network changes
  if (hasMetaMask()) {
    window.ethereum.on("accountsChanged", (accounts) => {
      state.account = accounts[0] ? ethers.getAddress(accounts[0]) : null;
      renderAll();
    });
    window.ethereum.on("chainChanged", (hex) => {
      state.chainId = Number(hex);
      renderAll();
    });
  }
}

async function restoreSession() {
  if (!hasMetaMask()) return;
  try {
    // eth_accounts never opens a popup: it only returns already-authorised accounts.
    const [account] = await window.ethereum.request({ method: "eth_accounts" });
    if (!account) return;
    state.account = ethers.getAddress(account);
    state.chainId = Number(await window.ethereum.request({ method: "eth_chainId" }));
  } catch { /* ignore */ }
}

async function init() {
  hydrateIcons();
  wireEvents();
  await Promise.all([importSeed(), restoreSession()]);
  await refresh();

  const form = $("#create-form");
  form.deadline.value = toDatetimeLocal(chainNow() + 7 * 86400);
  updateDescriptionHash();

  if (deployment && !state.nodeDown) {
    try {
      await pullEvents(deployment.deployBlock ?? 0, state.blockNumber, false);
      renderLog();
    } catch (err) { console.error(err); }
    readProvider.on("block", onBlock);
  }

  // Keep countdowns and the chain clock moving between blocks.
  setInterval(() => { if (!state.busy && !dialog.open) { renderChainbar(); renderLedger(); } }, 30_000);
}

init();
