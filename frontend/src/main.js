// LockPay frontend — single page, vanilla JS.
//
// Flow of the file:
//   1. state          : everything the UI shows
//   2. mission logic  : what each account can do, and a sentence per status
//   3. render*()      : state -> HTML (no blockchain calls inside)
//   4. actions        : button clicks -> transactions (chain.js)
//   5. chain data     : missions + event log, refreshed at every new block
//   6. init()         : wiring
//
// Every visible text goes through t() from i18n.js (French / English).
import "@fontsource/source-serif-4/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";

import { ethers } from "ethers";
import { icons } from "./icons.js";
import { t, getLang, setLang, translateStatic } from "./i18n.js";
import {
  deployment, readContract, readProvider, CHAIN_ID,
  hasMetaMask, connectWallet, switchToLocalNetwork, isContractDeployed,
  fetchMissions, fetchEscrowBalance, sendTx, timeTravel, explainError,
} from "./chain.js";
import { hashText, hashFile, saveText, getText, saveFileMeta, getFileMeta, importSeed } from "./offchain.js";
import { esc, short, eth, accountIndex, sameAddress, date, clock, duration, toDatetimeLocal } from "./format.js";

const REVIEW_PERIOD = 3 * 24 * 60 * 60; // must match LockPay.REVIEW_PERIOD

const $ = (selector) => document.querySelector(selector);

// ===========================================================================
// 1. State
// ===========================================================================

const state = {
  account: null,          // connected MetaMask address
  chainId: null,          // MetaMask network
  missions: [],           // from fetchMissions()
  balance: 0n,            // ETH held by the contract
  blockNumber: 0,
  timeOffset: 0,          // chain clock - wall clock (grows after "+3 days")
  events: [],             // decoded contract events, newest first
  filter: "all",
  demo: false,            // show every action, even the forbidden ones
  open: new Set(),        // expanded mission ids
  busy: null,             // { key, stage } while a transaction is running
  nodeDown: false,        // no answer from 127.0.0.1:8545
  contractMissing: false, // node answers but has no code at the address
};

const isArbiter = () => !!deployment && sameAddress(state.account, deployment.arbiter);
const wrongNetwork = () => !!state.account && state.chainId !== CHAIN_ID;
const chainNow = () => Math.floor(Date.now() / 1000) + state.timeOffset;
const chainReady = () => !!deployment && !state.nodeDown && !state.contractMissing;

const TONES = {
  Open: "open", Accepted: "progress", Delivered: "review", Completed: "done",
  Cancelled: "muted", Disputed: "alert", Resolved: "done",
};

// ===========================================================================
// 2. Mission logic (same rules as the contract)
// ===========================================================================

/**
 * Every action of a mission, with:
 *  - allowed : the connected account may do it (role + state)
 *  - main    : it moves the mission forward (shown on the row)
 *  - ready   : it would succeed right now (e.g. claim after 3 days)
 */
function actionsFor(m) {
  const me = state.account;
  const isClient = sameAddress(me, m.client);
  const isFreelancer = sameAddress(me, m.freelancer);
  const s = m.status;
  const reviewOver = m.deliveredAt && chainNow() >= m.deliveredAt + REVIEW_PERIOD;

  return [
    { action: "accept",  icon: "handshake",    style: "primary", main: true,  ready: true,       allowed: s === "Open" && !!me && !isClient },
    { action: "deliver", icon: "upload",       style: "primary", main: true,  ready: true,       allowed: s === "Accepted" && isFreelancer },
    { action: "approve", icon: "hand-coins",   style: "primary", main: true,  ready: true,       allowed: s === "Delivered" && isClient },
    { action: "claim",   icon: "hourglass",    style: "primary", main: true,  ready: reviewOver, allowed: s === "Delivered" && isFreelancer },
    { action: "resolve", icon: "gavel",        style: "primary", main: true,  ready: true,       allowed: s === "Disputed" && isArbiter() },
    { action: "cancel",  icon: "ban",          style: "ghost",   main: false, ready: true,       allowed: s === "Open" && isClient },
    { action: "dispute", icon: "shield-alert", style: "ghost",   main: false, ready: true,       allowed: s === "Delivered" && (isClient || isFreelancer) },
  ];
}

/** The one action shown directly on the row, or null. */
function primaryAction(m) {
  return actionsFor(m).find((a) => a.allowed && a.main && a.ready) ?? null;
}

