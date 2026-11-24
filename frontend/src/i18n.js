// Translations (French / English).
// t("key", { var: value }) returns the text in the current language.
// A value can be a string with {placeholders} or a function for plurals.
// Static HTML uses data-i18n="key" (text), data-i18n-html, -placeholder, -title, -aria.

const STORAGE_KEY = "lockpay.lang";

const fr = {
  "brand.tagline": "Séquestre de missions étudiantes",
  "lang.label": "Langue",
  "theme.label": "Thème",
  "theme.auto": "Automatique (suit le système)",
  "theme.light": "Clair, contraste élevé (projecteur)",
  "theme.dark": "Sombre",

  // Chain bar
  "chain.notDeployed": "Contrat non déployé",
  "chain.nodeDown": "Nœud Hardhat injoignable",
  "chain.block": "Bloc {n}",
  "chain.clockTitle": "Heure de la blockchain (block.timestamp)",
  "chain.copyContract": "Copier l'adresse du contrat",
  "chain.travel": "+3 jours",
  "chain.travelTitle": "Démo locale : avance l'horloge du nœud de 3 jours",

  // Wallet / roles
  "wallet.connect": "Connecter MetaMask",
  "wallet.switch": "Passer sur Hardhat Local",
  "role.arbiter": "Arbitre",
  "role.client": "Client",
  "role.freelancer": "Freelance",
  "role.none": "Aucune mission",
  "role.title": "Vos rôles sur les missions existantes",
  "addr.you": "vous",
  "addr.nobody": "personne pour l'instant",

  // Summary + filters
  "summary.missions": (n) => `${n} mission${n > 1 ? "s" : ""}`,
  "summary.escrow": "{amount} en séquestre",
  "summary.open": (n) => `${n} ouverte${n > 1 ? "s" : ""}`,
  "summary.disputes": (n) => `${n} litige${n > 1 ? "s" : ""}`,
  "filter.all": "Toutes",
  "filter.open": "Ouvertes",
  "filter.mine": "Mes missions",
  "filter.disputed": "Litiges",
  "filter.aria": "Filtrer les missions",

  // Status stamps + timeline steps
  "status.Open": "Ouverte",
  "status.Accepted": "Acceptée",
  "status.Delivered": "Livrée",
  "status.Completed": "Payée",
  "status.Cancelled": "Annulée",
  "status.Disputed": "En litige",
  "status.Resolved": "Arbitrée",
  "step.dispute": "Litige",

  // One plain sentence per status, written for the person reading it
  "line.open.client": "En attente d'un freelance · vous pouvez encore annuler",
  "line.open.other": "Disponible : acceptez-la pour y travailler",
  "line.accepted.me": "À livrer avant le {date} · reste {left}",
  "line.accepted.other": "En cours chez le freelance · livraison avant le {date}",
  "line.accepted.late": "Échéance dépassée sans livraison",
  "line.delivered.client": "Travail livré : validez-le ou ouvrez un litige · reste {left}",
  "line.delivered.clientLate": "Travail livré · le freelance peut maintenant réclamer le paiement",
  "line.delivered.freelancer": "En attente de validation · réclamation possible dans {left}",
  "line.delivered.freelancerReady": "Le client n'a pas répondu en 3 jours : réclamez le paiement",
  "line.delivered.other": "Livrée · le client a encore {left} pour valider",
  "line.delivered.otherLate": "Livrée · période de revue terminée",
  "line.completed": "Terminée · {amount} versés au freelance",
  "line.cancelled": "Annulée · client remboursé",
  "line.disputed.arbiter": "Litige à trancher : les fonds sont gelés",
  "line.disputed.other": "Fonds gelés en attente de la décision de l'arbitre",
  "line.resolved": "Fonds répartis par l'arbitre",

  // Actions
  "action.accept": "Accepter",
  "action.cancel": "Annuler et rembourser",
  "action.deliver": "Livrer le travail",
  "action.approve": "Approuver et payer",
  "action.claim": "Réclamer le paiement",
  "action.dispute": "Ouvrir un litige",
  "action.resolve": "Arbitrer",
  "stage.simulate": "Simulation…",
  "stage.sign": "Signature MetaMask…",
  "stage.mining": "Confirmation…",
  "actions.none": "Aucune autre action pour votre compte.",
  "actions.connect": "Connectez MetaMask pour agir sur cette mission.",
  "demo.label": "Mode démo, normalement masqué :",
  "row.toggle": "Afficher le détail",

  // Mission details
  "desc.heading": "Description",
  "desc.offchain": "hors-chaîne",
  "desc.missing": "Texte non disponible dans ce navigateur. Seule son empreinte est publique.",
  "desc.verified": "Empreinte vérifiée : le texte correspond au hash on-chain",
  "desc.mismatch": "Le texte ne correspond pas au hash on-chain",
  "facts.client": "Client",
  "facts.freelancer": "Freelance",
  "facts.deadline": "Échéance",
  "facts.deliveredAt": "Livré le",
  "facts.descHash": "Hash description",
  "facts.delivHash": "Hash livrable",
  "deliv.none": "Pas encore livré",
  "deliv.text": "Texte livré",
  "deliv.verify": "Vérifier un fichier",
  "copy": "Copier",

  // "À faire" strip
  "todo.title": "À faire",
  "todo.subtitle": "Ces missions attendent une action de votre part.",
  "todo.view": "Voir",

  // Setup checklist
  "setup.title": "Avant de commencer",
  "setup.progress": "{done} sur {total} prêts",
  "setup.node": "Nœud Hardhat lancé",
  "setup.nodeHelp": "Dans un terminal : <code>npx hardhat node</code>",
  "setup.contract": "Contrat déployé sur ce nœud",
  "setup.contractHelp": "Dans un 2ᵉ terminal : <code>npm run deploy</code> (puis <code>npm run seed</code> pour des missions de démo)",
  "setup.metamask": "Extension MetaMask installée",
  "setup.metamaskHelp": "Installez-la depuis <a href=\"https://metamask.io/download/\" target=\"_blank\" rel=\"noopener\">metamask.io</a>, puis rechargez la page.",
  "setup.account": "Compte MetaMask connecté",
  "setup.accountHelp": "Importez un compte de test Hardhat (voir README), puis connectez-le.",
  "setup.network": "Réseau Hardhat Local (chainId 31337)",
  "setup.networkHelp": "MetaMask doit utiliser le réseau local pour signer.",

  // Empty states
  "empty.noneTitle": "Aucune mission ici",
  "empty.otherFilter": "Changez de filtre pour voir les autres missions.",
  "empty.first": "Publiez la première mission avec le formulaire.",
  "empty.waitTitle": "En attente de la blockchain",
  "empty.waitText": "Suivez la liste « Avant de commencer » ci-dessus : la page se met à jour toute seule.",

  // Create form
  "form.heading": "Publier une mission",
  "form.subtitle": "Le montant est bloqué dans le contrat jusqu'à la validation du travail.",
  "form.title": "Titre",
  "form.titlePh": "Ex. Maquette Figma de l'appli BDE",
  "form.description": "Description",
  "form.descPh": "Livrables attendus, format, critères d'acceptation…",
  "form.hashSent": "Empreinte envoyée :",
  "form.amount": "Montant",
  "form.deadline": "Échéance",
  "form.submit": "Bloquer les fonds et publier",
  "form.connectHint": "Connectez MetaMask pour publier une mission.",
  "storage.title": "Où vont les données ?",
  "storage.on": "Sur la blockchain",
  "storage.onText": "Titre, montant, échéance, adresses, statut et les <b>empreintes keccak256</b> de la description et du livrable.",
  "storage.off": "Hors chaîne",
  "storage.offText": "Le texte de la description et les fichiers livrés restent dans ce navigateur (localStorage) ou chez le freelance.",

  // Ledger header
  "ledger.title": "Missions",
  "ledger.demo": "Mode démo",
  "ledger.demoTitle": "Affiche toutes les actions, même interdites, pour montrer que c'est le contrat qui refuse.",

  // Event log
  "log.title": "Journal on-chain",
  "log.block": "bloc {n}",
  "log.offline": "hors ligne",
  "log.empty": "Aucun événement. Les événements émis par le contrat apparaîtront ici dès leur minage.",
  "ev.MissionCreated": "Mission créée",
  "ev.MissionCancelled": "Mission annulée",
  "ev.MissionAccepted": "Mission acceptée",
  "ev.WorkDelivered": "Travail livré",
  "ev.PaymentReleased": "Paiement libéré",
  "ev.DisputeOpened": "Litige ouvert",
  "ev.DisputeResolved": "Litige arbitré",
  "evd.created": "{amount} bloqués par {who}",
  "evd.cancelled": "{amount} remboursés à {who}",
  "evd.by": "par {who}",
  "evd.paid": "{amount} versés à {who}",
  "evd.auto": " (réclamation après 3 jours)",
  "evd.resolved": "{f} % / {c} % — {fa} freelance, {ca} client",

  // Notices
  "notice.close": "Fermer",
  "tx.mined": "Transaction minée dans le bloc {n}.",
  "ok.create": "Mission publiée, fonds bloqués",
  "ok.accept": "Mission #{id} acceptée",
  "ok.cancel": "Mission #{id} annulée, client remboursé",
  "ok.approve": "Travail approuvé, {amount} versés",
  "ok.claim": "Paiement réclamé, {amount} reçus",
  "ok.dispute": "Litige ouvert sur la mission #{id}",
  "ok.deliver": "Livrable de la mission #{id} enregistré",
  "ok.resolve": "Litige #{id} arbitré",
  "ok.copied": "Copié",
  "ok.travel": "Horloge avancée de 3 jours",
  "ok.travelText": "Un bloc a été miné avec le nouvel horodatage.",

  // Errors
  "err.connectFirst": "Connectez d'abord MetaMask.",
  "err.wrongNetwork": "MetaMask n'est pas sur le réseau Hardhat Local (chainId 31337).",
  "err.amount": "Montant invalide : utilisez un nombre, par exemple 0.25",
  "err.noMetaMask": "MetaMask n'est pas installé dans ce navigateur.",
  "err.rejectedTitle": "Signature refusée",
  "err.rejectedText": "La transaction a été annulée dans MetaMask.",
  "err.contractTitle": "Transaction rejetée par le contrat",
  "err.contractGeneric": "Le contrat a refusé cette opération.",
  "err.nodeTitle": "Nœud Hardhat injoignable",
  "err.nodeText": "Lancez « npx hardhat node » puis rechargez la page.",
  "err.nonceTitle": "Nonce MetaMask désynchronisé",
  "err.nonceText": "Le nœud a été redémarré. Dans MetaMask : Paramètres > Avancé > Effacer les données de l'onglet activité.",
  "err.generic": "Erreur",
  // Explanation of each require() message of the contract
  "reason.Mission not found": "Cette mission n'existe pas.",
  "reason.Only client": "Seul le client qui a créé la mission peut faire cette action.",
  "reason.Only freelancer": "Seul le freelance assigné à la mission peut faire cette action.",
  "reason.Only client or freelancer": "Seules les deux parties de la mission peuvent ouvrir un litige.",
  "reason.Only arbiter": "Seul l'arbitre (le déployeur du contrat) peut trancher un litige.",
  "reason.Invalid state": "Cette action n'est pas possible dans l'état actuel de la mission.",
  "reason.Amount must be > 0": "Le montant bloqué doit être supérieur à 0 ETH.",
  "reason.Deadline must be in the future": "L'échéance doit être postérieure à l'heure actuelle de la blockchain.",
  "reason.Title required": "Le titre est obligatoire.",
  "reason.Client cannot accept own mission": "Un client ne peut pas accepter sa propre mission.",
  "reason.Deadline passed": "L'échéance de la mission est dépassée.",
  "reason.Empty deliverable hash": "L'empreinte du livrable est vide.",
  "reason.Review period not over": "La période de revue de 3 jours n'est pas terminée : le client peut encore répondre.",
  "reason.Share must be <= 10000 bps": "La part du freelance doit être comprise entre 0 et 10 000 points de base.",
  "reason.Transfer failed": "Le transfert d'ETH a échoué.",

  // Deliver / verify dialog
  "dlg.mission": "Mission #{id}",
  "dlg.deliverTitle": "Livrer le travail",
  "dlg.verifyTitle": "Vérifier un livrable",
  "dlg.deliverText": "Le fichier reste chez vous : seule son empreinte keccak256 est inscrite dans le contrat. Le client pourra la comparer au fichier reçu.",
  "dlg.verifyText": "Déposez le fichier reçu du freelance : son empreinte est comparée à celle enregistrée on-chain.",
  "dlg.file": "Fichier",
  "dlg.text": "Texte",
  "dlg.drop": "Choisir ou glisser un fichier",
  "dlg.dropSub": "Le hash est calculé dans le navigateur, rien n'est envoyé.",
  "dlg.textLabel": "Texte du livrable",
  "dlg.textPh": "Ex. lien du dépôt GitHub + numéro de commit",
  "dlg.hash": "Empreinte keccak256",
  "dlg.close": "Fermer",
  "dlg.send": "Envoyer l'empreinte",
  "dlg.match": "Identique au hash on-chain : c'est bien le fichier livré.",
  "dlg.noMatch": "Différent du hash on-chain ({hash}).",
  // Resolve dialog
  "res.eyebrow": "Mission #{id} · {amount} en jeu",
  "res.title": "Arbitrer le litige",
  "res.text": "Répartissez les fonds bloqués entre le freelance et le client. La décision est définitive.",
  "res.aria": "Part du freelance en points de base",
  "res.submit": "Rendre la décision",

  // Durations
  "dur.d": "{d} j {h} h",
  "dur.h": "{h} h {m} min",
  "dur.m": "{m} min",
  "dur.s": "{s} s",
};

