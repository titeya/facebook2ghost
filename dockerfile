# Utilisez une image Docker officielle Node.js comme parent
FROM node:16

# Créez le répertoire de l'application dans le conteneur
WORKDIR /usr/src/app

# Copiez les fichiers package*.json dans le répertoire de l'application dans le conteneur
COPY package*.json ./

# Installez les dépendances de l'application
RUN npm install

# Si vous construisez votre code pour la production, vous pouvez exécuter: RUN npm ci --only=production

# Bundle app source
COPY . .

# Exposez le port sur lequel votre application s'exécutera
EXPOSE 3000

# Définissez la commande pour exécuter votre application
CMD [ "npm", "start" ]