/** Missions waiting for the connected account ("To do" strip). Accepting a
 *  stranger's mission is an opportunity, not a duty, so it is left out. */
function todoMissions() {
  if (!state.account) return [];
  return state.missions.filter((m) => {
    const a = primaryAction(m);
    return a && a.action !== "accept";
  });
}

/** One plain sentence explaining where the mission is and what comes next. */
function statusLine(m) {
  const me = state.account;
  const now = chainNow();
  const isClient = sameAddress(me, m.client);
  const isFreelancer = sameAddress(me, m.freelancer);

  switch (m.status) {
    case "Open":
      return t(isClient ? "line.open.client" : "line.open.other");
    case "Accepted": {
      const left = m.deadline - now;
      if (left <= 0) return t("line.accepted.late");
      return isFreelancer
        ? t("line.accepted.me", { date: date(m.deadline), left: duration(left) })
        : t("line.accepted.other", { date: date(m.deadline) });
    }
    case "Delivered": {
      const left = m.deliveredAt + REVIEW_PERIOD - now;
      if (isClient) return left > 0 ? t("line.delivered.client", { left: duration(left) }) : t("line.delivered.clientLate");
      if (isFreelancer) return left > 0 ? t("line.delivered.freelancer", { left: duration(left) }) : t("line.delivered.freelancerReady");
      return left > 0 ? t("line.delivered.other", { left: duration(left) }) : t("line.delivered.otherLate");
    }
    case "Completed": return t("line.completed", { amount: `${eth(m.amount)} ETH` });
    case "Cancelled": return t("line.cancelled");
    case "Disputed":  return t(isArbiter() ? "line.disputed.arbiter" : "line.disputed.other");
    case "Resolved":  return t("line.resolved");
    default: return "";
  }
}

/** My role on a mission, or null. */
function myRole(m) {
  if (sameAddress(state.account, m.client)) return t("role.client");
  if (sameAddress(state.account, m.freelancer)) return t("role.freelancer");
  return null;
}

// ===========================================================================
// 3. Rendering
// ===========================================================================

/** "#1 0x7099…79C8" (+ "you"). Hardhat test accounts get their number. */
function addressTag(address, { you = true } = {}) {
  if (!address) return `<span class="addr addr-empty">${t("addr.nobody")}</span>`;
  const idx = accountIndex(address);
  const me = you && sameAddress(address, state.account);
  return `<span class="addr" title="${esc(address)}">${idx >= 0 ? `<b>#${idx}</b>` : ""}${short(address)}${me ? `<em>${t("addr.you")}</em>` : ""}</span>`;
}

function renderChainbar() {
  const el = $("#chainbar");
  if (!deployment || state.contractMissing) {
    el.innerHTML = `<span class="chain-item chain-warn">${icons("triangle-alert")}${t("chain.notDeployed")}</span>`;
    return;
  }
  if (state.nodeDown) {
    el.innerHTML = `<span class="chain-item chain-warn">${icons("unplug")}${t("chain.nodeDown")}</span>`;
    return;
  }
  el.innerHTML = `
    <span class="chain-item"><span class="dot dot-live"></span>Hardhat Local <span class="muted">31337</span></span>
    <span class="chain-item mono">${t("chain.block", { n: state.blockNumber })}</span>
    <span class="chain-item" title="${t("chain.clockTitle")}">${icons("clock")}<span class="mono">${date(chainNow())}</span></span>
    <button class="chain-item chain-btn" data-action="copy" data-value="${deployment.address}" title="${t("chain.copyContract")}">
      ${icons("file-code")}<span class="mono">${short(deployment.address)}</span>
    </button>
    <button class="chain-item chain-btn" data-action="time-travel" title="${t("chain.travelTitle")}">
      ${icons("fast-forward")}${t("chain.travel")}
    </button>`;
}