const en = {
  "brand.tagline": "Escrow for student freelance missions",
  "lang.label": "Language",
  "theme.label": "Theme",
  "theme.auto": "Automatic (follows the system)",
  "theme.light": "Light, high contrast (projector)",
  "theme.dark": "Dark",

  "chain.notDeployed": "Contract not deployed",
  "chain.nodeDown": "Hardhat node unreachable",
  "chain.block": "Block {n}",
  "chain.clockTitle": "Blockchain time (block.timestamp)",
  "chain.copyContract": "Copy contract address",
  "chain.travel": "+3 days",
  "chain.travelTitle": "Local demo: moves the node clock forward by 3 days",

  "wallet.connect": "Connect MetaMask",
  "wallet.switch": "Switch to Hardhat Local",
  "role.arbiter": "Arbiter",
  "role.client": "Client",
  "role.freelancer": "Freelancer",
  "role.none": "No missions yet",
  "role.title": "Your roles on existing missions",
  "addr.you": "you",
  "addr.nobody": "nobody yet",

  "summary.missions": (n) => `${n} mission${n !== 1 ? "s" : ""}`,
  "summary.escrow": "{amount} in escrow",
  "summary.open": (n) => `${n} open`,
  "summary.disputes": (n) => `${n} dispute${n !== 1 ? "s" : ""}`,
  "filter.all": "All",
  "filter.open": "Open",
  "filter.mine": "My missions",
  "filter.disputed": "Disputes",
  "filter.aria": "Filter missions",

  "status.Open": "Open",
  "status.Accepted": "Accepted",
  "status.Delivered": "Delivered",
  "status.Completed": "Paid",
  "status.Cancelled": "Cancelled",
  "status.Disputed": "Disputed",
  "status.Resolved": "Resolved",
  "step.dispute": "Dispute",

  "line.open.client": "Waiting for a freelancer · you can still cancel",
  "line.open.other": "Available: accept it to work on it",
  "line.accepted.me": "Deliver before {date} · {left} left",
  "line.accepted.other": "In progress · delivery due before {date}",
  "line.accepted.late": "Deadline passed without delivery",
  "line.delivered.client": "Work delivered: approve it or open a dispute · {left} left",
  "line.delivered.clientLate": "Work delivered · the freelancer can now claim the payment",
  "line.delivered.freelancer": "Waiting for approval · you can claim in {left}",
  "line.delivered.freelancerReady": "The client did not answer within 3 days: claim your payment",
  "line.delivered.other": "Delivered · the client has {left} left to approve",
  "line.delivered.otherLate": "Delivered · review period over",
  "line.completed": "Done · {amount} paid to the freelancer",
  "line.cancelled": "Cancelled · client refunded",
  "line.disputed.arbiter": "Dispute to settle: the funds are frozen",
  "line.disputed.other": "Funds frozen until the arbiter decides",
  "line.resolved": "Funds split by the arbiter",

  "action.accept": "Accept",
  "action.cancel": "Cancel and refund",
  "action.deliver": "Deliver work",
  "action.approve": "Approve and pay",
  "action.claim": "Claim payment",
  "action.dispute": "Open a dispute",
  "action.resolve": "Settle",
  "stage.simulate": "Simulating…",
  "stage.sign": "Sign in MetaMask…",
  "stage.mining": "Confirming…",
  "actions.none": "No other action for your account.",
  "actions.connect": "Connect MetaMask to act on this mission.",
  "demo.label": "Demo mode, normally hidden:",
  "row.toggle": "Show details",

  "desc.heading": "Description",
  "desc.offchain": "off-chain",
  "desc.missing": "Text not available in this browser. Only its fingerprint is public.",
  "desc.verified": "Fingerprint verified: the text matches the on-chain hash",
  "desc.mismatch": "The text does not match the on-chain hash",
  "facts.client": "Client",
  "facts.freelancer": "Freelancer",
  "facts.deadline": "Deadline",
  "facts.deliveredAt": "Delivered on",
  "facts.descHash": "Description hash",
  "facts.delivHash": "Deliverable hash",
  "deliv.none": "Not delivered yet",
  "deliv.text": "Text delivered",
  "deliv.verify": "Verify a file",
  "copy": "Copy",

  "todo.title": "To do",
  "todo.subtitle": "These missions are waiting for you.",
  "todo.view": "View",

  "setup.title": "Before you start",
  "setup.progress": "{done} of {total} ready",
  "setup.node": "Hardhat node running",
  "setup.nodeHelp": "In a terminal: <code>npx hardhat node</code>",
  "setup.contract": "Contract deployed on this node",
  "setup.contractHelp": "In a 2nd terminal: <code>npm run deploy</code> (then <code>npm run seed</code> for demo missions)",
  "setup.metamask": "MetaMask extension installed",
  "setup.metamaskHelp": "Install it from <a href=\"https://metamask.io/download/\" target=\"_blank\" rel=\"noopener\">metamask.io</a>, then reload the page.",
  "setup.account": "MetaMask account connected",
  "setup.accountHelp": "Import a Hardhat test account (see README), then connect it.",
  "setup.network": "Hardhat Local network (chainId 31337)",
  "setup.networkHelp": "MetaMask must use the local network to sign.",

  "empty.noneTitle": "No missions here",
  "empty.otherFilter": "Change the filter to see the other missions.",
  "empty.first": "Post the first mission with the form.",
  "empty.waitTitle": "Waiting for the blockchain",
  "empty.waitText": "Follow the “Before you start” list above: the page updates by itself.",

  "form.heading": "Post a mission",
  "form.subtitle": "The amount stays locked in the contract until the work is approved.",
  "form.title": "Title",
  "form.titlePh": "E.g. Figma mockup for the student union app",
  "form.description": "Description",
  "form.descPh": "Expected deliverables, format, acceptance criteria…",
  "form.hashSent": "Fingerprint sent:",
  "form.amount": "Amount",
  "form.deadline": "Deadline",
  "form.submit": "Lock funds and post",
  "form.connectHint": "Connect MetaMask to post a mission.",
  "storage.title": "Where does the data go?",
  "storage.on": "On the blockchain",
  "storage.onText": "Title, amount, deadline, addresses, status and the <b>keccak256 fingerprints</b> of the description and the deliverable.",
  "storage.off": "Off-chain",
  "storage.offText": "The description text and the delivered files stay in this browser (localStorage) or with the freelancer.",

  "ledger.title": "Missions",
  "ledger.demo": "Demo mode",
  "ledger.demoTitle": "Shows every action, even forbidden ones, to prove that the contract is what refuses them.",

  "log.title": "On-chain log",
  "log.block": "block {n}",
  "log.offline": "offline",
  "log.empty": "No events yet. Events emitted by the contract will show up here as soon as they are mined.",
  "ev.MissionCreated": "Mission created",
  "ev.MissionCancelled": "Mission cancelled",
  "ev.MissionAccepted": "Mission accepted",
  "ev.WorkDelivered": "Work delivered",
  "ev.PaymentReleased": "Payment released",
  "ev.DisputeOpened": "Dispute opened",
  "ev.DisputeResolved": "Dispute settled",
  "evd.created": "{amount} locked by {who}",
  "evd.cancelled": "{amount} refunded to {who}",
  "evd.by": "by {who}",
  "evd.paid": "{amount} paid to {who}",
  "evd.auto": " (claimed after 3 days)",
  "evd.resolved": "{f} % / {c} % — {fa} freelancer, {ca} client",

  "notice.close": "Close",
  "tx.mined": "Transaction mined in block {n}.",
  "ok.create": "Mission posted, funds locked",
  "ok.accept": "Mission #{id} accepted",
  "ok.cancel": "Mission #{id} cancelled, client refunded",
  "ok.approve": "Work approved, {amount} paid",
  "ok.claim": "Payment claimed, {amount} received",
  "ok.dispute": "Dispute opened on mission #{id}",
  "ok.deliver": "Deliverable for mission #{id} recorded",
  "ok.resolve": "Dispute #{id} settled",
  "ok.copied": "Copied",
  "ok.travel": "Clock moved forward by 3 days",
  "ok.travelText": "A block was mined with the new timestamp.",

  "err.connectFirst": "Connect MetaMask first.",
  "err.wrongNetwork": "MetaMask is not on the Hardhat Local network (chainId 31337).",
  "err.amount": "Invalid amount: use a number, for example 0.25",
  "err.noMetaMask": "MetaMask is not installed in this browser.",
  "err.rejectedTitle": "Signature rejected",
  "err.rejectedText": "The transaction was cancelled in MetaMask.",
  "err.contractTitle": "Transaction rejected by the contract",
  "err.contractGeneric": "The contract refused this operation.",
  "err.nodeTitle": "Hardhat node unreachable",
  "err.nodeText": "Run “npx hardhat node” then reload the page.",
  "err.nonceTitle": "MetaMask nonce out of sync",
  "err.nonceText": "The node was restarted. In MetaMask: Settings > Advanced > Clear activity tab data.",
  "err.generic": "Error",
  "reason.Mission not found": "This mission does not exist.",
  "reason.Only client": "Only the client who created the mission can do this.",
  "reason.Only freelancer": "Only the freelancer assigned to the mission can do this.",
  "reason.Only client or freelancer": "Only the two parties of the mission can open a dispute.",
  "reason.Only arbiter": "Only the arbiter (the contract deployer) can settle a dispute.",
  "reason.Invalid state": "This action is not possible in the mission's current state.",
  "reason.Amount must be > 0": "The locked amount must be greater than 0 ETH.",
  "reason.Deadline must be in the future": "The deadline must be later than the current blockchain time.",
  "reason.Title required": "The title is required.",
  "reason.Client cannot accept own mission": "A client cannot accept their own mission.",
  "reason.Deadline passed": "The mission deadline has passed.",
  "reason.Empty deliverable hash": "The deliverable fingerprint is empty.",
  "reason.Review period not over": "The 3-day review period is not over: the client can still answer.",
  "reason.Share must be <= 10000 bps": "The freelancer's share must be between 0 and 10,000 basis points.",
  "reason.Transfer failed": "The ETH transfer failed.",

  "dlg.mission": "Mission #{id}",
  "dlg.deliverTitle": "Deliver the work",
  "dlg.verifyTitle": "Verify a deliverable",
  "dlg.deliverText": "The file stays with you: only its keccak256 fingerprint is written to the contract. The client can compare it with the file they receive.",
  "dlg.verifyText": "Drop the file received from the freelancer: its fingerprint is compared with the one recorded on-chain.",
  "dlg.file": "File",
  "dlg.text": "Text",
  "dlg.drop": "Choose or drop a file",
  "dlg.dropSub": "The hash is computed in the browser, nothing is uploaded.",
  "dlg.textLabel": "Deliverable text",
  "dlg.textPh": "E.g. GitHub repository link + commit number",
  "dlg.hash": "keccak256 fingerprint",
  "dlg.close": "Close",
  "dlg.send": "Send the fingerprint",
  "dlg.match": "Matches the on-chain hash: this is the delivered file.",
  "dlg.noMatch": "Different from the on-chain hash ({hash}).",
  "res.eyebrow": "Mission #{id} · {amount} at stake",
  "res.title": "Settle the dispute",
  "res.text": "Split the locked funds between the freelancer and the client. The decision is final.",
  "res.aria": "Freelancer's share in basis points",
  "res.submit": "Give the decision",

  "dur.d": "{d} d {h} h",
  "dur.h": "{h} h {m} min",
  "dur.m": "{m} min",
  "dur.s": "{s} s",
};

const DICTS = { fr, en };

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved in DICTS) return saved;
  } catch { /* storage blocked */ }
  return "fr"; // the project is presented in French
}

let lang = initialLang();

export const getLang = () => lang;

export function setLang(next) {
  if (!(next in DICTS)) return;
  lang = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage blocked */ }
}

/** Translate `key`, replacing {placeholders} with `vars`. */
export function t(key, vars = {}) {
  const value = DICTS[lang][key] ?? DICTS.fr[key] ?? key;
  if (typeof value === "function") return value(vars.n ?? vars);
  return value.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
}

/** Has a translation for this key? (used for contract revert reasons) */
export const hasKey = (key) => key in DICTS[lang] || key in DICTS.fr;

/** Translates the static HTML (elements carrying data-i18n* attributes). */
export function translateStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  root.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
}

document.documentElement.lang = lang;
