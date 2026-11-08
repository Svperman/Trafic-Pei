# Trafic Péi

GPS et trafic pour La Réunion, inspiré de Waze et Google Maps. Gratuit, sans clé ni carte bancaire.

## Fonctionnalités

- **Recherche** d'adresses et de lieux (Photon / OpenStreetMap), limitée à La Réunion.
- **Itinéraires en voiture** (OSRM) : départ au choix (ma position, une adresse ou un point touché sur la carte), arrivée, inversion, jusqu'à 3 alternatives.
- **Plus rapide / plus court (raccourcis)** et **contournement des bouchons signalés** : les itinéraires qui passent par un bouchon, un accident, une route fermée ou un éboulement signalés sont pénalisés ou écartés ; en navigation, l'appli propose un détour si un bouchon est signalé devant toi.
- Boutons **Ouvrir dans Waze / Google Maps** pour comparer avec le trafic en temps réel.
- **Navigation guidée vocale** en français : « Dans 300 mètres, tournez à gauche sur N6 », heure d'arrivée, recalcul automatique si tu sors de la route.
- **Suivi de position en direct** : point bleu animé, direction, tracé, vitesse et distance.
- **Lieux autour de moi** : stations-service (données de l'appli Carburant Réunion), parkings, restos, pharmacies, hôpitaux, bornes de recharge, distributeurs — avec « ouvert / fermé » en direct, détails utiles (gratuit/payant, cuisine, urgences, type de prise…), liste des plus proches et bouton Google Maps pour les avis et photos.
- **Signalements partagés** : bouchon, accident, danger, travaux, route fermée, éboulement, radier / inondation. Les autres utilisateurs peuvent confirmer (« Toujours là ») ou dire que c'est fini (« Plus là »).
- **Radars fixes** sur la carte (bouton « Afficher / Masquer les radars »), masqués automatiquement en roulant.
- **Alertes en roulant** : zones de danger (300 m en ville, 2 km sur route) et signalements annoncés à voix haute.
- **Trafic Waze** : la carte officielle Waze intégrée, pour voir les bouchons en direct.

Conforme à l'interdiction d'indiquer l'emplacement précis des radars à un conducteur : en roulant, l'appli annonce une zone (300 m en ville, 2 km sur route, 4 km sur voie rapide) et masque les radars.

## Activer les signalements partagés (une seule fois)

Sans cette étape, l'appli fonctionne, mais tes signalements restent sur ton appareil.

1. Crée un Google Sheet vide nommé « Trafic Péi – Signalements ».
2. **Extensions → Apps Script**. Remplace le contenu de `Code.gs` par `apps-script/Code.gs`.
3. Choisis la fonction **installer** puis **▶ Exécuter** et accepte les autorisations.
4. **Déployer → Nouveau déploiement → Application Web** : « Exécuter en tant que : Moi », « Qui a accès : Tout le monde ».
5. Copie l'URL qui finit par `/exec` et colle-la dans `index.html`, ligne `REPORTS_URL: ''`.
6. Publie sur GitHub (`git add . ; git commit -m "Signalements" ; git push`).

## Limites

- Les itinéraires ne tiennent pas compte des bouchons (aucun service gratuit ne couvre le trafic de La Réunion) : regarde l'onglet Trafic Waze avant de partir.
- Sur iPhone, une appli web ne suit pas ta position en arrière-plan : garde-la ouverte à l'écran pendant la navigation.
- Les serveurs gratuits (OSRM, Photon, Overpass) sont des services de démonstration partagés : ils peuvent être lents de temps en temps.

Données : © contributeurs OpenStreetMap · itinéraires OSRM · recherche Photon · carte trafic © Waze.