/** Wallet pill: arbiter badge, or how many missions I am client / freelancer of. */
function renderWallet() {
  const el = $("#wallet");
  if (!state.account) {
    el.innerHTML = `<button class="btn btn-primary" data-action="connect">${icons("wallet")}<span>${t("wallet.connect")}</span></button>`;
    return;
  }
  if (wrongNetwork()) {
    el.innerHTML = `<button class="btn btn-warn" data-action="switch-network">${icons("triangle-alert")}<span>${t("wallet.switch")}</span></button>`;
    return;
  }
  const asClient = state.missions.filter((m) => sameAddress(m.client, state.account)).length;
  const asFreelancer = state.missions.filter((m) => sameAddress(m.freelancer, state.account)).length;
  const counts = [
    asClient ? `${t("role.client")} <b>${asClient}</b>` : "",
    asFreelancer ? `${t("role.freelancer")} <b>${asFreelancer}</b>` : "",
  ].filter(Boolean).join('<span class="sep">·</span>');

  el.innerHTML = `<div class="account">
    ${isArbiter() ? `<span class="role role-arbiter">${icons("scale")}${t("role.arbiter")}</span>` : ""}
    ${counts || !isArbiter() ? `<span class="role-counts" title="${t("role.title")}">${counts || t("role.none")}</span>` : ""}
    ${addressTag(state.account, { you: false })}
  </div>`;
}

/** Setup checklist, shown until everything needed for the demo is ready. */
function renderSetup() {
  const steps = [
    { ok: !state.nodeDown, label: t("setup.node"), help: t("setup.nodeHelp") },
    { ok: !state.nodeDown && !!deployment && !state.contractMissing, label: t("setup.contract"), help: t("setup.contractHelp") },
    { ok: hasMetaMask(), label: t("setup.metamask"), help: t("setup.metamaskHelp") },
    {
      ok: !!state.account, label: t("setup.account"), help: t("setup.accountHelp"),
      button: hasMetaMask() ? `<button class="btn btn-primary btn-sm" data-action="connect">${icons("wallet")}<span>${t("wallet.connect")}</span></button>` : "",
    },
    {
      ok: !!state.account && !wrongNetwork(), label: t("setup.network"), help: t("setup.networkHelp"),
      button: state.account ? `<button class="btn btn-sm" data-action="switch-network">${t("wallet.switch")}</button>` : "",
    },
  ];
  const done = steps.filter((s) => s.ok).length;
  const el = $("#setup");
  if (done === steps.length) { el.innerHTML = ""; return; }

  // Only the first unfinished step shows its help and button: one thing at a time.
  const firstTodo = steps.findIndex((s) => !s.ok);
  el.innerHTML = `
    <section class="setup panel">
      <header class="setup-head">
        <h2>${t("setup.title")}</h2>
        <span class="muted small">${t("setup.progress", { done, total: steps.length })}</span>
      </header>
      <ol class="setup-steps">
        ${steps.map((s, i) => `
          <li class="${s.ok ? "is-ok" : i === firstTodo ? "is-next" : ""}">
            <span class="setup-mark">${s.ok ? icons("check") : i + 1}</span>
            <div class="setup-body">
              <p class="setup-label">${s.label}</p>
              ${i === firstTodo ? `<p class="setup-help">${s.help}</p>${s.button ? `<div class="setup-action">${s.button}</div>` : ""}` : ""}
            </div>
          </li>`).join("")}
      </ol>
    </section>`;
}

