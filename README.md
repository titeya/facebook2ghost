# Facebook POSTS 2 Ghost

C'est une simple application Node.js utilisant l'API facebook pour récupérer les posts de l'utilisateur de type 'album'.
Une archive ZIP sera ensuite téléchargable et comportera un fichier JSON à importer dans GhostJs accompagné d'un dossier images.

## Prérequis

- Node.js 16.x
- Docker (optionnel)

## Installation

### Sans Docker

1. Installez les dépendances :

   ```
   npm install
   ```

2. Démarrez le serveur :

   ```
   npm start
   ```

L'application est maintenant en cours d'exécution sur `http://localhost:3000`.

### Avec Docker

1. Construisez l'image Docker :

   ```
   docker build -t nom_de_votre_image .
   ```

2. Exécutez le conteneur Docker :

   ```
   docker run -p 3000:3000 -d --env-file .env nom_de_votre_image
   ```

L'application est maintenant en cours d'exécution sur `http://localhost:3000`.

## Variables d'environnement

Cette application utilise les variables d'environnement suivantes :

- `FACEBOOK_APP_ID` : L'ID de votre application Facebook.
- `FACEBOOK_APP_SECRET` : Le secret de votre application Facebook.
- `APP_URL` : L'URL de votre application.

## License

ISC
