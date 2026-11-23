// Small display helpers (pure functions, no blockchain access).
import { ethers } from "ethers";
import { getLang, t } from "./i18n.js";

/** Escapes user / chain text before putting it in innerHTML. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/** 0x1234…abcd */
export function short(hex, start = 6, end = 4) {
  if (!hex) return "—";
  return `${hex.slice(0, start)}…${hex.slice(-end)}`;
}

/** Wei -> "0.5" (trims useless zeros, max 4 decimals). */
export function eth(wei) {
  const [int, dec = ""] = ethers.formatEther(wei).split(".");
  const trimmed = dec.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${int}.${trimmed}` : int;
}

// Default Hardhat accounts, so the demo shows "#1" next to the address.
const HARDHAT_ACCOUNTS = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
];

/** Index of a default Hardhat account, or -1. */
export function accountIndex(address) {
  if (!address) return -1;
  return HARDHAT_ACCOUNTS.findIndex((a) => a.toLowerCase() === address.toLowerCase());
}

export function sameAddress(a, b) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

// Date formatters follow the selected language (fr-FR / en-GB).
const formatters = {};
function fmt(kind) {
  const locale = getLang() === "en" ? "en-GB" : "fr-FR";
  const key = `${kind}:${locale}`;
  formatters[key] ??= new Intl.DateTimeFormat(locale, kind === "date"
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return formatters[key];
}

/** Unix seconds -> "24 nov., 14:05" */
export function date(seconds) {
  return fmt("date").format(new Date(seconds * 1000));
}

/** Unix seconds -> "14:05:32" */
export function clock(seconds) {
  return fmt("clock").format(new Date(seconds * 1000));
}

/** Seconds -> "2 j 4 h", "3 h 12 min", "45 s" (translated units) */
export function duration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return t("dur.d", { d, h });
  if (h > 0) return t("dur.h", { h, m });
  if (m > 0) return t("dur.m", { m });
  return t("dur.s", { s });
}

/** Unix seconds -> value for <input type="datetime-local"> (local time). */
export function toDatetimeLocal(seconds) {
  const d = new Date(seconds * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