/** "To do" strip: missions waiting for me, each with its button. */
function renderTodo() {
  const list = todoMissions();
  const el = $("#todo");
  if (!list.length || !chainReady()) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <section class="todo" aria-labelledby="todo-title">
      <header class="todo-head">
        <h2 id="todo-title">${icons("list-todo")}${t("todo.title")} <span class="count">${list.length}</span></h2>
        <p>${t("todo.subtitle")}</p>
      </header>
      <ul class="todo-list">
        ${list.map((m) => `
          <li class="todo-item">
            <span class="m-id mono">${String(m.id).padStart(2, "0")}</span>
            <div class="todo-main">
              <p class="todo-title">${esc(m.title)}</p>
              <p class="todo-line">${statusLine(m)}</p>
            </div>
            <span class="m-amount mono">${eth(m.amount)}<small>ETH</small></span>
            <div class="todo-actions">
              ${actionButton(m, primaryAction(m), "btn-sm")}
              <button class="link-btn" data-action="reveal" data-id="${m.id}">${t("todo.view")}</button>
            </div>
          </li>`).join("")}
      </ul>
    </section>`;
}

function renderSummary() {
  const n = state.missions.length;
  const open = state.missions.filter((m) => m.status === "Open").length;
  const disputes = state.missions.filter((m) => m.status === "Disputed").length;
  const parts = [
    t("summary.missions", { n }),
    t("summary.escrow", { amount: `<b class="mono">${eth(state.balance)} ETH</b>` }),
    t("summary.open", { n: open }),
  ];
  if (disputes) parts.push(`<span class="text-alert">${t("summary.disputes", { n: disputes })}</span>`);
  $("#ledger-summary").innerHTML = chainReady() ? parts.join('<span class="sep">·</span>') : "";
}

const FILTERS = [
  { key: "all", test: () => true },
  { key: "open", test: (m) => m.status === "Open" },
  { key: "mine", test: (m) => sameAddress(m.client, state.account) || sameAddress(m.freelancer, state.account) },
  { key: "disputed", test: (m) => m.status === "Disputed" },
];

function renderFilters() {
  $("#filters").innerHTML = FILTERS.map((f) => {
    const count = state.missions.filter(f.test).length;
    return `<button class="filter ${state.filter === f.key ? "is-active" : ""}" data-action="filter" data-value="${f.key}">
      ${t(`filter.${f.key}`)}<span class="count">${count}</span></button>`;
  }).join("");
}

/** Steps shown in the progress track, depending on the branch taken. */
function stepsFor(status) {
  const s = (key) => t(`status.${key}`);
  if (status === "Cancelled") return { steps: [s("Open"), s("Cancelled")], current: 1 };
  if (status === "Disputed" || status === "Resolved") {
    return {
      steps: [s("Open"), s("Accepted"), s("Delivered"), t("step.dispute"), s("Resolved")],
      current: status === "Disputed" ? 3 : 4,
    };
  }
  const order = ["Open", "Accepted", "Delivered", "Completed"];
  return { steps: order.map(s), current: order.indexOf(status) };
}

function renderTrack(m) {
  const { steps, current } = stepsFor(m.status);
  const final = ["Completed", "Cancelled", "Resolved"].includes(m.status);
  return `<ol class="track">${steps.map((s, i) => {
    const cls = i < current || (i === current && final) ? "is-done" : i === current ? "is-current" : "";
    return `<li class="${cls}"><span>${s}</span></li>`;
  }).join("")}</ol>`;
}

function actionButton(m, a, extraClass = "") {
  const key = `${m.id}:${a.action}`;
  const busy = state.busy?.key === key;
  return `<button class="btn btn-${a.style} ${extraClass}" data-action="${a.action}" data-id="${m.id}" ${state.busy ? "disabled" : ""}>
    ${busy ? icons("loader", "spin") : icons(a.icon)}<span>${busy ? t(`stage.${state.busy.stage}`) : t(`action.${a.action}`)}</span></button>`;
}

/** Off-chain description with integrity check against the on-chain hash. */
function renderDescription(m) {
  const text = getText(m.descriptionHash);
  if (text === null) {
    return `<p class="desc desc-missing">${icons("eye-off")}${t("desc.missing")}</p>`;
  }
  const ok = hashText(text) === m.descriptionHash;
  return `<p class="desc">${esc(text)}</p>
    <span class="integrity ${ok ? "is-ok" : "is-bad"}">${icons(ok ? "shield-check" : "shield-alert")}
      ${t(ok ? "desc.verified" : "desc.mismatch")}</span>`;
}

function renderDeliverable(m) {
  if (!m.deliverableHash) return `<span class="muted">${t("deliv.none")}</span>`;
  const file = getFileMeta(m.deliverableHash);
  const text = getText(m.deliverableHash);
  const label = file ? `${icons("file-check")}${esc(file.name)}` : text !== null ? `${icons("type")}${t("deliv.text")}` : "";
  return `${label ? `<span class="deliv-label">${label}</span>` : ""}
    <button class="hash" data-action="copy" data-value="${m.deliverableHash}" title="${t("copy")}">${short(m.deliverableHash, 10, 8)}</button>
    <button class="link-btn" data-action="verify" data-id="${m.id}">${t("deliv.verify")}</button>`;
}

function renderMission(m) {
  const tone = TONES[m.status];
  const open = state.open.has(m.id);
  const all = actionsFor(m);
  const primary = primaryAction(m);
  // The body shows the other allowed actions (the primary one is on the row).
  const others = all.filter((a) => a.allowed && a !== primary);
  const forbidden = all.filter((a) => !a.allowed);
  const role = myRole(m);

  return `
  <article class="mission ${open ? "is-open" : ""}" id="mission-${m.id}">
    <div class="mission-row">
      <button class="mission-head" data-action="toggle" data-id="${m.id}" aria-expanded="${open}">
        <span class="m-id mono">${String(m.id).padStart(2, "0")}</span>
        <span class="m-main">
          <span class="m-title">${esc(m.title)}</span>
          <span class="m-line">${role ? `<span class="chip">${role}</span>` : ""}<span>${statusLine(m)}</span></span>
        </span>
        <span class="m-amount mono">${eth(m.amount)}<small>ETH</small></span>
        <span class="stamp stamp-${tone}">${t(`status.${m.status}`)}</span>
      </button>
      <div class="m-cta">${primary ? actionButton(m, primary, "btn-sm") : ""}</div>
      <button class="m-chevron" data-action="toggle" data-id="${m.id}" tabindex="-1" aria-hidden="true">${icons("chevron-down")}</button>
    </div>

    ${open ? `
    <div class="mission-body">
      ${renderTrack(m)}
      <div class="m-grid">
        <section class="m-desc">
          <h4>${t("desc.heading")} <em>${t("desc.offchain")}</em></h4>
          ${renderDescription(m)}
        </section>
        <dl class="m-facts">
          <div><dt>${t("facts.client")}</dt><dd>${addressTag(m.client)}</dd></div>
          <div><dt>${t("facts.freelancer")}</dt><dd>${addressTag(m.freelancer)}</dd></div>
          <div><dt>${t("facts.deadline")}</dt><dd class="mono">${date(m.deadline)}</dd></div>
          <div><dt>${t("facts.deliveredAt")}</dt><dd class="mono">${m.deliveredAt ? date(m.deliveredAt) : "—"}</dd></div>
          <div class="wide"><dt>${t("facts.descHash")}</dt><dd><button class="hash" data-action="copy" data-value="${m.descriptionHash}" title="${t("copy")}">${short(m.descriptionHash, 10, 8)}</button></dd></div>
          <div class="wide"><dt>${t("facts.delivHash")}</dt><dd class="deliv">${renderDeliverable(m)}</dd></div>
        </dl>
      </div>
      <div class="m-actions">
        ${others.map((a) => actionButton(m, a)).join("")}
        ${!others.length ? `<span class="muted small">${t(state.account ? "actions.none" : "actions.connect")}</span>` : ""}
      </div>
      ${state.demo && forbidden.length ? `
      <div class="m-actions m-actions-demo">
        <span class="demo-label">${icons("flask-conical")}${t("demo.label")}</span>
        ${forbidden.map((a) => actionButton(m, { ...a, style: "demo" })).join("")}
      </div>` : ""}
    </div>` : ""}
  </article>`;
}

function renderLedger() {
  const el = $("#ledger");
  if (!chainReady()) {
    el.innerHTML = emptyState("unplug", t("empty.waitTitle"), t("empty.waitText"));
    return;
  }
  const filter = FILTERS.find((f) => f.key === state.filter);
  const list = state.missions.filter(filter.test);
  el.innerHTML = list.length
    ? list.map(renderMission).join("")
    : emptyState("inbox", t("empty.noneTitle"), t(state.missions.length ? "empty.otherFilter" : "empty.first"));
}

function emptyState(icon, title, text) {
  return `<div class="empty">${icons(icon)}<h3>${title}</h3><p>${text}</p></div>`;
}

function renderForm() {
  const submit = $("#create-submit");
  const busy = state.busy?.key === "create";
  submit.disabled = !!state.busy || !chainReady();
  submit.innerHTML = busy
    ? `${icons("loader", "spin")}<span>${t(`stage.${state.busy.stage}`)}</span>`
    : `${icons("lock")}<span>${t("form.submit")}</span>`;
  $("#create-foot").textContent = !state.account ? t("form.connectHint") : "";
}

// --- Event log -------------------------------------------------------------

const EVENT_ICONS = {
  MissionCreated: "lock", MissionCancelled: "ban", MissionAccepted: "handshake", WorkDelivered: "upload",
  PaymentReleased: "hand-coins", DisputeOpened: "shield-alert", DisputeResolved: "gavel",
};

function eventDetail(e) {
  const a = e.args;
  const amount = (wei) => `<b class="mono">${eth(wei)} ETH</b>`;
  switch (e.name) {
    case "MissionCreated":   return t("evd.created", { amount: amount(a.amount), who: addressTag(a.client) });
    case "MissionCancelled": return t("evd.cancelled", { amount: amount(a.refund), who: addressTag(a.client) });
    case "MissionAccepted":  return t("evd.by", { who: addressTag(a.freelancer) });
    case "WorkDelivered":    return `hash <span class="mono">${short(a.deliverableHash, 8, 6)}</span>`;
    case "PaymentReleased":  return t("evd.paid", { amount: amount(a.amount), who: addressTag(a.freelancer) }) + (a.autoClaimed ? t("evd.auto") : "");
    case "DisputeOpened":    return t("evd.by", { who: addressTag(a.openedBy) });
    case "DisputeResolved": {
      const pct = Number(a.freelancerShareBps) / 100;
      return t("evd.resolved", { f: pct, c: 100 - pct, fa: amount(a.freelancerAmount), ca: amount(a.clientAmount) });
    }
    default: return "";
  }
}

function renderLog() {
  const el = $("#log");
  if (!state.events.length) {
    el.innerHTML = `<li class="log-empty">${t("log.empty")}</li>`;
    return;
  }
  el.innerHTML = state.events.map((e) => `
    <li class="log-item ${e.fresh ? "is-fresh" : ""}" data-event="${e.name}">
      <span class="log-icon">${icons(EVENT_ICONS[e.name] ?? "radio")}</span>
      <div class="log-body">
        <p class="log-title"><span>${t(`ev.${e.name}`)}</span><span class="mono">#${e.args.id}</span></p>
        <p class="log-detail">${eventDetail(e)}</p>
        <p class="log-meta mono"><span>${e.name}</span><span>${t("log.block", { n: e.blockNumber })}</span><span>${e.timestamp ? clock(e.timestamp) : ""}</span></p>
      </div>
    </li>`).join("");
}

function renderLive() {
  const offline = !chainReady();
  $("#live-indicator").classList.toggle("is-down", offline);
  $("#live-text").textContent = offline ? t("log.offline") : t("log.block", { n: state.blockNumber });
}

function renderLangSwitch() {
  document.querySelectorAll("[data-lang]").forEach((b) => {
    const active = b.dataset.lang === getLang();
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-pressed", active);
  });
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
    <button class="notice-close" aria-label="${t("notice.close")}">${icons("x")}</button>`;
  el.querySelector(".notice-close").onclick = () => el.remove();
  $("#notices").prepend(el);
  // Errors stay until closed (needed for the demo); successes fade out.
  if (kind !== "error") setTimeout(() => el.remove(), 6000);
}

