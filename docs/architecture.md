# Architecture de TrustLance

Ce document décrit comment les morceaux de la DApp s'emboîtent : qui parle à qui, ce qui est stocké où, et comment se déroule une mission de bout en bout.

## 1. Vue d'ensemble

```mermaid
flowchart LR
    subgraph Navigateur
        UI["Frontend<br/>Vite + JS vanilla<br/>ethers v6"]
        LS[("localStorage<br/>descriptions,<br/>noms des livrables")]
        MM["MetaMask<br/>clés privées,<br/>signature"]
    end

    subgraph "Nœud Hardhat (127.0.0.1:8545, chainId 31337)"
        SC["Contrat TrustLance.sol<br/>missions, ETH en séquestre"]
        EV[["Événements<br/>MissionCreated, WorkDelivered…"]]
    end

    FILES[("Fichiers livrés<br/>(restent chez le freelance)")]

    UI -- "lecture : eth_call, getLogs<br/>(JsonRpcProvider)" --> SC
    UI -- "demande de signature" --> MM
    MM -- "transaction signée<br/>eth_sendRawTransaction" --> SC
    SC -- émet --> EV
    EV -- "lus à chaque bloc" --> UI
    UI <-- "texte ↔ hash keccak256" --> LS
    FILES -. "hash calculé<br/>dans le navigateur" .-> UI
```

Points clés :

- **Lecture** : le frontend lit le contrat directement via le nœud (`JsonRpcProvider`). Cela fonctionne même sans MetaMask connecté.
- **Écriture** : chaque action est d'abord **simulée** (`eth_call` depuis l'adresse de l'utilisateur). Si le contrat refuserait, on affiche son message `require` exact. Sinon, MetaMask signe la vraie transaction.
- **Journal** : à chaque nouveau bloc, le frontend récupère les événements du contrat (`queryFilter`) et met la liste des missions à jour.

## 2. Stockage on-chain / hors chaîne

| Donnée | Où | Pourquoi |
|---|---|---|
| Montant en ETH, statut, adresses client / freelance / arbitre | **On-chain** (contrat) | Doit être infalsifiable : c'est ce qui décide des paiements. |
| Titre, échéance, date de livraison | **On-chain** | Court, utile pour lister les missions et pour les règles de délai. |
| `descriptionHash` (32 octets) | **On-chain** | Engagement : prouve quel texte a été accepté, sans le publier. |
| Texte complet de la description | **Hors chaîne** (localStorage) | Long donc cher en gaz, et potentiellement privé. |
| `deliverableHash` (32 octets) | **On-chain** | Preuve horodatée de ce qui a été livré. |
| Fichier livré | **Hors chaîne** (chez le freelance, envoyé au client par un autre canal) | Un fichier peut peser des Mo : impossible à stocker on-chain. |

Le lien entre les deux mondes est la fonction **keccak256** : n'importe qui peut re-hacher un texte ou un fichier et vérifier qu'il correspond au hash enregistré. L'interface le fait automatiquement (« Empreinte vérifiée ») et propose « Vérifier un fichier » pour le livrable.

## 3. Cas d'utilisation

```mermaid
flowchart LR
    C(["Client"])
    F(["Freelance"])
    A(["Arbitre<br/>(déployeur)"])

    subgraph TrustLance
        UC1["Créer une mission<br/>+ bloquer l'ETH"]
        UC2["Annuler une mission ouverte"]
        UC3["Accepter une mission"]
        UC4["Livrer (hash du travail)"]
        UC5["Approuver et payer"]
        UC6["Réclamer après 3 jours"]
        UC7["Ouvrir un litige"]
        UC8["Arbitrer (répartir les fonds)"]
        UC9["Consulter missions et événements"]
    end

    C --- UC1
    C --- UC2
    C --- UC5
    C --- UC7
    F --- UC3
    F --- UC4
    F --- UC6
    F --- UC7
    A --- UC8
    C --- UC9
    F --- UC9
    A --- UC9
```

Une même adresse peut être client d'une mission et freelance d'une autre. Seule contrainte : on ne peut pas accepter sa propre mission.

## 4. Machine à états d'une mission

