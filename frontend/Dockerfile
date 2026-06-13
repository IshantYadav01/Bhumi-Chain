FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 3000
ENV BACKEND_URL=http://backend:8080
CMD ["npm", "run", "dev"]