const showError = (err) => notify({ kind: "error", ...explainError(err) });

function renderAll() {
  // Filters and demo switch are meaningless until the chain is reachable.
  $(".col-ledger").classList.toggle("is-offline", !chainReady());
  renderLive();
  renderLangSwitch();
  renderChainbar();
  renderWallet();
  renderSetup();
  renderTodo();
  renderSummary();
  renderFilters();
  renderLedger();
  renderForm();
  renderLog();
}

// ===========================================================================
// 4. Actions
// ===========================================================================

/** Wraps a transaction: busy state, error box, success notice, refresh. */
async function runTx(key, method, args, overrides, successText) {
  if (!state.account) return showError(new Error(t("err.connectFirst")));
  if (wrongNetwork()) return showError(new Error(t("err.wrongNetwork")));

  state.busy = { key, stage: "simulate" };
  renderAll();
  let receipt = null;
  try {
    receipt = await sendTx(state.account, method, args, overrides, (stage) => {
      state.busy = { key, stage };
      renderTodo();
      renderLedger();
      renderForm();
    });
  } catch (err) {
    showError(err);
  }
  state.busy = null;
  await refresh(); // update the list first, then confirm
  if (receipt) notify({ kind: "success", title: successText, explanation: t("tx.mined", { n: receipt.blockNumber }) });
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
    return showError(new Error(t("err.amount")));
  }
  const deadline = form.deadline.value ? Math.floor(new Date(form.deadline.value).getTime() / 1000) : 0;

  // Off-chain: keep the text locally, send only its fingerprint.
  const descriptionHash = hashText(description);
  saveText(descriptionHash, description);

  const receipt = await runTx("create", "createMission", [title, descriptionHash, deadline], { value }, t("ok.create"));
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
  const amount = `${eth(m.amount)} ETH`;
  switch (action) {
    case "accept":  return runTx(key, "acceptMission", [id], {}, t("ok.accept", { id }));
    case "cancel":  return runTx(key, "cancelMission", [id], {}, t("ok.cancel", { id }));
    case "approve": return runTx(key, "approveWork", [id], {}, t("ok.approve", { amount }));
    case "claim":   return runTx(key, "claimPayment", [id], {}, t("ok.claim", { amount }));
    case "dispute": return runTx(key, "openDispute", [id], {}, t("ok.dispute", { id }));
    case "deliver": return openHashDialog(m, "deliver");
    case "verify":  return openHashDialog(m, "verify");
    case "resolve": return openResolveDialog(m);
  }
}

