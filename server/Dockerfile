FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache curl

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