```mermaid
stateDiagram-v2
    [*] --> Open: createMission (ETH bloqué)
    Open --> Cancelled: cancelMission (client remboursé)
    Open --> Accepted: acceptMission
    Accepted --> Delivered: deliverWork (avant l'échéance)
    Delivered --> Completed: approveWork (client)
    Delivered --> Completed: claimPayment (freelance, après 3 jours)
    Delivered --> Disputed: openDispute (client ou freelance)
    Disputed --> Resolved: resolveDispute (arbitre, 0 à 10 000 bps)
    Completed --> [*]
    Cancelled --> [*]
    Resolved --> [*]
```

`Completed`, `Cancelled` et `Resolved` sont des états finaux : aucune fonction de paiement n'accepte ces états. C'est ce qui rend un double paiement impossible.

## 5. Séquence du scénario principal

```mermaid
sequenceDiagram
    autonumber
    actor C as Client
    actor F as Freelance
    participant UI as Frontend
    participant MM as MetaMask
    participant SC as TrustLance.sol

    C->>UI: Titre, description, 0.5 ETH, échéance
    UI->>UI: descriptionHash = keccak256(description)<br/>texte → localStorage
    UI->>SC: eth_call createMission (simulation)
    UI->>MM: signer createMission{value: 0.5 ETH}
    MM->>SC: transaction
    SC-->>UI: event MissionCreated(id, client, 0.5 ETH)

    F->>UI: « Accepter »
    UI->>MM: signer acceptMission(id)
    MM->>SC: transaction
    SC-->>UI: event MissionAccepted(id, freelance)

    F->>UI: dépose le fichier livré
    UI->>UI: deliverableHash = keccak256(octets du fichier)
    UI->>MM: signer deliverWork(id, hash)
    MM->>SC: transaction (vérifie échéance, hash ≠ 0)
    SC-->>UI: event WorkDelivered(id, freelance, hash)

    C->>UI: « Vérifier un fichier » puis « Approuver »
    UI->>MM: signer approveWork(id)
    MM->>SC: transaction
    SC->>SC: status = Completed (effet)
    SC->>F: transfert de 0.5 ETH (interaction)
    SC-->>UI: event PaymentReleased(id, freelance, 0.5 ETH)
```

## 6. Sécurité du contrat, en bref

| Mesure | Où dans le code |
|---|---|
| Contrôle des rôles par modificateurs | `onlyClient`, `onlyFreelancer`, `onlyParties`, `onlyArbiter` |
| Contrôle des états | `inStatus(id, Status.X)` sur chaque fonction |
| Checks-Effects-Interactions | le statut change **avant** l'appel `_send` |
| Anti-réentrance | `nonReentrant` (OpenZeppelin `ReentrancyGuard`) sur toutes les fonctions qui envoient de l'ETH |
| Aucun wei perdu à l'arbitrage | `clientAmount = amount - freelancerAmount` |
| Arbitre immuable | `address public immutable arbiter`, fixé au déploiement |

## 7. Centralisé vs décentralisé

| Critère | Plateforme centralisée (type Malt, Fiverr) | TrustLance (contrat Ethereum) |
|---|---|---|
| Garde des fonds | La plateforme détient l'argent sur son compte bancaire | Le contrat détient l'ETH ; personne ne peut le déplacer hors des règles codées |
| Règles de paiement | Conditions générales, modifiables par la plateforme | Code public et immuable une fois déployé |
| Confiance requise | Envers l'entreprise (solvabilité, honnêteté, support) | Envers le code et, uniquement en cas de litige, envers l'arbitre |
| Transparence | Historique visible seulement par la plateforme | Chaque action est un événement public et horodaté |
| Commission | 10 à 20 % en général | Seulement les frais de gaz |
| Litiges | Service client, procédure interne | Arbitre unique (limite connue, voir README) |
| Censure / gel de compte | Possible à tout moment | Impossible sur une mission déjà financée |
| Confidentialité | Données privées chez la plateforme | Données on-chain publiques ; d'où le stockage hors chaîne des textes |
| Expérience utilisateur | Carte bancaire, e-mail | Portefeuille, gestion des clés, volatilité de l'ETH |
| Réversibilité d'une erreur | Remboursement possible par le support | Transaction définitive |