/** "View" in the To-do strip: show all missions, open this one, scroll to it. */
function revealMission(id) {
  state.filter = "all";
  state.open.add(id);
  renderFilters();
  renderLedger();
  const el = document.getElementById(`mission-${id}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.classList.add("is-flash");
  setTimeout(() => el?.classList.remove("is-flash"), 1200);
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
          <p class="eyebrow">${t("dlg.mission", { id: m.id })}</p>
          <h2>${t(deliver ? "dlg.deliverTitle" : "dlg.verifyTitle")}</h2>
          <p>${t(deliver ? "dlg.deliverText" : "dlg.verifyText")}</p>
        </div>
        <button type="button" class="icon-btn" data-close aria-label="${t("dlg.close")}">${icons("x")}</button>
      </header>

      <div class="segmented" role="tablist">
        <button type="button" role="tab" class="is-active" data-tab="file">${icons("file-up")}${t("dlg.file")}</button>
        <button type="button" role="tab" data-tab="text">${icons("type")}${t("dlg.text")}</button>
      </div>

      <label class="dropzone" data-pane="file">
        <input type="file" name="file" />
        ${icons("upload")}
        <span class="dz-title">${t("dlg.drop")}</span>
        <span class="dz-sub">${t("dlg.dropSub")}</span>
      </label>
      <label class="field" data-pane="text" hidden>
        <span class="field-label">${t("dlg.textLabel")}</span>
        <textarea name="text" rows="5" placeholder="${t("dlg.textPh")}"></textarea>
      </label>

      <div class="hash-out">
        <span class="field-label">${t("dlg.hash")}</span>
        <code id="hash-value">—</code>
        ${!deliver ? `<p class="hash-compare" id="hash-compare"></p>` : ""}
      </div>

      <footer class="dialog-foot">
        <button type="button" class="btn btn-ghost" data-close>${t("dlg.close")}</button>
        ${deliver ? `<button type="submit" class="btn btn-primary" id="hash-submit">${icons("send")}<span>${t("dlg.send")}</span></button>` : ""}
      </footer>
    </form>`;

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
    form.querySelector(".dz-title").textContent = file ? file.name : t("dlg.drop");

    const compare = form.querySelector("#hash-compare");
    if (compare) {
      const ok = current.hash && current.hash === m.deliverableHash;
      compare.className = `hash-compare ${current.hash ? (ok ? "is-ok" : "is-bad") : ""}`;
      compare.innerHTML = !current.hash ? "" : ok
        ? `${icons("shield-check")}${t("dlg.match")}`
        : `${icons("shield-alert")}${t("dlg.noMatch", { hash: short(m.deliverableHash, 8, 6) })}`;
    }
  };

  form.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) {
      form.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("is-active", b === tab));
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
    await runTx(`${m.id}:deliver`, "deliverWork", [m.id, hash], {}, t("ok.deliver", { id: m.id }));
  });

  dialog.showModal();
}

