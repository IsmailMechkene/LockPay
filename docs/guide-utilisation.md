# Guide d'utilisation de LockPay

Ce guide explique comment se servir de l'application, écran par écran, selon votre rôle : client, freelance ou arbitre.
Pour installer le projet et lancer la blockchain locale, voir d'abord le [README](../README.md#6-installation-et-lancement).

---

## Sommaire

1. [Le principe en 30 secondes](#1-le-principe-en-30-secondes)
2. [Premier lancement](#2-premier-lancement)
3. [Visite de l'interface](#3-visite-de-linterface)
4. [Client : publier et payer une mission](#4-client--publier-et-payer-une-mission)
5. [Freelance : accepter, livrer, être payé](#5-freelance--accepter-livrer-être-payé)
6. [Litiges et arbitrage](#6-litiges-et-arbitrage)
7. [Statuts d'une mission](#7-statuts-dune-mission)
8. [Comprendre les messages d'erreur](#8-comprendre-les-messages-derreur)
9. [Outils de démonstration](#9-outils-de-démonstration)
10. [Problèmes fréquents](#10-problèmes-fréquents)

---

## 1. Le principe en 30 secondes

1. Le **client** publie une mission et **bloque** le paiement en ETH dans le contrat.
2. Un **freelance** l'accepte, fait le travail et **livre** : seule l'empreinte (hash) du fichier est enregistrée sur la blockchain.
3. Le client **approuve** et le contrat paie le freelance. S'il ne répond pas pendant 3 jours, le freelance peut **réclamer** le paiement seul.
4. En cas de désaccord, l'un des deux ouvre un **litige** et l'**arbitre** répartit les fonds.

Personne, pas même l'arbitre, ne peut retirer l'argent bloqué en dehors de ces règles.

## 2. Premier lancement

Ouvrez l'URL affichée par Vite (en général `http://localhost:5173`).

Si quelque chose n'est pas prêt, un encadré **« Avant de commencer »** apparaît au-dessus de la liste. Il montre une étape à la fois, avec la commande à lancer ou le bouton à cliquer, et se coche tout seul quand l'étape est réglée :

| Étape | Ce qu'il faut faire |
|---|---|
| 1. Nœud Hardhat lancé | `npx hardhat node` dans un terminal |
| 2. Contrat déployé sur ce nœud | `npm run deploy` (puis `npm run seed` pour 2 missions de démo) |
| 3. Extension MetaMask installée | l'installer depuis metamask.io, puis recharger la page |
| 4. Compte MetaMask connecté | bouton **Connecter MetaMask** |
| 5. Réseau Hardhat Local (31337) | bouton **Passer sur Hardhat Local** |

Quand les 5 étapes sont cochées, l'encadré disparaît.

> Vous pouvez consulter les missions et le journal sans connecter MetaMask. Il faut un compte connecté uniquement pour agir.

**Langue.** Le bouton **FR / EN** en haut à droite change la langue de toute l'interface. Le choix est mémorisé.

## 3. Visite de l'interface

```
┌───────────────────────────────────────────────────────────────────────────┐
│ LockPay    Hardhat Local · Bloc 12 · horloge · contrat · +3 jours  FR|EN  [compte] │
├──────────────────┬──────────────────────────────────┬─────────────────────┤
│ Publier une      │ À faire (missions qui vous        │ Journal on-chain    │
│ mission          │ attendent)                        │ (événements en      │
│ (formulaire)     │                                   │ direct)             │
│                  │ Missions                          │                     │
│ Où vont les      │ Toutes · Ouvertes · Mes missions  │                     │
│ données ?        │ · Litiges           [Mode démo]   │                     │
│                  │ ─ ligne de mission ─              │                     │
│                  │ ─ ligne de mission ─              │                     │
└──────────────────┴──────────────────────────────────┴─────────────────────┘
```

### Barre du haut

- **Hardhat Local · 31337** : le réseau lu par l'application.
- **Bloc N** : le dernier bloc miné.
- **Horloge** : l'heure *de la blockchain* (`block.timestamp`). C'est elle qui compte pour les échéances, pas celle de votre ordinateur.
- **Adresse du contrat** : cliquer pour la copier.
- **+3 jours** : outil de démonstration, voir [§9](#9-outils-de-démonstration).
- **Votre compte** : le badge **Arbitre** si vous êtes le compte qui a déployé le contrat, sinon le nombre de missions où vous êtes *Client* et *Freelance*.

### Encadré « À faire »

Il liste les missions qui attendent **une action de votre part**, avec le bouton correspondant (par exemple *Approuver et payer*). **Voir** ouvre la mission dans la liste. Quand vous n'avez rien à faire, l'encadré n'apparaît pas.

### Liste des missions

Chaque ligne affiche :

- le numéro, le titre et le montant bloqué ;
- un **tampon de statut** (Ouverte, Livrée, Payée…) ;
- votre rôle sur cette mission (*Client* ou *Freelance*), s'il y en a un ;
- **une phrase** qui dit où en est la mission et ce qui vient ensuite, par exemple « Travail livré : validez-le ou ouvrez un litige · reste 2 j 23 h » ;
- l'**action principale**, juste sous la phrase, quand vous pouvez agir.

**Cliquer sur la ligne** la déplie et affiche :

- la frise des étapes (Ouverte → Acceptée → Livrée → Payée) ;
- la description complète et le badge **« Empreinte vérifiée »** quand le texte correspond au hash enregistré ;
- le client, le freelance, l'échéance, la date de livraison et les hash ;
- les **actions secondaires** : *Annuler et rembourser*, *Ouvrir un litige*…

Les onglets **Toutes / Ouvertes / Mes missions / Litiges** filtrent la liste.

### Journal on-chain

La colonne de droite affiche chaque événement émis par le contrat (mission créée, acceptée, livrée, paiement libéré…) dès qu'il est miné, avec le numéro de bloc et l'heure. C'est la preuve publique de tout ce qui s'est passé.

## 4. Client : publier et payer une mission

### Publier

1. Dans **Publier une mission**, remplissez :
   - **Titre** : public, enregistré sur la blockchain ;
   - **Description** : livrables, format, critères. Elle reste dans votre navigateur ; seule son empreinte est envoyée (affichée sous le champ : *Empreinte envoyée*) ;
   - **Montant** en ETH, par exemple `0.5` ;
   - **Échéance** : date limite de livraison (7 jours par défaut).
2. Cliquez **Bloquer les fonds et publier**, puis confirmez dans MetaMask.
3. La mission apparaît avec le statut **Ouverte** et l'ETH est bloqué dans le contrat (le total « en séquestre » augmente).

### Annuler (tant que personne n'a accepté)

Dépliez la mission → **Annuler et rembourser**. L'ETH revient intégralement sur votre compte. Une fois la mission acceptée, l'annulation n'est plus possible.

### Recevoir et vérifier le travail

Quand le freelance a livré, la mission passe à **Livrée** et apparaît dans votre encadré **À faire**.

1. Récupérez le fichier auprès du freelance (e-mail, Drive, dépôt GitHub…).
2. Dépliez la mission → **Vérifier un fichier** → déposez le fichier reçu.
   - « Identique au hash on-chain » : c'est bien le fichier livré, il n'a pas été modifié.
   - « Différent du hash on-chain » : ce n'est pas le même fichier.
3. Ensuite :
   - **Approuver et payer** : le contrat verse tout le montant au freelance. Statut **Payée**.
   - ou **Ouvrir un litige** si le travail ne convient pas. Voir [§6](#6-litiges-et-arbitrage).

> Vous avez **3 jours** après la livraison pour répondre. Passé ce délai, le freelance peut réclamer le paiement sans votre accord.

## 5. Freelance : accepter, livrer, être payé

### Accepter

Sur une mission **Ouverte** publiée par quelqu'un d'autre, cliquez **Accepter** sous la phrase de statut, puis confirmez dans MetaMask. La mission passe à **Acceptée** et vous en êtes le freelance. On ne peut pas accepter sa propre mission.

### Livrer

Avant l'échéance (la ligne affiche « À livrer avant le … · reste … ») :

1. Cliquez **Livrer le travail**.
2. Choisissez l'onglet :
   - **Fichier** : déposez votre livrable (PDF, zip, image…) ;
   - **Texte** : par exemple un lien de dépôt GitHub et un numéro de commit.
3. L'empreinte keccak256 s'affiche. Elle est calculée dans le navigateur et **le fichier n'est envoyé nulle part**.
4. Cliquez **Envoyer l'empreinte**, puis confirmez dans MetaMask. Statut **Livrée**.
5. Envoyez le fichier au client par votre canal habituel. Il pourra vérifier qu'il correspond à l'empreinte.

### Être payé

- Si le client approuve, vous recevez l'ETH automatiquement.
- Si le client ne répond pas en **3 jours**, la ligne indique « Le client n'a pas répondu en 3 jours : réclamez le paiement ». Cliquez **Réclamer le paiement**.
- Si vous n'êtes pas d'accord avec le client, vous pouvez vous aussi **ouvrir un litige** après la livraison.

## 6. Litiges et arbitrage

### Ouvrir un litige

Client ou freelance : dépliez une mission **Livrée** → **Ouvrir un litige**. Les fonds sont **gelés** (statut **En litige**) : ni l'approbation ni la réclamation ne sont plus possibles.

### Arbitrer (compte arbitre uniquement)

Le compte qui a déployé le contrat porte le badge **Arbitre**. Les litiges en attente apparaissent dans son encadré **À faire**.

1. Cliquez **Arbitrer**.
2. Choisissez la part du freelance avec le curseur ou les raccourcis **0 % / 25 % / 50 % / 75 % / 100 %**. Les montants exacts pour chacun s'affichent en direct.
3. **Rendre la décision**, puis confirmez dans MetaMask. Le contrat envoie à chacun sa part. Statut **Arbitrée**.

La décision est définitive : une mission arbitrée ne peut plus être payée une seconde fois.

## 7. Statuts d'une mission

| Statut | Signification | Qui peut agir ensuite |
|---|---|---|
| **Ouverte** | Fonds bloqués, en attente d'un freelance | Freelance : *Accepter* · Client : *Annuler et rembourser* |
| **Acceptée** | Un freelance travaille dessus | Freelance : *Livrer le travail* (avant l'échéance) |
| **Livrée** | Empreinte du livrable enregistrée, 3 jours de revue | Client : *Approuver et payer* · Freelance : *Réclamer* après 3 jours · Les deux : *Ouvrir un litige* |
| **En litige** | Fonds gelés | Arbitre : *Arbitrer* |
| **Payée** | Le freelance a reçu le montant | Personne (état final) |
| **Annulée** | Le client a été remboursé | Personne (état final) |
| **Arbitrée** | Fonds répartis par l'arbitre | Personne (état final) |

## 8. Comprendre les messages d'erreur

Avant d'ouvrir MetaMask, l'application **simule** chaque transaction. Si le contrat la refuserait, un encadré rouge **« Transaction rejetée par le contrat »** apparaît en haut à droite, avec :

- le message exact du contrat (par exemple `revert "Only client"`) ;
- une explication en clair.

Il reste affiché jusqu'à ce que vous le fermiez.

| Message du contrat | Signification |
|---|---|
| `Only client` | Seul le client de la mission peut faire cela. |
| `Only freelancer` | Seul le freelance assigné peut faire cela. |
| `Only arbiter` | Seul l'arbitre peut trancher un litige. |
| `Only client or freelancer` | Seules les deux parties peuvent ouvrir un litige. |
| `Invalid state` | Action impossible dans le statut actuel (par exemple payer une mission déjà payée). |
| `Amount must be > 0` | Le montant doit être supérieur à 0. |
| `Deadline must be in the future` | L'échéance doit être après l'heure de la blockchain. |
| `Client cannot accept own mission` | On ne peut pas accepter sa propre mission. |
| `Deadline passed` | L'échéance est dépassée. |
| `Empty deliverable hash` | Aucun fichier ni texte n'a été fourni. |
| `Review period not over` | Les 3 jours de revue ne sont pas écoulés. |
| `Share must be <= 10000 bps` | La part de l'arbitrage doit être entre 0 et 100 %. |

Autres encadrés possibles : **Signature refusée** (vous avez cliqué *Refuser* dans MetaMask), **Nœud Hardhat injoignable**, **Nonce MetaMask désynchronisé** (voir [§10](#10-problèmes-fréquents)).

Les confirmations vertes (« Mission publiée, fonds bloqués », etc.) indiquent le bloc où la transaction a été minée et disparaissent seules.

## 9. Outils de démonstration

Ces deux outils servent à la soutenance. Ils n'existeraient pas dans une version en production.

### Mode démo

L'interrupteur **Mode démo**, au-dessus de la liste, affiche aussi les actions que votre compte n'a **pas** le droit de faire, en pointillés, dans le détail de chaque mission. En cliquant dessus, vous montrez que c'est **le contrat** qui refuse, et pas seulement l'interface qui cache le bouton.

Exemple : connecté en tant que client, dépliez votre mission ouverte → **Accepter** (en pointillés) → `revert "Client cannot accept own mission"`.

### +3 jours

Le bouton **+3 jours** de la barre du haut avance l'horloge du nœud local de 3 jours et mine un bloc. Il sert à montrer la réclamation automatique sans attendre trois vrais jours. L'heure affichée dans la barre du haut avance en conséquence.

> Il ne fonctionne que sur le nœud Hardhat local.

## 10. Problèmes fréquents

| Symptôme | Solution |
|---|---|
| L'encadré « Avant de commencer » reste bloqué sur *Nœud Hardhat lancé* | Lancez `npx hardhat node` et laissez le terminal ouvert. |
| « Contrat non déployé » après un redémarrage du nœud | Le nœud repart de zéro : relancez `npm run deploy` (et `npm run seed`). |
| Encadré « Nonce MetaMask désynchronisé » | Dans MetaMask : *Paramètres → Avancé → Effacer les données de l'onglet activité*, pour chaque compte utilisé. |
| Le bouton **Passer sur Hardhat Local** n'apparaît pas alors que MetaMask est sur un autre réseau | Ajoutez le réseau manuellement : RPC `http://127.0.0.1:8545`, chainId `31337`, symbole `ETH`. |
| « Texte non disponible dans ce navigateur » sur une mission | La description est stockée dans le navigateur qui l'a publiée. Les autres navigateurs ne voient que son empreinte : c'est voulu. |
| Je ne vois aucun bouton sur une mission | Votre compte n'a rien à faire à ce stade. Vérifiez votre rôle (badge en haut à droite et puce *Client / Freelance* sur la ligne), ou activez le **Mode démo**. |
| *Réclamer le paiement* est refusé | La période de revue n'est pas finie : la ligne indique le temps restant. En démo, utilisez **+3 jours**. |
| Je n'ai plus d'ETH sur un compte | Les comptes Hardhat démarrent avec 10 000 ETH. Redémarrer le nœud remet tous les soldes à 10 000 ETH (et efface les missions : redéployez). |
| Changer de compte MetaMask ne change rien | L'application suit le compte actif dans MetaMask. Vérifiez que ce compte est bien autorisé pour le site (MetaMask → *Sites connectés*). |
