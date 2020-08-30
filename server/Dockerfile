# Remote computer / server settings

FROM node:12

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
COPY yarn.lock ./

RUN yarn 
# RUN npm ci --only=production

# Bundle app source
COPY . .
# Copy the .env.production and rename it as .env
COPY .env.production .env

RUN yarn build

ENV NODE_ENV production

EXPOSE 8080
CMD [ "node", "dist/index.js" ]
USER node