/** Arbiter: choose the freelancer's share (basis points) with a slider. */
function openResolveDialog(m) {
  dialog.innerHTML = `
    <form method="dialog" class="dialog-inner" id="resolve-form">
      <header class="dialog-head">
        <div>
          <p class="eyebrow">${t("res.eyebrow", { id: m.id, amount: `${eth(m.amount)} ETH` })}</p>
          <h2>${t("res.title")}</h2>
          <p>${t("res.text")}</p>
        </div>
        <button type="button" class="icon-btn" data-close aria-label="${t("dlg.close")}">${icons("x")}</button>
      </header>

      <div class="split">
        <div class="split-side"><span>${t("role.freelancer")}</span><b class="mono" id="split-f"></b><small id="split-fp"></small></div>
        <div class="split-side split-right"><span>${t("role.client")}</span><b class="mono" id="split-c"></b><small id="split-cp"></small></div>
      </div>
      <input type="range" name="share" min="0" max="10000" step="500" value="5000" class="range" aria-label="${t("res.aria")}" />
      <div class="presets">
        ${[0, 2500, 5000, 7500, 10000].map((v) => `<button type="button" class="btn btn-ghost btn-sm" data-preset="${v}">${v / 100} %</button>`).join("")}
      </div>
      <p class="field-hint mono" id="split-bps"></p>

      <footer class="dialog-foot">
        <button type="button" class="btn btn-ghost" data-close>${t("dlg.close")}</button>
        <button type="submit" class="btn btn-primary">${icons("gavel")}<span>${t("res.submit")}</span></button>
      </footer>
    </form>`;

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
    await runTx(`${m.id}:resolve`, "resolveDispute", [m.id, bps], {}, t("ok.resolve", { id: m.id }));
  });
  update();
  dialog.showModal();
}

// ===========================================================================
// 5. Chain data + event log
// ===========================================================================

const blockTimes = new Map();
async function blockTime(n) {
  if (!blockTimes.has(n)) blockTimes.set(n, (await readProvider.getBlock(n)).timestamp);
  return blockTimes.get(n);
}

let lastLogBlock = 0;
let subscribed = false;

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

/** Re-reads node status, missions, balance and clock. */
async function refresh() {
  if (deployment) {
    try {
      const block = await readProvider.getBlock("latest");
      state.nodeDown = false;
      state.blockNumber = block.number;
      state.timeOffset = Math.max(0, block.timestamp - Math.floor(Date.now() / 1000));
      state.contractMissing = !(await isContractDeployed());
      if (!state.contractMissing) {
        [state.missions, state.balance] = await Promise.all([fetchMissions(), fetchEscrowBalance()]);
      } else {
        state.missions = [];
      }
    } catch (err) {
      console.error(err);
      state.nodeDown = true;
    }
  } else {
    // Without contract.json we can still tell whether the node is up.
    try { await readProvider.getBlockNumber(); state.nodeDown = false; } catch { state.nodeDown = true; }
  }
  renderAll();
  await subscribe();
}

/** Starts listening to new blocks once the chain is ready (only once). */
async function subscribe() {
  if (subscribed || !chainReady()) return;
  subscribed = true;
  try {
    await pullEvents(deployment.deployBlock ?? 0, state.blockNumber, false);
    renderLog();
  } catch (err) { console.error(err); }
  readProvider.on("block", onBlock);
}

/** Called by ethers at every new block mined on the node. */
async function onBlock(blockNumber) {
  // Flash the live dot: it only moves when a block really arrives.
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
// 6. Init
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
    const lang = e.target.closest("[data-lang]");
    if (lang) {
      setLang(lang.dataset.lang);
      translateStatic();
      return renderAll();
    }

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
      case "reveal": return revealMission(Number(id));
      case "filter":
        state.filter = value;
        renderFilters();
        return renderLedger();
      case "copy":
        e.stopPropagation();
        try { await navigator.clipboard.writeText(value); notify({ kind: "success", title: t("ok.copied"), explanation: value }); } catch { /* clipboard blocked */ }
        return;
      case "time-travel":
        try {
          await timeTravel(3 * 24 * 60 * 60);
          notify({ kind: "success", title: t("ok.travel"), explanation: t("ok.travelText") });
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
  translateStatic();
  hydrateIcons();
  wireEvents();
  await Promise.all([importSeed(), restoreSession()]);
  await refresh();

  const form = $("#create-form");
  form.deadline.value = toDatetimeLocal(chainNow() + 7 * 86400);
  updateDescriptionHash();

  // While the node or the contract is missing, check again every 3 s so the
  // setup checklist ticks itself.
  setInterval(() => { if (!chainReady()) refresh(); }, 3000);
  // Keep countdowns and the chain clock moving between blocks (rarely, so a
  // re-render never steals a click).
  setInterval(() => {
    if (chainReady() && !state.busy && !dialog.open) { renderChainbar(); renderTodo(); renderLedger(); }
  }, 30_000);
}

init();
